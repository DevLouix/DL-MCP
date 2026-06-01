# DL-MCP Developer Guide

## Project Overview

Enterprise-grade MCP (Model Context Protocol) server exposing a filesystem via the Streamable HTTP transport. Built with TypeScript, Express 5, and pino logging.

---

## Architecture

```
src/
├── index.ts              # Entry: wires McpServer, TransportManager, Express, TLS, shutdown
├── constants.ts          # SERVER_NAME, SERVER_VERSION
├── config/
│   └── env.ts            # All config with env-var overrides (20+ variables)
├── server/
│   ├── app.ts            # Express app: middleware stack, /health, /sse, error handler
│   └── transport.ts      # TransportManager — multi-session Transport implementation
├── tools/
│   ├── registry.ts       # Tool registration + audit-log wrapper
│   ├── directory.ts      # list_directory, create_directory
│   ├── file.ts           # read/write/edit/copy/move/delete
│   ├── info.ts           # get_file_info
│   ├── search.ts         # search_grep (ReDoS-safe)
│   └── http.ts           # make_http_request (SSRF-safe)
├── prompts/
│   ├── registry.ts       # Prompt registration + audit-log wrapper
│   └── handlers.ts       # analyze_project, explain_file, review_changes, generate_readme
├── resources/
│   └── registry.ts       # Resource template: workspace://{path+}
├── middleware/
│   ├── auth.ts           # Bearer token validation
│   ├── rateLimiter.ts    # Sliding-window rate limiter
│   └── requestId.ts      # UUID per request
├── security/
│   ├── auth.ts           # timing-safe token comparison
│   ├── workspace.ts      # safeResolve — path traversal prevention
│   └── network.ts        # CIDR-based private-IP blocking
├── utils/
│   └── file.ts           # isBinaryBuffer, writeAtomic
└── types/
    └── index.ts          # Shared types
```

---

## Dev Workflow

### Setup

```bash
git clone <repo>
cp .env.example .env  # or use the bundled .env
npm install
```

### Type Check

```bash
npm run build          # tsc builds to dist/
# or just type-check without emitting:
npx tsc --noEmit
```

### Dev Server (with hot reload)

```bash
npm run dev            # tsx watch src/index.ts
```

### Build & Bundle

```bash
npm run build          # tsc → dist/
npm run bundle         # esbuild → dist/bundle.cjs (single-file CJS)
```

### Start

```bash
npm start              # node dist/index.js
npm run start:bundle   # node dist/bundle.cjs
```

### Binary Compilation (pkg)

```bash
npm run pkg:linux      # dist/dl-mcp-linux
npm run pkg:mac        # dist/dl-mcp-macos
npm run pkg:win        # dist/dl-mcp-win.exe
npm run pkg:all        # all three
```

### Release

```bash
npm run release        # bundle + pkg:all
git tag v1.2.0
git push origin v1.2.0 # triggers .github/workflows/release.yml
```

---

## Testing

### Manual (via curl)

```bash
# Health check
curl http://localhost:3544/health

# Initialize session
curl -X POST http://localhost:3544/sse \
  -H "Authorization: Bearer dl-mcp-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{}}'

# List tools
curl -X POST http://localhost:3544/sse \
  -H "Authorization: Bearer dl-mcp-dev-token" \
  -H "Mcp-Session-Id: <session-from-init>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/list","params":{}}'
```

### CI

`.github/workflows/ci.yml` runs on push/PR to `main`:
- `npx tsc --noEmit`
- `npm run bundle`
- Smoke test: start server, hit `/health`

---

## Adding a Tool

1. Create `src/tools/myTool.ts` exporting `handleMyTool(params) → Promise<ToolResult>`
2. Import and register in `src/tools/registry.ts` via `server.registerTool(name, { inputSchema: z.object({…}) }, withAuditLog(name, handler, logger))`
3. Use `safeResolve()` for all file paths; use `errorContent()` for failure responses

### Pattern

```typescript
import { safeResolve } from "../security/workspace.js";
import { textContent, errorContent } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

export async function handleMyTool(relPath: string): Promise<ToolResult> {
  try {
    const resolved = await safeResolve(relPath);
    // … do work …
    return { content: [textContent("…")] };
  } catch (err: any) {
    return errorContent(`Error: ${err.message}`);
  }
}
```

---

## Adding a Prompt

1. Add handler in `src/prompts/handlers.ts` exporting `handleMyPrompt(args) → Promise<GetPromptResult>`
2. Register in `src/prompts/registry.ts` via `server.registerPrompt(name, { title, description, argsSchema: {…} }, withAuditLog(name, handler, logger))`

### Pattern

```typescript
import { safeResolve } from "../security/workspace.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

function text(text: string): GetPromptResult {
  return {
    messages: [{ role: "assistant" as const, content: { type: "text" as const, text } }],
  };
}

export async function handleMyPrompt(args: { path: string }): Promise<GetPromptResult> {
  try {
    const resolved = await safeResolve(args.path);
    return text(`# Result\n\nRead ${resolved}`);
  } catch (err: any) {
    return text(`Error: ${err.message}`);
  }
}
```

---

## Adding a Resource

Register in `src/resources/registry.ts` via `server.registerResource(name, template, metadata, callback)`. Uses `ResourceTemplate` for dynamic URI patterns.

### Pattern

```typescript
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

server.registerResource(
  "my-resource",
  new ResourceTemplate("myapp://{path+}", { list: undefined }),
  { mimeType: "text/plain" },
  async (uri, variables) => {
    const relPath = variables.path || uri.pathname;
    return { contents: [{ uri: uri.href, mimeType: "text/plain", text: "…" }] };
  },
);
```

---

## Config Conventions

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3544` | HTTP listen port |
| `WORKSPACE_ROOT` | *(required)* | Allowed file-system root |
| `AUTH_TOKEN` | auto-generated 64-hex | Bearer token |
| `MAX_FILE_SIZE_MB` | `5` | Max file read size |
| `MAX_HTTP_RESPONSE_MB` | `2` | Max HTTP tool response |
| `RATE_LIMIT_MAX` | `100` | Requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `SESSION_IDLE_TIMEOUT_MS` | `3600000` | Session TTL (1h) |
| `ENABLE_TLS` | `false` | HTTPS server |
| `TLS_CERT_PATH` / `TLS_KEY_PATH` | — | PEM paths |
| `LOG_LEVEL` | `info` | pino log level |
| `SEARCH_MAX_DEPTH` | `12` | grep directory recursion |
| `SEARCH_MAX_FILES` | `2000` | Max files to scan |
| `SEARCH_MAX_MATCHES` | `250` | Max grep results |
| `LIST_MAX_DEPTH` | `3` | Directory recursion |
| `LIST_MAX_ENTRIES` | `1000` | Max directory entries |

---

## Security Rules

All file-access code **must** use `safeResolve()` — never `path.resolve()` directly.

```typescript
// GOOD
const resolved = await safeResolve(userInput);
await fs.readFile(resolved);

// BAD — path traversal
const bad = path.resolve(workspaceRoot, userInput);
await fs.readFile(bad);
```

Other security invariants:
- **SSRF**: `isPrivateHost()` blocks RFC 1918, link-local, IPv6 loopback/ULA; `redirect: "error"` on fetch; 30s timeout via `AbortController`
- **ReDoS**: pattern length ≤ 200 chars, nested-quantifier detection, performance fast-reject before `new RegExp()`
- **Auth**: `crypto.timingSafeEqual()` for token comparison; query-string token not supported
- **Rate limiting**: per-request-ID sliding window with `X-RateLimit-*` headers

---

## Transport Protocol

- **Streamable HTTP** on `POST /sse`
- First `POST` creates a session, returns `Mcp-Session-Id` response header
- Subsequent `POST`s include `Mcp-Session-Id` header to route to existing session
- Session expires after `SESSION_IDLE_TIMEOUT_MS` of inactivity
- `TransportManager` implements the `Transport` interface with multi-session routing via `requestIdToSession` map

---

## Build Pipeline

```
TypeScript (.ts)
    │ tsc (type-check + emit ESM → dist/)
    │
    ▼
ESM modules (dist/*.js)
    │ esbuild (bundle to single CJS file)
    │
    ▼
dist/bundle.cjs (1.5 MB single file)
    │ pkg (compile to binary)
    │
    ├── dist/dl-mcp-linux     (Linux x64)
    ├── dist/dl-mcp-macos     (macOS arm64)
    └── dist/dl-mcp-win.exe   (Windows x64)
```

---

## Coding Standards

- **Imports**: ESM with `.js` extensions (`import { foo } from "./bar.js"`)
- **No comments in source code** — the code should be self-documenting
- **Error responses**: always `errorContent(message)` for tools, structured JSON for middleware
- **Async**: prefer `async/await` over raw promises; use `Promise.all()` for parallel I/O
- **Config**: import only needed values: `import { config } from "../config/env.js"` (destructure in usage)
- **Logger**: use pino structured logging: `logger.info({ key: value }, "message")`
- **Types**: avoid `any` — use `Record<string, unknown>` for dynamic objects, augment Express types via `declare global`
- **No dead params**: prefix unused callback params with `_` (e.g., `_req`, `_next`)
- **Zod schemas**: define inline in tool/prompt registration (do not extract to separate files)
- **Rate limiter cleanup**: interval `unref()` so it doesn't keep the process alive; cleanup called on shutdown

### Git Hygiene

- Commit messages are concise, matching repo style (no emoji prefixes)
- No secrets committed — `AUTH_TOKEN` in `.env` only, never in source
- Only commit when explicitly asked

---

## CI / CD

**CI** (`.github/workflows/ci.yml`): `npx tsc --noEmit` → `npm run bundle` → smoke test

**Release** (`.github/workflows/release.yml`):
- Trigger: tag `v*` or manual dispatch
- Builds bundles + 3 platform binaries
- Creates `.tar.gz` (Linux/macOS) / `.zip` (Windows)
- Generates `sha256sums.txt`
- Publishes GitHub Release with all artifacts
