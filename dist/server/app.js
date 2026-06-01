import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "../config/env.js";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { requestIdMiddleware } from "../middleware/requestId.js";
morgan.token("request-id", (req) => req.requestId || "-");
export function createApp(transportManager, logger) {
    const app = express();
    app.set("trust proxy", 1);
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(cors({ origin: config.corsOrigin }));
    app.use(requestIdMiddleware);
    app.use(morgan(':request-id :method :url :status :res[content-length] - :response-time ms'));
    app.use(express.json({ limit: `${config.maxFileSize}B` }));
    app.use(rateLimiter(config.rateLimitMax, config.rateLimitWindowMs));
    app.get("/health", async (_req, res) => {
        const checks = {};
        let healthy = true;
        try {
            const { access, constants } = await import("node:fs/promises");
            await access(config.workspaceRoot, constants.R_OK | constants.X_OK);
            checks.filesystem = "ok";
        }
        catch {
            checks.filesystem = "unreachable";
            healthy = false;
        }
        const sessionCount = transportManager.sessions?.size ?? 0;
        res.json({
            status: healthy ? "ok" : "degraded",
            version: "1.2.0",
            uptime: process.uptime(),
            workspace: config.workspaceRoot,
            checks,
            sessions: sessionCount,
        });
    });
    app.all("/sse", authMiddleware(config.authToken), async (req, res) => {
        try {
            await transportManager.handleRequest(req, res, req.body);
        }
        catch (err) {
            logger.error({ err: err.message, stack: err.stack, requestId: req.requestId }, "Streamable HTTP request failed");
            if (!res.headersSent) {
                res.status(500).send("Internal error");
            }
        }
    });
    app.use((err, req, res, _next) => {
        logger.error({ err: err.message, stack: err.stack, requestId: req.requestId }, "Unhandled error");
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        }
    });
    return app;
}
//# sourceMappingURL=app.js.map