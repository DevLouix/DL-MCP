import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { config } from "../config/env.js";
export class TransportManager {
    sessions = new Map();
    requestIdToSession = new Map();
    onclose;
    onerror;
    onmessage;
    setProtocolVersion;
    touchSession(sessionId) {
        const entry = this.sessions.get(sessionId);
        if (!entry)
            return;
        entry.lastUsed = Date.now();
        if (entry.idleTimer)
            clearTimeout(entry.idleTimer);
        entry.idleTimer = setTimeout(() => {
            this.closeSession(sessionId);
        }, config.sessionIdleTimeoutMs);
        entry.idleTimer.unref();
    }
    closeSession(sessionId) {
        const entry = this.sessions.get(sessionId);
        if (!entry)
            return;
        if (entry.idleTimer)
            clearTimeout(entry.idleTimer);
        entry.transport.close().catch(() => { });
        this.sessions.delete(sessionId);
        for (const [reqId, sid] of this.requestIdToSession) {
            if (sid === sessionId)
                this.requestIdToSession.delete(reqId);
        }
    }
    async handleRequest(req, res, parsedBody) {
        const sessionId = req.headers["mcp-session-id"];
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
            onsessioninitialized: (newSessionId) => {
                const entry = { transport, lastUsed: Date.now() };
                const timer = setTimeout(() => this.closeSession(newSessionId), config.sessionIdleTimeoutMs);
                timer.unref();
                entry.idleTimer = timer;
                this.sessions.set(newSessionId, entry);
            },
            onsessionclosed: (closedSessionId) => {
                this.closeSession(closedSessionId);
            },
        });
        transport.onmessage = (message, extra) => {
            const msg = message;
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
    async start() { }
    async close() {
        for (const sid of this.sessions.keys()) {
            this.closeSession(sid);
        }
    }
    async send(message, options) {
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
            }
            catch { }
        }
    }
    get sessionId() {
        for (const sid of this.sessions.keys())
            return sid;
        return undefined;
    }
}
//# sourceMappingURL=transport.js.map