import express from "express";
import type { Request, Response } from "express";
import type { IncomingMessage } from "node:http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "../config/env.js";
import { TransportManager } from "./transport.js";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import type { Logger } from "../types/index.js";

export function createApp(transportManager: TransportManager, logger: Logger) {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin }));
  app.use(morgan("short"));
  app.use(express.json({ limit: "4mb" }));
  app.use(rateLimiter(config.rateLimitMax, config.rateLimitWindowMs));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: "1.1.0",
      uptime: process.uptime(),
      workspace: config.workspaceRoot,
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
      logger.error({ err: err.message, stack: err.stack }, "Streamable HTTP request failed");
      if (!res.headersSent) {
        res.status(500).send("Internal error");
      }
    }
  });

  return app;
}
