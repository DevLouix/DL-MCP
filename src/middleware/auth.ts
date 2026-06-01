import type { Request, Response, NextFunction } from "express";
import { validateToken } from "../security/auth.js";

export function authMiddleware(configToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;

    const token = authHeader || queryToken;

    if (!token || !validateToken(token, configToken)) {
      res.status(401).json({ error: "Unauthorized: Invalid or missing authentication token." });
      return;
    }

    next();
  };
}
