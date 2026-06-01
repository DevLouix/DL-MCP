export function createAuthToken(configToken) {
    return configToken;
}
export function validateToken(token, configToken) {
    if (!token)
        return false;
    if (token.startsWith("Bearer ")) {
        return token.slice(7).trim() === configToken;
    }
    return token === configToken;
}
