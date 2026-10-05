/**
 * Verifies every seeded account can authenticate and that JWT + role rules work.
 * Start the backend first (npm start), then run:  npm run test:logins
 */
import jwt from "jsonwebtoken";
import "../config/env.js";
import { SEEDED_LOGINS } from "../db/seed.js";

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
let passed = 0, failed = 0;

const check = (label, ok, extra = "") => {
    ok ? passed++ : failed++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
};
const call = async (path, { method = "GET", token, body } = {}) => {
    const res = await fetch(BASE + path, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
};

console.log(`\nFoodLink login check against ${BASE}\n`);
const sessions = [];

console.log("1. Login for every seeded account");
for (const acc of SEEDED_LOGINS.accounts) {
    const password = acc.role === "admin" ? SEEDED_LOGINS.adminPassword : SEEDED_LOGINS.password;
    const r = await call("/api/auth/login", { method: "POST", body: { email: acc.email, password } });
    const decoded = r.json.accessToken ? jwt.decode(r.json.accessToken) : null;
    check(`${acc.role.padEnd(10)} ${acc.email}`, r.status === 200 && decoded?.role === acc.role, `HTTP ${r.status}, JWT role=${decoded?.role}`);
    if (r.status === 200) sessions.push({ ...acc, ...r.json });
}
check(`at least 5 users can log in`, sessions.length >= 5, `${sessions.length} logged in`);

console.log("\n2. Rejections");
const bad = await call("/api/auth/login", { method: "POST", body: { email: SEEDED_LOGINS.accounts[1].email, password: "WrongPass123" } });
check("wrong password -> 401", bad.status === 401);
const noTok = await call("/api/food");
check("no token -> 401", noTok.status === 401);
const forged = await call("/api/food", { token: jwt.sign({ sub: 1, role: "admin" }, "not-the-real-secret") });
check("forged JWT -> 401", forged.status === 401);

console.log("\n3. Role-based access (JWT + RBAC)");
const admin = sessions.find((s) => s.role === "admin");
const rest = sessions.find((s) => s.role === "restaurant");
const ngo = sessions.find((s) => s.role === "ngo");
check("admin  -> /api/admin/stats 200", (await call("/api/admin/stats", { token: admin.accessToken })).status === 200);
check("restaurant -> /api/admin/stats 403", (await call("/api/admin/stats", { token: rest.accessToken })).status === 403);
check("ngo        -> /api/admin/users 403", (await call("/api/admin/users", { token: ngo.accessToken })).status === 403);
check("ngo        -> POST /api/food 403", (await call("/api/food", { method: "POST", token: ngo.accessToken, body: {} })).status === 403);
const adminLoginAsRestaurant = await call("/api/auth/login", { method: "POST", body: { email: rest.email, password: SEEDED_LOGINS.password, adminOnly: true } });
check("admin-only sign-in rejects a restaurant account", adminLoginAsRestaurant.status === 403);

console.log("\n4. Refresh-token rotation and logout");
const r1 = await call("/api/auth/refresh", { method: "POST", body: { refreshToken: rest.refreshToken } });
check("refresh returns new tokens", r1.status === 200 && !!r1.json.accessToken);
const reuse = await call("/api/auth/refresh", { method: "POST", body: { refreshToken: rest.refreshToken } });
check("old refresh token can't be reused", reuse.status === 401);
await call("/api/auth/logout", { method: "POST", body: { refreshToken: r1.json.refreshToken } });
const afterLogout = await call("/api/auth/refresh", { method: "POST", body: { refreshToken: r1.json.refreshToken } });
check("refresh token revoked after logout", afterLogout.status === 401);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
