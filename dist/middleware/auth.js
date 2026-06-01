import { validateToken } from "../security/auth.js";
export function authMiddleware(configToken) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !validateToken(authHeader, configToken)) {
            res.status(401).json({ error: "Unauthorized: Invalid or missing authentication token." });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map