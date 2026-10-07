import db from "../config/db.js";
import { config } from "../config/env.js";
import { refreshFoodStatuses } from "../services/expiryJob.js";
import { loadNgoContext } from "../services/matchEngine.js";
import { getRecent } from "../utils/recent.js";

export function impactFromMeals(meals) {
    const kg = meals * config.impact.kgPerMeal;
    return { meals, kgFoodSaved: Math.round(kg * 10) / 10, co2AvoidedKg: Math.round(kg * config.impact.co2KgPerKgFood * 10) / 10 };
}

export async function summaryFor(user) {
    await refreshFoodStatuses();
    if (user.role === "restaurant") {
        const [[s]] = await db.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(status='Available'),0) AS available,
                    COALESCE(SUM(status='Expiring Soon'),0) AS expiring,
                    COALESCE(SUM(status='Reserved'),0) AS reserved,
                    COALESCE(SUM(status='Donated'),0) AS donated,
                    COALESCE(SUM(status='Expired'),0) AS expired
             FROM food_items WHERE restaurant_id = ?`, [user.restaurant_id]);
        const [[m]] = await db.query(
            `SELECT COALESCE(SUM(f.servings),0) AS meals FROM donations d JOIN food_items f ON f.id = d.food_id
             WHERE f.restaurant_id = ? AND d.status = 'Completed'`, [user.restaurant_id]);
        return { role: "restaurant", counts: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)])), impact: impactFromMeals(Number(m.meals)) };
    }
    if (user.role === "ngo") {
        const [[ngo]] = await db.query("SELECT daily_capacity_meals FROM ngos WHERE id = ?", [user.ngo_id]);
        const ctx = await loadNgoContext();
        const [[open]] = await db.query(
            `SELECT COUNT(*) AS c FROM food_items WHERE status IN ('Available','Expiring Soon') AND expiry_time > UTC_TIMESTAMP()
               AND COALESCE(remaining_quantity, quantity) >= quantity`);
        const [[d]] = await db.query(
            `SELECT COALESCE(SUM(status='Pending'),0) AS pending,
                    COALESCE(SUM(status IN ('Accepted','Picked Up')),0) AS active,
                    COALESCE(SUM(status='Completed'),0) AS completed
             FROM donations WHERE ngo_id = ?`, [user.ngo_id]);
        const [[m]] = await db.query(
            `SELECT COALESCE(SUM(f.servings),0) AS meals FROM donations d JOIN food_items f ON f.id = d.food_id
             WHERE d.ngo_id = ? AND d.status = 'Completed'`, [user.ngo_id]);
        const used = ctx.committed.get(user.ngo_id) || 0;
        return {
            role: "ngo",
            counts: { openFood: Number(open.c), pending: Number(d.pending), active: Number(d.active), completed: Number(d.completed) },
            capacity: { daily: ngo.daily_capacity_meals, usedToday: used, remaining: Math.max(0, ngo.daily_capacity_meals - used) },
            impact: impactFromMeals(Number(m.meals)),
        };
    }
    return { role: "admin" };
}

export const getSummary = async (req, res) => {
    try {
        res.json({ success: true, data: await summaryFor(req.user) });
    } catch (err) {
        console.error("Summary error:", err);
        res.status(500).json({ success: false, message: "Failed to load dashboard summary" });
    }
};

export const getRecentAccess = async (req, res) => {
    try {
        res.json({ success: true, data: await getRecent(req.user.id, 8) });
    } catch (err) {
        console.error("Recent error:", err);
        res.status(500).json({ success: false, message: "Failed to load recently accessed items" });
    }
};
