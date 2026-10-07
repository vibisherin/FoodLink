import db from "../config/db.js";
import { haversineKm, loadNgoContext, reliabilityOf } from "../services/matchEngine.js";
import { recordAccess } from "../utils/recent.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });

async function ngoStats(ngoId) {
    const [[s]] = await db.query(
        `SELECT COALESCE(SUM(d.status='Completed'),0) AS completed,
                COALESCE(SUM(d.status='Declined'),0) AS declined,
                COALESCE(SUM(CASE WHEN d.status='Completed' THEN f.servings END),0) AS meals
         FROM donations d JOIN food_items f ON f.id = d.food_id WHERE d.ngo_id = ?`, [ngoId]);
    return { completed: Number(s.completed), declined: Number(s.declined), meals: Number(s.meals) };
}

/** GET /api/ngos — partner list with distance from the calling restaurant. */
export const listNgos = async (req, res) => {
    try {
        const [ngos] = await db.query(
            "SELECT n.* FROM ngos n JOIN users u ON u.id = n.user_id WHERE u.is_active = 1 ORDER BY n.name");
        let origin = null;
        if (req.user.role === "restaurant") {
            const [[r]] = await db.query("SELECT latitude, longitude FROM restaurants WHERE id = ?", [req.user.restaurant_id]);
            if (r?.latitude != null) origin = r;
        }
        const ctx = await loadNgoContext();
        const data = ngos.map((n) => ({
            ...n,
            distance_km: origin && n.latitude != null
                ? Math.round(haversineKm(Number(origin.latitude), Number(origin.longitude), Number(n.latitude), Number(n.longitude)) * 10) / 10
                : null,
            reliability: Math.round(reliabilityOf(ctx.history, n.id) * 100),
        })).sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
        res.json({ success: true, data });
    } catch (err) {
        console.error("List NGOs error:", err);
        fail(res, 500, "Failed to fetch NGOs");
    }
};

export const getNgo = async (req, res) => {
    try {
        const [[ngo]] = await db.query("SELECT * FROM ngos WHERE id = ?", [req.params.id]);
        if (!ngo) return fail(res, 404, "NGO not found.");
        const ctx = await loadNgoContext();
        const stats = await ngoStats(ngo.id);
        await recordAccess(req.user.id, "ngo", ngo.id, ngo.name);
        res.json({
            success: true,
            data: { ...ngo, ...stats, reliability: Math.round(reliabilityOf(ctx.history, ngo.id) * 100),
                    committed_today: ctx.committed.get(ngo.id) || 0 },
        });
    } catch (err) {
        console.error("Get NGO error:", err);
        fail(res, 500, "Failed to fetch NGO");
    }
};
