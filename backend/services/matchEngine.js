/**
 * SmartMatch — FoodLink's expiry-aware NGO matching engine.
 *
 * For a surplus food item it answers: "Which NGO can actually get this food
 * to people before it spoils, and who is the best choice?"
 *
 * Hard filters (NGO is excluded, with a reason):
 *   - location missing, category not accepted, outside service radius,
 *   - cannot physically arrive before expiry (travel time + handling buffer),
 *   - no meal capacity left today.
 * Soft score (0–100) for the NGOs that pass:
 *   proximity 35% · time safety 25% · capacity headroom 20% · reliability 20%
 */
import db from "../config/db.js";

export const WEIGHTS = { proximity: 0.35, timeSafety: 0.25, capacity: 0.2, reliability: 0.2 };
const SPEED_KMH = { vehicle: 30, onFoot: 12 }; // average urban speed
const HANDLING_MIN = 20;                        // packing + loading buffer
const COMFORT_MARGIN_MIN = 120;                 // 2h spare = full time-safety score

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Per-NGO context: meals already committed today + acceptance history. */
export async function loadNgoContext() {
    const [load] = await db.query(
        `SELECT d.ngo_id, COALESCE(SUM(f.servings), 0) AS committed
         FROM donations d JOIN food_items f ON f.id = d.food_id
         WHERE d.status IN ('Pending','Accepted','Picked Up','Completed')
           AND DATE(d.created_at) = UTC_DATE()
         GROUP BY d.ngo_id`
    );
    const [hist] = await db.query(
        `SELECT ngo_id,
                SUM(status = 'Completed') AS completed,
                SUM(status = 'Declined')  AS declined
         FROM donations GROUP BY ngo_id`
    );
    const committed = new Map(load.map((r) => [r.ngo_id, Number(r.committed)]));
    const history = new Map(hist.map((r) => [r.ngo_id, { completed: Number(r.completed), declined: Number(r.declined) }]));
    return { committed, history };
}

export function reliabilityOf(history, ngoId) {
    const h = history.get(ngoId) || { completed: 0, declined: 0 };
    // Laplace smoothing: a new NGO starts at 0.5 instead of 0 or 1.
    return (h.completed + 1) / (h.completed + h.declined + 2);
}

export function scoreMatch({ food, restaurant, ngo, ctx, now = Date.now() }) {
    const out = { ngoId: ngo.id, feasible: false, reason: null, score: 0, breakdown: null,
                  distanceKm: null, etaMinutes: null, minutesToExpiry: null };

    const rLat = Number(restaurant.latitude), rLng = Number(restaurant.longitude);
    const nLat = Number(ngo.latitude), nLng = Number(ngo.longitude);
    if (restaurant.latitude == null || restaurant.longitude == null || ngo.latitude == null || ngo.longitude == null) {
        out.reason = "location_missing";
        return out;
    }

    const distanceKm = haversineKm(rLat, rLng, nLat, nLng);
    out.distanceKm = round(distanceKm, 1);

    const accepted = String(ngo.accepted_categories || "").split(",").map((s) => s.trim());
    if (!accepted.includes(food.category)) { out.reason = "category_not_accepted"; return out; }

    const maxRadius = Number(ngo.max_radius_km);
    if (distanceKm > maxRadius) { out.reason = "out_of_radius"; return out; }

    const speed = ngo.has_vehicle ? SPEED_KMH.vehicle : SPEED_KMH.onFoot;
    const etaMinutes = (distanceKm / speed) * 60 + HANDLING_MIN;
    const minutesToExpiry = (new Date(food.expiry_time).getTime() - now) / 60000;
    out.etaMinutes = Math.round(etaMinutes);
    out.minutesToExpiry = Math.round(minutesToExpiry);

    const margin = minutesToExpiry - etaMinutes;
    if (margin <= 0) { out.reason = "cannot_arrive_in_time"; return out; }

    const remaining = Number(ngo.daily_capacity_meals) - (ctx.committed.get(ngo.id) || 0);
    if (remaining <= 0) { out.reason = "capacity_full"; return out; }

    const breakdown = {
        proximity: clamp01(1 - distanceKm / maxRadius),
        timeSafety: clamp01(margin / COMFORT_MARGIN_MIN),
        capacity: clamp01(remaining / Number(food.servings)),
        reliability: reliabilityOf(ctx.history, ngo.id),
    };
    const score = 100 * Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * breakdown[k], 0);

    out.feasible = true;
    out.score = round(score, 1);
    out.breakdown = Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, Math.round(v * 100)]));
    out.capacityRemaining = remaining;
    return out;
}

/** Rank every NGO for one food item (restaurant view). */
export async function rankNgosForFood(food, restaurant) {
    const [ngos] = await db.query(
        `SELECT n.*, u.name AS contact_name FROM ngos n JOIN users u ON u.id = n.user_id WHERE u.is_active = 1`
    );
    const ctx = await loadNgoContext();
    const results = ngos.map((ngo) => ({
        ngo: { id: ngo.id, name: ngo.name, address: ngo.address, has_vehicle: !!ngo.has_vehicle },
        ...scoreMatch({ food, restaurant, ngo, ctx }),
    }));
    return results.sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.score - a.score);
}

/** Ranked open-food feed for one NGO (used by the chatbot; the REST feed uses the same scoring). */
export async function rankFeedForNgo(ngoId, limit = 3) {
    const [[ngo]] = await db.query("SELECT * FROM ngos WHERE id = ?", [ngoId]);
    const [rows] = await db.query(
        `SELECT f.*, r.name AS restaurant_name, r.latitude AS restaurant_lat, r.longitude AS restaurant_lng
         FROM food_items f JOIN restaurants r ON r.id = f.restaurant_id
         WHERE f.status IN ('Available','Expiring Soon') AND f.expiry_time > UTC_TIMESTAMP()`);
    const ctx = await loadNgoContext();
    return rows
        .map((f) => ({ ...f, match: scoreMatch({ food: f, restaurant: { latitude: f.restaurant_lat, longitude: f.restaurant_lng }, ngo, ctx }) }))
        .filter((f) => f.match.feasible)
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, limit);
}
