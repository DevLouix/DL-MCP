import process from "node:process";

const flagMap: Record<string, [string, string]> = {
  "--workspace":     ["WORKSPACE_ROOT", "Workspace root directory"],
  "-w":              ["WORKSPACE_ROOT", ""],
  "--port":          ["PORT", "HTTP listen port"],
  "-p":              ["PORT", ""],
  "--auth-token":    ["AUTH_TOKEN", "Bearer token for authentication"],
  "-a":              ["AUTH_TOKEN", ""],
  "--max-file-size": ["MAX_FILE_SIZE_MB", "Max file read/write size in MB"],
  "--cors-origin":   ["CORS_ORIGIN", "CORS allowed origin"],
  "--log-level":     ["LOG_LEVEL", "Log level (info, debug, warn, error)"],
  "-l":              ["LOG_LEVEL", ""],
  "--rate-limit-max":       ["RATE_LIMIT_MAX", "Max requests per window"],
  "--rate-limit-window":    ["RATE_LIMIT_WINDOW_MS", "Rate limit window in ms"],
  "--request-timeout":      ["REQUEST_TIMEOUT_MS", "Request timeout in ms"],
  "--search-max-depth":     ["SEARCH_MAX_DEPTH", "Max grep directory depth"],
  "--search-max-files":     ["SEARCH_MAX_FILES", "Max files to scan in grep"],
  "--search-max-matches":   ["SEARCH_MAX_MATCHES", "Max grep results"],
  "--list-max-depth":       ["LIST_MAX_DEPTH", "Max directory listing depth"],
  "--list-max-entries":     ["LIST_MAX_ENTRIES", "Max directory listing entries"],
  "--session-idle-timeout": ["SESSION_IDLE_TIMEOUT_MS", "Session idle timeout in ms"],
  "--enable-tls":           ["ENABLE_TLS", "Enable HTTPS (true/false)"],
  "--tls-cert":             ["TLS_CERT_PATH", "Path to TLS certificate PEM"],
  "--tls-key":              ["TLS_KEY_PATH", "Path to TLS key PEM"],
  "--public-url":           ["PUBLIC_URL", "Public URL (reverse proxy)"],
  "--ignored-paths":        ["IGNORED_PATHS", "Comma-separated ignored paths"],
};

function printHelp(): void {
  const lines: string[] = [
    "DL-MCP Enterprise Filesystem Server",
    "",
    "Usage: dl-mcp [options]",
    "",
    "All options can also be set via .env file or environment variables.",
    "CLI flags take precedence over .env.",
    "",
    "Options:",
  ];

  const keys = Object.keys(flagMap).filter(k => k.startsWith("--")).sort();
  for (const key of keys) {
    const [envVar, desc] = flagMap[key];
    const short = Object.keys(flagMap).find(k => k.startsWith("-") && !k.startsWith("--") && flagMap[k][0] === envVar);
    const alias = short ? `, ${short}` : "";
    if (desc) {
      lines.push(`  ${key}${alias} <value>    ${desc} (env: ${envVar})`);
    }
  }

  lines.push(
    "",
    "  --help, -h               Show this help message",
    "",
    `Example:`,
    `  dl-mcp --workspace /data --port 3544 --auth-token my-secret`,
  );

  console.error(lines.join("\n"));
}

export function parseCliArgs(): void {
  const args = process.argv.slice(1);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    let key: string | undefined;
    let value: string | undefined;

    if (arg.startsWith("--") && arg.includes("=")) {
      const eq = arg.indexOf("=");
      key = arg.slice(0, eq);
      value = arg.slice(eq + 1);
    } else if (flagMap[arg]) {
      i++;
      if (i >= args.length) {
        console.error(`[FATAL] Flag ${arg} requires a value`);
        process.exit(1);
      }
      key = arg;
      value = args[i];
    }

    if (key && flagMap[key]) {
      const envVar = flagMap[key][0];
      process.env[envVar] = value;
    }
  }
}
