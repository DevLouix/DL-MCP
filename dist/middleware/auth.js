import { validateToken } from "../security/auth.js";
export function authMiddleware(configToken) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        const queryToken = req.query.token;
        const token = authHeader || queryToken;
        if (!token || !validateToken(token, configToken)) {
            res.status(401).json({ error: "Unauthorized: Invalid or missing authentication token." });
            return;
        }
        next();
    };
}
