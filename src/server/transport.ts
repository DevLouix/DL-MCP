import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { config } from "../config/env.js";

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  lastUsed: number;
  idleTimer?: ReturnType<typeof setTimeout>;
}

export class TransportManager implements Transport {
  private sessions = new Map<string, SessionEntry>();
  private requestIdToSession = new Map<string | number, string>();

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: any, extra?: any) => void;
  setProtocolVersion?: (version: string) => void;

  private touchSession(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    entry.lastUsed = Date.now();
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(() => {
      this.closeSession(sessionId);
    }, config.sessionIdleTimeoutMs);
    entry.idleTimer.unref();
  }

  private closeSession(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    entry.transport.close().catch(() => {});
    this.sessions.delete(sessionId);
    for (const [reqId, sid] of this.requestIdToSession) {
      if (sid === sessionId) this.requestIdToSession.delete(reqId);
    }
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const entry = this.sessions.get(sessionId);
      if (entry) {
        this.touchSession(sessionId);
        await entry.transport.handleRequest(req, res, parsedBody);
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId: string) => {
        const entry: SessionEntry = { transport, lastUsed: Date.now() };
        const timer = setTimeout(() => this.closeSession(newSessionId), config.sessionIdleTimeoutMs);
        timer.unref();
        entry.idleTimer = timer;
        this.sessions.set(newSessionId, entry);
      },
      onsessionclosed: (closedSessionId: string) => {
        this.closeSession(closedSessionId);
      },
    });

    transport.onmessage = (message, extra) => {
      const msg = message as Record<string, unknown>;
      if (msg.id !== undefined) {
        if (transport.sessionId) {
          this.requestIdToSession.set(String(msg.id), transport.sessionId);
        }
      }
      this.onmessage?.(message, extra);
    };
    transport.onclose = () => this.onclose?.();
    transport.onerror = (err) => this.onerror?.(err);

    await transport.handleRequest(req, res, parsedBody);
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {
    for (const sid of this.sessions.keys()) {
      this.closeSession(sid);
    }
  }

  async send(message: any, options?: any): Promise<void> {
    let requestId = options?.relatedRequestId;
    if (message && (message.result !== undefined || message.error !== undefined)) {
      requestId = message.id;
    }

    if (requestId !== undefined) {
      const sid = this.requestIdToSession.get(String(requestId));
      if (sid) {
        const entry = this.sessions.get(sid);
        if (entry) {
          this.touchSession(sid);
          await entry.transport.send(message, options);
          return;
        }
      }
    }

    for (const entry of this.sessions.values()) {
      try {
        await entry.transport.send(message, options);
      } catch {}
    }
  }

  get sessionId(): string | undefined {
    for (const sid of this.sessions.keys()) return sid;
    return undefined;
  }
}
