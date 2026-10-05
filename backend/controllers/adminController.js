import db from "../config/db.js";
import { refreshFoodStatuses } from "../services/expiryJob.js";
import { impactFromMeals } from "./dashboardController.js";
import { logActivity } from "../utils/activity.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const toNum = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)]));

export const getStats = async (req, res) => {
    try {
        await refreshFoodStatuses();
        const [[users]] = await db.query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(role='restaurant'),0) AS restaurants, COALESCE(SUM(role='ngo'),0) AS ngos,
                    COALESCE(SUM(role='admin'),0) AS admins, COALESCE(SUM(is_active=0),0) AS disabled FROM users`);
        const [[food]] = await db.query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(status='Available'),0) AS available, COALESCE(SUM(status='Expiring Soon'),0) AS expiring,
                    COALESCE(SUM(status='Reserved'),0) AS reserved, COALESCE(SUM(status='Donated'),0) AS donated,
                    COALESCE(SUM(status='Expired'),0) AS expired FROM food_items`);
        const [[don]] = await db.query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(status='Pending'),0) AS pending,
                    COALESCE(SUM(status IN ('Accepted','Picked Up')),0) AS active,
                    COALESCE(SUM(status='Completed'),0) AS completed,
                    COALESCE(SUM(status IN ('Declined','Cancelled')),0) AS failed FROM donations`);
        const [[m]] = await db.query(
            `SELECT COALESCE(SUM(f.servings),0) AS meals FROM donations d JOIN food_items f ON f.id = d.food_id WHERE d.status='Completed'`);
        const [perDay] = await db.query(
            `SELECT DATE_FORMAT(d.created_at, '%Y-%m-%d') AS day, COUNT(*) AS donations,
                    COALESCE(SUM(CASE WHEN d.status='Completed' THEN f.servings END),0) AS meals
             FROM donations d JOIN food_items f ON f.id = d.food_id
             WHERE d.created_at >= DATE_SUB(UTC_DATE(), INTERVAL 13 DAY)
             GROUP BY day ORDER BY day`);
        const [topRestaurants] = await db.query(
            `SELECT r.name, COALESCE(SUM(f.servings),0) AS meals FROM donations d
             JOIN food_items f ON f.id = d.food_id JOIN restaurants r ON r.id = f.restaurant_id
             WHERE d.status='Completed' GROUP BY r.id ORDER BY meals DESC LIMIT 5`);
        const [topNgos] = await db.query(
            `SELECT n.name, COALESCE(SUM(f.servings),0) AS meals FROM donations d
             JOIN food_items f ON f.id = d.food_id JOIN ngos n ON n.id = d.ngo_id
             WHERE d.status='Completed' GROUP BY n.id ORDER BY meals DESC LIMIT 5`);
        res.json({
            success: true,
            data: {
                users: toNum(users), food: toNum(food), donations: toNum(don),
                impact: impactFromMeals(Number(m.meals)),
                perDay: perDay.map((r) => ({ day: r.day, donations: Number(r.donations), meals: Number(r.meals) })),
                topRestaurants: topRestaurants.map((r) => ({ name: r.name, meals: Number(r.meals) })),
                topNgos: topNgos.map((r) => ({ name: r.name, meals: Number(r.meals) })),
            },
        });
    } catch (err) {
        console.error("Admin stats error:", err);
        fail(res, 500, "Failed to load statistics");
    }
};

export const listUsers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email, u.role, u.is_active, u.last_login_at, u.created_at,
                    (u.google_id IS NOT NULL) AS google_linked,
                    COALESCE(r.name, n.name) AS organisation
             FROM users u LEFT JOIN restaurants r ON r.user_id = u.id LEFT JOIN ngos n ON n.user_id = u.id
             ORDER BY FIELD(u.role,'admin','restaurant','ngo'), u.name`);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("List users error:", err);
        fail(res, 500, "Failed to fetch users");
    }
};

export const setUserActive = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (id === req.user.id) return fail(res, 400, "You can't disable your own account.");
        const [[u]] = await db.query("SELECT id, role, name FROM users WHERE id = ?", [id]);
        if (!u) return fail(res, 404, "User not found.");
        if (u.role === "admin") return fail(res, 403, "Administrator accounts can't be disabled here.");
        const active = req.body.is_active ? 1 : 0;
        await db.query("UPDATE users SET is_active = ? WHERE id = ?", [active, id]);
        if (!active) await db.query("DELETE FROM refresh_tokens WHERE user_id = ?", [id]);
        await logActivity(req.user.id, active ? "user_enabled" : "user_disabled", u.name);
        res.json({ success: true });
    } catch (err) {
        console.error("Set user active error:", err);
        fail(res, 500, "Could not update the user");
    }
};

export const listActivity = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name, u.role AS user_role
             FROM activity_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 40`);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("Activity error:", err);
        fail(res, 500, "Failed to fetch activity");
    }
};
