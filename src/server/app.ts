import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { IncomingMessage } from "node:http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "../config/env.js";
import { TransportManager } from "./transport.js";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { requestIdMiddleware } from "../middleware/requestId.js";
import type { Logger } from "../types/index.js";
import { SERVER_VERSION } from "../constants.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

morgan.token("request-id", (req: Request) => req.requestId || "-");

export function createApp(transportManager: TransportManager, logger: Logger) {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin }));
  app.use(requestIdMiddleware);
  app.use(morgan(':request-id :method :url :status :res[content-length] - :response-time ms'));
  app.use(express.json({ limit: `${config.maxFileSize}B` }));
  const { middleware: rateLimitMiddleware, cleanup: rateLimitCleanup } = rateLimiter(
    config.rateLimitMax, config.rateLimitWindowMs,
  );
  app.use(rateLimitMiddleware);

  app.get("/health", async (_req: Request, res: Response) => {
    const checks: Record<string, string> = {};
    let healthy = true;

    try {
      const { access, constants } = await import("node:fs/promises");
      await access(config.workspaceRoot, constants.R_OK | constants.X_OK);
      checks.filesystem = "ok";
    } catch {
      checks.filesystem = "unreachable";
      healthy = false;
    }

    res.json({
      status: healthy ? "ok" : "degraded",
      version: SERVER_VERSION,
      uptime: process.uptime(),
      workspace: config.workspaceRoot,
      checks,
    });
  });

  app.all("/sse", authMiddleware(config.authToken), async (req: Request, res: Response) => {
    try {
      await transportManager.handleRequest(
        req as IncomingMessage,
        res,
        req.body,
      );
    } catch (err: any) {
      logger.error({ err: err.message, stack: err.stack, requestId: req.requestId }, "Streamable HTTP request failed");
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal error" });
      }
    }
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: err.message, stack: err.stack, requestId: req.requestId }, "Unhandled error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return { app, cleanup: () => { rateLimitCleanup(); } };
}
