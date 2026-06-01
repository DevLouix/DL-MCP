import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
export class TransportManager {
    sessions = new Map();
    requestIdToSession = new Map();
    onclose;
    onerror;
    onmessage;
    setProtocolVersion;
    async handleRequest(req, res, parsedBody) {
        const sessionId = req.headers["mcp-session-id"];
        if (sessionId && this.sessions.has(sessionId)) {
            const transport = this.sessions.get(sessionId);
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
            onsessioninitialized: (newSessionId) => {
                this.sessions.set(newSessionId, transport);
            },
            onsessionclosed: (closedSessionId) => {
                this.sessions.delete(closedSessionId);
            },
        });
        transport.onmessage = (message, extra) => {
            const msg = message;
            if (msg.id !== undefined) {
                this.requestIdToSession.set(String(msg.id), transport.sessionId);
            }
            this.onmessage?.(message, extra);
        };
        transport.onclose = () => this.onclose?.();
        transport.onerror = (err) => this.onerror?.(err);
        await transport.handleRequest(req, res, parsedBody);
    }
    async start() { }
    async close() {
        await Promise.all(Array.from(this.sessions.values()).map((t) => t.close()));
        this.sessions.clear();
        this.requestIdToSession.clear();
    }
    async send(message, options) {
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
            }
            catch {
                // continue
            }
        }
    }
    get sessionId() {
        return this.sessions.size > 0 ? Array.from(this.sessions.values())[0].sessionId : undefined;
    }
}
