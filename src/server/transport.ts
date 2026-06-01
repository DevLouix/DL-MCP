import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export class TransportManager implements Transport {
  private sessions = new Map<string, StreamableHTTPServerTransport>();
  private requestIdToSession = new Map<string | number, string>();

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: any, extra?: any) => void;
  setProtocolVersion?: (version: string) => void;

  async handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && this.sessions.has(sessionId)) {
      const transport = this.sessions.get(sessionId)!;
      await transport.handleRequest(req, res, parsedBody);
      return;
    }

    if (sessionId) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId: string) => {
        this.sessions.set(newSessionId, transport);
      },
      onsessionclosed: (closedSessionId: string) => {
        this.sessions.delete(closedSessionId);
      },
    });

    transport.onmessage = (message, extra) => {
      const msg = message as Record<string, unknown>;
      if (msg.id !== undefined) {
        this.requestIdToSession.set(String(msg.id), transport.sessionId!);
      }
      this.onmessage?.(message, extra);
    };
    transport.onclose = () => this.onclose?.();
    transport.onerror = (err) => this.onerror?.(err);

    await transport.handleRequest(req, res, parsedBody);
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {
    await Promise.all(Array.from(this.sessions.values()).map((t) => t.close()));
    this.sessions.clear();
    this.requestIdToSession.clear();
  }

  async send(message: any, options?: any): Promise<void> {
    let requestId = options?.relatedRequestId;
    if (message && (message.result !== undefined || message.error !== undefined)) {
      requestId = message.id;
    }

    if (requestId !== undefined) {
      const sid = this.requestIdToSession.get(String(requestId));
      const transport = sid ? this.sessions.get(sid) : undefined;
      if (transport) {
        await transport.send(message, options);
        return;
      }
    }

    for (const transport of this.sessions.values()) {
      try {
        await transport.send(message, options);
      } catch {
        // continue
      }
    }
  }

  get sessionId(): string | undefined {
    return this.sessions.size > 0 ? Array.from(this.sessions.values())[0].sessionId : undefined;
  }
}
