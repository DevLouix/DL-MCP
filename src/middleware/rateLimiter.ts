import type { Request, Response, NextFunction } from "express";

interface BucketEntry {
  count: number;
  resetAt: number;
}

export function rateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, BucketEntry>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, windowMs);

  cleanupTimer.unref();

  return {
    middleware: (req: Request, res: Response, next: NextFunction): void => {
    const key = (req as any).requestId || req.ip || req.socket.remoteAddress || "unknown";
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
    },
    cleanup: () => clearInterval(cleanupTimer),
  };
}
