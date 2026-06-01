import { validateToken } from "../security/auth.js";
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader)
        return authHeader;
    const apiKey = req.headers["x-api-key"];
    if (typeof apiKey === "string")
        return apiKey;
    const queryToken = req.query.token;
    if (typeof queryToken === "string")
        return queryToken;
    return null;
}
export function authMiddleware(configToken) {
    return (req, res, next) => {
        const token = extractToken(req);
        if (!token || !validateToken(token, configToken)) {
            res.status(401).json({ error: "Unauthorized: Invalid or missing authentication token." });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map