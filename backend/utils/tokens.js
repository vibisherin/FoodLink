import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../config/db.js";
import { config } from "../config/env.js";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export function signAccessToken(user) {
    return jwt.sign({ sub: user.id, role: user.role, name: user.name }, config.jwtSecret, {
        expiresIn: config.accessTtl,
    });
}

export async function issueTokens(user) {
    const accessToken = signAccessToken(user);
    const refreshToken = jwt.sign(
        { sub: user.id, type: "refresh", jti: crypto.randomUUID() },
        config.jwtRefreshSecret,
        { expiresIn: `${config.refreshDays}d` }
    );
    const expires = new Date(Date.now() + config.refreshDays * 86400000);
    await db.query(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [user.id, sha256(refreshToken), expires]
    );
    return { accessToken, refreshToken };
}

// Verifies the refresh JWT AND that it is still stored (so logout truly revokes it).
export async function rotateRefreshToken(token) {
    const payload = jwt.verify(token, config.jwtRefreshSecret);
    if (payload.type !== "refresh") throw new Error("Wrong token type");
    const [rows] = await db.query(
        "SELECT id FROM refresh_tokens WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()",
        [sha256(token)]
    );
    if (!rows.length) throw new Error("Refresh token revoked");
    await db.query("DELETE FROM refresh_tokens WHERE id = ?", [rows[0].id]);
    return payload.sub;
}

export async function revokeRefreshToken(token) {
    await db.query("DELETE FROM refresh_tokens WHERE token_hash = ?", [sha256(token)]);
}
