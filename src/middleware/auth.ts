import type { Request, Response, NextFunction } from "express";
import { validateToken } from "../security/auth.js";

export function authMiddleware(configToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !validateToken(authHeader, configToken)) {
      res.status(401).json({ error: "Unauthorized: Invalid or missing authentication token." });
      return;
    }

    next();
  };
}
