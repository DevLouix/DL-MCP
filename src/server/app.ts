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

morgan.token("request-id", (req: any) => req.requestId || "-");

export function createApp(transportManager: TransportManager, logger: Logger) {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin }));
  app.use(requestIdMiddleware);
  app.use(morgan(':request-id :method :url :status :res[content-length] - :response-time ms'));
  app.use(express.json({ limit: `${config.maxFileSize}B` }));
  app.use(rateLimiter(config.rateLimitMax, config.rateLimitWindowMs));

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

    const sessionCount = (transportManager as any).sessions?.size ?? 0;

    res.json({
      status: healthy ? "ok" : "degraded",
      version: "1.2.0",
      uptime: process.uptime(),
      workspace: config.workspaceRoot,
      checks,
      sessions: sessionCount,
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
      logger.error({ err: err.message, stack: err.stack, requestId: (req as any).requestId }, "Streamable HTTP request failed");
      if (!res.headersSent) {
        res.status(500).send("Internal error");
      }
    }
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: err.message, stack: err.stack, requestId: (req as any).requestId }, "Unhandled error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app;
}
