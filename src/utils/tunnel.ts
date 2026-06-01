import { spawn } from "node:child_process";
import type { Logger } from "../types/index.js";

const URL_RE = /https?:\/\/[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})(?::\d+)?(?:\/|\b)/;

export function launchTunnel(
  cmd: string,
  onUrl: (url: string) => void,
  logger: Logger,
): (() => void) | null {
  if (!cmd || !cmd.trim()) return null;

  const parts = cmd.trim().split(/\s+/);
  const prog = parts[0];
  const args = parts.slice(1);

  logger.info({ cmd: prog }, "Launching tunnel");

  const child = spawn(prog, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  let stopped = false;
  let urlReported = false;

  function onData(data: Buffer) {
    const text = data.toString("utf-8");
    if (!urlReported) {
      const m = text.match(URL_RE);
      if (m) {
        urlReported = true;
        const tunnelUrl = m[0].replace(/\/+$/, "");
        onUrl(tunnelUrl);
      }
    }
  }

  if (child.stdout) {
    child.stdout.on("data", onData);
  }
  if (child.stderr) {
    child.stderr.on("data", onData);
  }

  child.on("error", (err) => {
    if (!stopped) {
      logger.error({ err: err.message, cmd: prog }, "Tunnel failed to launch");
    }
  });

  child.on("exit", (code) => {
    if (!stopped) {
      logger.warn({ cmd: prog, code }, "Tunnel exited unexpectedly");
    }
  });

  return () => {
    stopped = true;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 3000).unref();
  };
}

export async function startLocalTunnel(
  port: number,
  subdomain: string | undefined,
  onUrl: (url: string) => void,
  logger: Logger,
): Promise<(() => void) | null> {
  try {
    const mod = await import("localtunnel");
    // localtunnel exports a default factory in most builds
    const createTunnel = (mod as any).default ?? (mod as any);
    const tunnel = await createTunnel({ port, subdomain });
    if (tunnel && typeof tunnel.url === "string") {
      onUrl(tunnel.url.replace(/\/+$/, ""));
    }
    return () => {
      try {
        tunnel && tunnel.close && tunnel.close();
      } catch (e) {
        logger.error({ err: (e as Error).message }, "Error closing localtunnel");
      }
    };
  } catch (err) {
    // If dynamic import fails (package not installed), fall back to npx localtunnel
    logger.info({ err: (err as Error).message }, "localtunnel import failed, falling back to npx");
    const cmd = `npx localtunnel --port ${port}` + (subdomain ? ` --subdomain ${subdomain}` : "");
    return launchTunnel(cmd, onUrl, logger);
  }
}
