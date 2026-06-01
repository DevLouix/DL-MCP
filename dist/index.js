import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pino from "pino";
import { config } from "./config/env.js";
import { setWorkspaceRoot } from "./security/workspace.js";
import { registerAllTools } from "./tools/registry.js";
import { registerAllPrompts } from "./prompts/registry.js";
import { registerAllResources } from "./resources/registry.js";
import { TransportManager } from "./server/transport.js";
import { createApp } from "./server/app.js";
import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
async function main() {
    const logger = pino({
        level: config.logLevel,
        formatters: {
            level(label) {
                return { level: label };
            },
        },
    });
    setWorkspaceRoot(config.workspaceRoot);
    const mcpServer = new McpServer({
        name: "enterprise-filesystem-mcp",
        version: "1.2.0",
    });
    registerAllTools(mcpServer, logger);
    registerAllPrompts(mcpServer, logger);
    registerAllResources(mcpServer, logger);
    const transportManager = new TransportManager();
    await mcpServer.connect(transportManager);
    const app = createApp(transportManager, logger);
    const proto = config.enableTls ? "https" : "http";
    const server = config.enableTls
        ? createHttpsServer({ cert: readFileSync(config.tlsCertPath), key: readFileSync(config.tlsKeyPath) }, app)
        : createHttpServer(app);
    server.listen(config.port, () => {
        logger.info({ port: config.port, workspace: config.workspaceRoot }, `Server started (${proto})`);
        console.error("=".repeat(60));
        console.error("  DL-MCP Enterprise Filesystem Server");
        console.error("=".repeat(60));
        console.error(`  Endpoint:  ${proto}://localhost:${config.port}/sse`);
        console.error(`  Workspace: ${config.workspaceRoot}`);
        if (!process.env.AUTH_TOKEN) {
            console.error(`  Auth Token: ${config.authToken}`);
        }
        console.error("=".repeat(60));
    });
    registerShutdown(server, transportManager, logger);
}
function registerShutdown(server, transportManager, logger) {
    function shutdown(signal) {
        logger.info({ signal }, "Shutdown signal received");
        server.close(async () => {
            await transportManager.close();
            logger.info("Server shut down gracefully");
            process.exit(0);
        });
        setTimeout(() => {
            logger.error("Forced shutdown after timeout");
            process.exit(1);
        }, 10000).unref();
    }
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("uncaughtException", (err) => {
        logger.error({ err: err.message, stack: err.stack }, "Uncaught exception");
        process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
        logger.error({ reason }, "Unhandled rejection");
    });
}
main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map