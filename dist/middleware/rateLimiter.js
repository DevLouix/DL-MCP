export function rateLimiter(maxRequests, windowMs) {
    const buckets = new Map();
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of buckets) {
            if (entry.resetAt <= now) {
                buckets.delete(key);
            }
        }
    }, windowMs);
    cleanup.unref();
    return (req, res, next) => {
        const key = req.requestId || req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        const entry = buckets.get(key);
        if (!entry || entry.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            res.setHeader("X-RateLimit-Limit", String(maxRequests));
            res.setHeader("X-RateLimit-Remaining", String(maxRequests - 1));
            res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
            next();
            return;
        }
        if (entry.count >= maxRequests) {
            res.setHeader("X-RateLimit-Limit", String(maxRequests));
            res.setHeader("X-RateLimit-Remaining", "0");
            res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
            res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
            res.status(429).json({
                error: "Too many requests. Please slow down.",
                retryAfterMs: entry.resetAt - now,
            });
            return;
        }
        entry.count++;
        res.setHeader("X-RateLimit-Limit", String(maxRequests));
        res.setHeader("X-RateLimit-Remaining", String(maxRequests - entry.count));
        res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
        next();
    };
}
//# sourceMappingURL=rateLimiter.js.map