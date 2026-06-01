import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const existing = req.headers["x-request-id"] as string | undefined;
  (req as any).requestId = existing || randomUUID();
  next();
}
