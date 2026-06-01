import type { Request, Response, NextFunction } from "express";
import { validateToken } from "../security/auth.js";

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader) return authHeader;

  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey === "string") return apiKey;

  const queryToken = req.query.token;
  if (typeof queryToken === "string") return queryToken;

  return null;
}

export function authMiddleware(configToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = extractToken(req);

    if (!token || !validateToken(token, configToken)) {
      res.status(401).json({ error: "Unauthorized: Invalid or missing authentication token." });
      return;
    }

    next();
  };
}
