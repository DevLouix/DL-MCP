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
        const key = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        const entry = buckets.get(key);
        if (!entry || entry.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }
        if (entry.count >= maxRequests) {
            res.status(429).json({
                error: "Too many requests. Please slow down.",
                retryAfterMs: entry.resetAt - now,
            });
            return;
        }
        entry.count++;
        next();
    };
}
