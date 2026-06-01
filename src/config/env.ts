import { configDotenv } from "dotenv";
import process from "node:process";
import path from "node:path";
import { randomBytes } from "node:crypto";

const scriptDir = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(process.argv[1]);
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
  requestTimeoutMs: number;
  searchMaxDepth: number;
  searchMaxFiles: number;
  searchMaxMatches: number;
  listMaxDepth: number;
  listMaxEntries: number;
  sessionIdleTimeoutMs: number;
  enableTls: boolean;
  tlsCertPath: string;
  tlsKeyPath: string;
  publicUrl: string;
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
  if (value !== undefined) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      console.error(`[FATAL] ${name} must be a non-negative integer, got "${value}".`);
      process.exit(1);
    }
    return parsed;
  }
  return fallback;
}

const userToken = process.env.AUTH_TOKEN;
const generatedToken = userToken
  || randomBytes(32).toString("hex");

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
  requestTimeoutMs: intEnv("REQUEST_TIMEOUT_MS", 300000),
  searchMaxDepth: intEnv("SEARCH_MAX_DEPTH", 12),
  searchMaxFiles: intEnv("SEARCH_MAX_FILES", 2000),
  searchMaxMatches: intEnv("SEARCH_MAX_MATCHES", 250),
  listMaxDepth: intEnv("LIST_MAX_DEPTH", 3),
  listMaxEntries: intEnv("LIST_MAX_ENTRIES", 1000),
  sessionIdleTimeoutMs: intEnv("SESSION_IDLE_TIMEOUT_MS", 3600000),
  enableTls: (process.env.ENABLE_TLS || "false").toLowerCase() === "true",
  tlsCertPath: process.env.TLS_CERT_PATH || "",
  tlsKeyPath: process.env.TLS_KEY_PATH || "",
  publicUrl: process.env.PUBLIC_URL || "",
};
