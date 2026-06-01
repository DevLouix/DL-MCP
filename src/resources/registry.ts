import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { config } from "../config/env.js";
import { safeResolve } from "../security/workspace.js";
import { isBinaryBuffer } from "../utils/file.js";
import type { Logger } from "../types/index.js";

const MIME_TYPES: Record<string, string> = {
  ".txt": "text/plain", ".md": "text/markdown", ".json": "application/json",
  ".js": "text/javascript", ".ts": "text/typescript", ".jsx": "text/jsx",
  ".tsx": "text/typescript", ".html": "text/html", ".css": "text/css",
  ".yaml": "text/yaml", ".yml": "text/yaml", ".xml": "text/xml",
  ".sh": "text/x-shellscript", ".py": "text/x-python", ".rs": "text/rust",
  ".go": "text/x-go", ".java": "text/x-java", ".sql": "text/x-sql",
  ".toml": "text/toml", ".env": "text/plain", ".dockerfile": "text/x-dockerfile",
};

export function registerAllResources(server: McpServer, logger: Logger): void {
  server.registerResource(
    "workspace-file",
    new ResourceTemplate("workspace://{path+}", { list: undefined }),
    { mimeType: "text/plain" },
    async (uri, variables) => {
      const raw = variables.path;
      const relPath = (Array.isArray(raw) ? raw.join("/") : raw) || uri.pathname.replace(/^\//, "") || "";
      try {
        const resolved = await safeResolve(relPath);
        const stat = await fs.stat(resolved);

        if (stat.isDirectory()) {
          const entries = await fs.readdir(resolved, { withFileTypes: true });
          const listing = await Promise.all(
            entries
              .filter((e) => !config.ignoredPaths.has(e.name))
              .map(async (e) => {
                const fullPath = path.join(resolved, e.name);
                let size = 0;
                try { size = (await fs.stat(fullPath)).size; } catch {}
                return {
                  name: e.name,
                  type: e.isDirectory() ? "directory" : "file",
                  size,
                };
              }),
          );
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(listing, null, 2),
            }],
          };
        }

        const maxSize = config.maxFileSize;
        if (stat.size > maxSize) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "text/plain",
              text: `[File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB]`,
            }],
          };
        }

        const buffer = await fs.readFile(resolved);
        if (isBinaryBuffer(buffer)) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "application/octet-stream",
              blob: buffer.toString("base64"),
            }],
          };
        }

        const ext = path.extname(relPath).toLowerCase();
        return {
          contents: [{
            uri: uri.href,
            mimeType: MIME_TYPES[ext] || "text/plain",
            text: buffer.toString("utf-8"),
          }],
        };
      } catch (err: any) {
        if (err.code === "ENOENT") {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: Path not found: ${relPath}`,
            }],
          };
        }
        if (err.message?.includes("Access Denied")) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${err.message}`,
            }],
          };
        }
        throw err;
      }
    },
  );

  logger.info({ resource: "workspace://{path+}" }, "Registered resource template");
}
