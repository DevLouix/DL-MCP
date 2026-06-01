import { configDotenv } from "dotenv";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
configDotenv({ path: path.resolve(scriptDir, "../.env") });
configDotenv();

export interface AppConfig {
  port: number;
  workspaceRoot: string;
  authToken: string;
  maxFileSize: number;
  maxHttpResponseSize: number;
  ignoredPaths: Set<string>;
  corsOrigin: string;
  logLevel: string;
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[FATAL] ${name} environment variable is not set.`);
    process.exit(1);
  }
  return value;
}

function intEnv(name: string, fallback: number): number {
  const value = process.env[name];
  return value ? parseInt(value, 10) : fallback;
}

const userToken = process.env.AUTH_TOKEN;
const generatedToken = userToken
  || Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("");

export const config: AppConfig = {
  port: intEnv("PORT", 3544),
  workspaceRoot: path.resolve(requireEnv("WORKSPACE_ROOT")),
  authToken: generatedToken,
  maxFileSize: intEnv("MAX_FILE_SIZE_MB", 5) * 1024 * 1024,
  maxHttpResponseSize: intEnv("MAX_HTTP_RESPONSE_MB", 2) * 1024 * 1024,
  ignoredPaths: new Set(
    (process.env.IGNORED_PATHS || "node_modules,.git,.next,dist,build,coverage,.DS_Store").split(",")
  ),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  logLevel: process.env.LOG_LEVEL || "info",
  rateLimitMax: intEnv("RATE_LIMIT_MAX", 100),
  rateLimitWindowMs: intEnv("RATE_LIMIT_WINDOW_MS", 60000),
};
