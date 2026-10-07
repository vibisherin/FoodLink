import jwt from "jsonwebtoken";
import db from "../config/db.js";
import { config } from "../config/env.js";

// Verifies the Bearer JWT, then re-checks the account in MySQL so an admin
// deactivating a user takes effect immediately (not after token expiry).
export async function authenticate(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: "Authentication required." });

    try {
        const payload = jwt.verify(token, config.jwtSecret);
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email, u.role, u.language, u.is_active,
                    r.id AS restaurant_id, n.id AS ngo_id
             FROM users u
             LEFT JOIN restaurants r ON r.user_id = u.id
             LEFT JOIN ngos n ON n.user_id = u.id
             WHERE u.id = ?`,
            [payload.sub]
        );
        const user = rows[0];
        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, message: "Account disabled or not found." });
        }
        req.user = user;
        next();
    } catch (err) {
        const expired = err.name === "TokenExpiredError";
        res.status(401).json({
            success: false,
            code: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
            message: expired ? "Session expired." : "Invalid token.",
        });
    }
}

export const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "You do not have access to this resource." });
    }
    next();
};
