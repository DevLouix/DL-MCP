import { timingSafeEqual } from "node:crypto";

export function validateToken(token: string, configToken: string): boolean {
  if (!token || !configToken) return false;

  const actual = token.startsWith("Bearer ") ? token.slice(7).trim() : token;

  if (actual.length !== configToken.length) return false;

  try {
    return timingSafeEqual(Buffer.from(actual), Buffer.from(configToken));
  } catch {
    return false;
  }
}
