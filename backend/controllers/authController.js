import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../config/db.js";
import { config, googleEnabled } from "../config/env.js";
import { issueTokens, rotateRefreshToken, revokeRefreshToken, signAccessToken } from "../utils/tokens.js";
import { logActivity } from "../utils/activity.js";
import { isEmail, passwordProblem, LANGS } from "../utils/validate.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });

export async function loadUserProfile(userId) {
    const [rows] = await db.query(
        `SELECT id, name, email, role, language, avatar_url, last_login_at, (password_hash IS NOT NULL) AS has_password
         FROM users WHERE id = ?`, [userId]);
    const user = rows[0];
    if (!user) return null;
    if (user.role === "restaurant") {
        const [r] = await db.query("SELECT * FROM restaurants WHERE user_id = ?", [userId]);
        user.profile = r[0] || null;
    } else if (user.role === "ngo") {
        const [n] = await db.query("SELECT * FROM ngos WHERE user_id = ?", [userId]);
        user.profile = n[0] || null;
    }
    return user;
}

async function createAccount(conn, { name, email, passwordHash, role, googleId, avatar, language, orgName }) {
    const [u] = await conn.query(
        `INSERT INTO users (name, email, password_hash, role, google_id, avatar_url, language)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, email, passwordHash, role, googleId || null, avatar || null, language || "en"]
    );
    const table = role === "restaurant" ? "restaurants" : "ngos";
    await conn.query(`INSERT INTO ${table} (user_id, name) VALUES (?, ?)`, [u.insertId, orgName || name]);
    return u.insertId;
}

export const register = async (req, res) => {
    try {
        const { name, email, password, role, organization_name, language } = req.body;
        if (!name || String(name).trim().length < 2) return fail(res, 400, "Please enter your name.");
        if (!isEmail(email)) return fail(res, 400, "Please enter a valid email address.");
        const pwProblem = passwordProblem(password);
        if (pwProblem) return fail(res, 400, pwProblem);
        if (!["restaurant", "ngo"].includes(role)) return fail(res, 400, "Choose Restaurant or NGO.");
        if (!organization_name || String(organization_name).trim().length < 2) {
            return fail(res, 400, "Please enter your organisation name.");
        }

        const [exists] = await db.query("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
        if (exists.length) return fail(res, 409, "An account with this email already exists.");

        const hash = await bcrypt.hash(password, 10);
        const conn = await db.getConnection();
        let id;
        try {
            await conn.beginTransaction();
            id = await createAccount(conn, {
                name: name.trim(), email: email.toLowerCase(), passwordHash: hash, role,
                language: LANGS.includes(language) ? language : "en", orgName: organization_name.trim(),
            });
            await conn.commit();
        } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

        await logActivity(id, "register", `${role} account created`);
        const user = await loadUserProfile(id);
        const tokens = await issueTokens(user);
        res.status(201).json({ success: true, user, ...tokens });
    } catch (err) {
        console.error("Register error:", err);
        fail(res, 500, "Registration failed.");
    }
};

export const login = async (req, res) => {
    try {
        const { email, password, adminOnly } = req.body;
        if (!isEmail(email) || !password) return fail(res, 400, "Email and password are required.");

        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
        const row = rows[0];
        // Same message for unknown email and wrong password (no account enumeration).
        const ok = row && row.password_hash && (await bcrypt.compare(password, row.password_hash));
        if (!ok) return fail(res, 401, "Incorrect email or password.");
        if (!row.is_active) return fail(res, 403, "This account has been disabled. Contact an administrator.");
        if (adminOnly && row.role !== "admin") return fail(res, 403, "This sign-in is for administrators only.");

        await db.query("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [row.id]);
        await logActivity(row.id, "login", `${row.role} signed in`);
        const user = await loadUserProfile(row.id);
        const tokens = await issueTokens(user);
        res.json({ success: true, user, ...tokens });
    } catch (err) {
        console.error("Login error:", err);
        fail(res, 500, "Login failed.");
    }
};

export const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return fail(res, 400, "Refresh token required.");
        const userId = await rotateRefreshToken(refreshToken);
        const user = await loadUserProfile(userId);
        const [active] = await db.query("SELECT is_active FROM users WHERE id = ?", [userId]);
        if (!user || !active[0]?.is_active) return fail(res, 401, "Account unavailable.");
        const tokens = await issueTokens(user);
        res.json({ success: true, ...tokens });
    } catch {
        fail(res, 401, "Session expired. Please sign in again.");
    }
};

export const logout = async (req, res) => {
    if (req.body.refreshToken) await revokeRefreshToken(req.body.refreshToken).catch(() => {});
    res.json({ success: true });
};

export const me = async (req, res) => {
    res.json({ success: true, user: await loadUserProfile(req.user.id) });
};

export const updateMe = async (req, res) => {
    try {
        const b = req.body;
        const uid = req.user.id;
        if (b.name !== undefined) {
            if (String(b.name).trim().length < 2) return fail(res, 400, "Name is too short.");
            await db.query("UPDATE users SET name = ? WHERE id = ?", [b.name.trim(), uid]);
        }
        if (b.language !== undefined) {
            if (!LANGS.includes(b.language)) return fail(res, 400, "Unsupported language.");
            await db.query("UPDATE users SET language = ? WHERE id = ?", [b.language, uid]);
        }
        const p = b.profile;
        if (p && req.user.role !== "admin") {
            const table = req.user.role === "restaurant" ? "restaurants" : "ngos";
            const lat = p.latitude === "" || p.latitude == null ? null : Number(p.latitude);
            const lng = p.longitude === "" || p.longitude == null ? null : Number(p.longitude);
            if ((lat !== null && !(lat >= -90 && lat <= 90)) || (lng !== null && !(lng >= -180 && lng <= 180))) {
                return fail(res, 400, "Latitude/longitude out of range.");
            }
            if (p.name !== undefined && String(p.name).trim().length < 2) return fail(res, 400, "Organisation name is too short.");
            const fields = { name: p.name?.trim(), address: p.address, city: p.city, phone: p.phone, latitude: lat, longitude: lng };
            if (req.user.role === "ngo") {
                if (p.daily_capacity_meals !== undefined) {
                    const cap = Number(p.daily_capacity_meals);
                    if (!Number.isInteger(cap) || cap < 1) return fail(res, 400, "Daily capacity must be a positive whole number.");
                    fields.daily_capacity_meals = cap;
                }
                if (p.max_radius_km !== undefined) {
                    const rad = Number(p.max_radius_km);
                    if (!(rad > 0 && rad <= 100)) return fail(res, 400, "Service radius must be between 0 and 100 km.");
                    fields.max_radius_km = rad;
                }
                if (p.accepted_categories !== undefined) {
                    const cats = [].concat(p.accepted_categories).filter(Boolean);
                    if (!cats.length) return fail(res, 400, "Select at least one food category.");
                    fields.accepted_categories = cats.join(",");
                }
                if (p.has_vehicle !== undefined) fields.has_vehicle = p.has_vehicle ? 1 : 0;
            }
            const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
            if (entries.length) {
                await db.query(`UPDATE ${table} SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE user_id = ?`,
                    [...entries.map(([, v]) => v), uid]);
            }
        }
        await logActivity(uid, "profile_update");
        res.json({ success: true, user: await loadUserProfile(uid) });
    } catch (err) {
        console.error("Update profile error:", err);
        fail(res, 500, "Could not update profile.");
    }
};

/* ------------------------------ Google OAuth 2.0 ------------------------------ */

export const providers = (req, res) => res.json({ google: googleEnabled });

export const googleStart = (req, res) => {
    if (!googleEnabled) {
        return res.redirect(`${config.frontendUrl}/login?error=google_not_configured`);
    }
    const role = ["restaurant", "ngo"].includes(req.query.role) ? req.query.role : "restaurant";
    // The OAuth `state` is a short-lived signed JWT: it carries the chosen role and
    // protects the callback against CSRF without needing a server session.
    const state = jwt.sign({ role, nonce: crypto.randomBytes(8).toString("hex") }, config.jwtSecret, { expiresIn: "10m" });
    const params = new URLSearchParams({
        client_id: config.google.clientId,
        redirect_uri: config.google.callbackUrl,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};

export const googleCallback = async (req, res) => {
    const back = (q) => res.redirect(`${config.frontendUrl}/login?error=${q}`);
    try {
        if (!googleEnabled) return back("google_not_configured");
        const { code, state, error } = req.query;
        if (error || !code || !state) return back("google_denied");

        let role;
        try { role = jwt.verify(state, config.jwtSecret).role; } catch { return back("google_state_invalid"); }

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code, client_id: config.google.clientId, client_secret: config.google.clientSecret,
                redirect_uri: config.google.callbackUrl, grant_type: "authorization_code",
            }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) return back("google_token_failed");

        const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const info = await infoRes.json();
        if (!info.email || !info.email_verified) return back("google_email_unverified");

        const email = info.email.toLowerCase();
        let [rows] = await db.query("SELECT * FROM users WHERE google_id = ? OR email = ?", [info.sub, email]);
        let userRow = rows[0];

        if (userRow) {
            if (!userRow.is_active) return back("account_disabled");
            // Link Google to an existing email account the first time it is used.
            await db.query(
                "UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(avatar_url, ?), last_login_at = UTC_TIMESTAMP() WHERE id = ?",
                [info.sub, info.picture || null, userRow.id]);
        } else {
            const conn = await db.getConnection();
            let id;
            try {
                await conn.beginTransaction();
                id = await createAccount(conn, {
                    name: info.name || email.split("@")[0], email, passwordHash: null, role,
                    googleId: info.sub, avatar: info.picture, language: "en",
                });
                await conn.query("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
                await conn.commit();
            } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
            [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
            userRow = rows[0];
        }

        await logActivity(userRow.id, "login_google", `${userRow.role} signed in with Google`);
        const tokens = await issueTokens(userRow);
        // Tokens travel in the URL fragment, which browsers never send to servers or logs.
        res.redirect(`${config.frontendUrl}/oauth/callback#access=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
    } catch (err) {
        console.error("Google OAuth error:", err);
        back("google_failed");
    }
};
