import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pino from "pino";
import { config } from "./config/env.js";
import { setWorkspaceRoot } from "./security/workspace.js";
import { registerAllTools } from "./tools/registry.js";
import { registerAllPrompts } from "./prompts/registry.js";
import { registerAllResources } from "./resources/registry.js";
import { TransportManager } from "./server/transport.js";
import { createApp } from "./server/app.js";
import type { Logger } from "./types/index.js";
import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { getServerUrls } from "./utils/netinfo.js";
import { startLocalTunnel, launchTunnel } from "./utils/tunnel.js";

async function main(): Promise<void> {
  const logger: Logger = pino({
    level: config.logLevel,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });

  setWorkspaceRoot(config.workspaceRoot);

  const mcpServer = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAllTools(mcpServer, logger);
  registerAllPrompts(mcpServer, logger);
  registerAllResources(mcpServer, logger);

  const transportManager = new TransportManager();
  await mcpServer.connect(transportManager);

  const { app, cleanup: appCleanup } = createApp(transportManager, logger);

  const proto = config.enableTls ? "https" : "http";

  const server = config.enableTls
    ? createHttpsServer(
        { cert: readFileSync(config.tlsCertPath), key: readFileSync(config.tlsKeyPath) },
        app,
      )
    : createHttpServer(app);

  server.listen(config.port, () => {
    logger.info({ port: config.port, workspace: config.workspaceRoot }, `Server started (${proto})`);
    console.error("=".repeat(60));
    console.error("  DL-MCP Enterprise Filesystem Server");
    console.error("=".repeat(60));
    console.error(`  Version:   ${SERVER_VERSION}`);
    console.error(`  Workspace: ${config.workspaceRoot}`);

    const urls = getServerUrls(config.port, proto);
    if (config.publicUrl) {
      console.error(`  Public:    ${config.publicUrl}/sse`);
    }
    for (const u of urls) {
      console.error(`  ${u.label.padEnd(9)} ${u.url}`);
    }
    if (!process.env.AUTH_TOKEN) {
      console.error(`  Auth:      ${config.authToken}`);
      console.error(`  ⚠  Save this token — it is generated once and lost on restart`);
    } else {
      console.error(`  Auth:      configured`);
    }
    console.error("=".repeat(60));
    // Optionally start a tunnel if requested via the app config and enabled.
    (async () => {
      try {
        if (!config.tunnelEnabled) {
          logger.info("Tunnel startup disabled by configuration");
          return;
        }
        const tunnelCmd = config.tunnelCmd;
        const ltSub = config.localtunnelSubdomain;
        const ltAuto = config.localtunnelAuto;
        if (tunnelCmd) {
          const stop = launchTunnel(tunnelCmd, (url) => {
            if (!config.publicUrl) config.publicUrl = url;
            logger.info({ url }, "Tunnel started (cmd)");
          }, logger as unknown as any);
          (server as any).__tunnelStop = stop;
        } else if (ltSub !== "" || ltAuto) {
          const subToUse = ltSub === "" ? undefined : ltSub;
          const stop = await startLocalTunnel(config.port, subToUse, (url) => {
            if (!config.publicUrl) config.publicUrl = url;
            logger.info({ url }, "LocalTunnel started");
          }, logger as unknown as any);
          (server as any).__tunnelStop = stop ?? null;
        }
      } catch (e) {
        logger.warn({ err: (e as Error).message }, "Failed to start tunnel");
      }
    })();
  });

  registerShutdown(server, transportManager, appCleanup, logger);
}

function registerShutdown(server: any, transportManager: TransportManager, cleanup: () => void, logger: Logger): void {
  function shutdown(signal: string) {
    logger.info({ signal }, "Shutdown signal received");
    // Stop any tunnel that was started and stored on the server object.
    try {
      const stopTunnel = (server as any).__tunnelStop as (() => void) | null | undefined;
      if (stopTunnel) {
        stopTunnel();
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "Error stopping tunnel");
    }

    cleanup();
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
