export function createAuthToken(configToken: string): string {
  return configToken;
}

export function validateToken(token: string, configToken: string): boolean {
  if (!token) return false;
  if (token.startsWith("Bearer ")) {
    return token.slice(7).trim() === configToken;
  }
  return token === configToken;
}
