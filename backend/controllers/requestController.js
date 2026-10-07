import db from "../config/db.js";
import { rankRequestsForFood } from "../services/matchEngine.js";
import { cents, fromCents } from "../services/allocationService.js";
import { logActivity } from "../utils/activity.js";
import { requestProblem } from "../utils/validate.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });

const withRemaining = (r) => ({
    ...r,
    remaining_quantity: Math.max(0, fromCents(cents(r.quantity) - cents(r.fulfilled_quantity))),
});

/** POST /api/requests — an NGO asks for food. */
export const createRequest = async (req, res) => {
    try {
        if (!req.user.ngo_id) return fail(res, 403, "Your account has no NGO profile.");
        const b = req.body || {};
        const input = { ...b, priority: b.priority ?? "Normal" };
        const problem = requestProblem(input);
        if (problem) return fail(res, 400, problem);

        const reason = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim().slice(0, 255) : null;
        const [r] = await db.query(
            `INSERT INTO food_requests (ngo_id, category, quantity, unit, servings_requested, priority, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.ngo_id, b.category, Math.round(Number(b.quantity) * 100) / 100, b.unit,
             Number(b.servings_requested), input.priority, reason]);

        await logActivity(req.user.id, "request_created", `${input.priority}: ${b.quantity} ${b.unit} ${b.category}`);
        res.status(201).json({ success: true, message: "Food request submitted.", request_id: r.insertId });
    } catch (err) {
        console.error("Create request error:", err);
        fail(res, 500, "Could not submit the request");
    }
};

/** GET /api/requests/my — only the signed-in NGO's own requests. */
export const listMyRequests = async (req, res) => {
    try {
        if (!req.user.ngo_id) return res.json({ success: true, data: [] });
        const [rows] = await db.query(
            "SELECT * FROM food_requests WHERE ngo_id = ? ORDER BY created_at DESC, id DESC", [req.user.ngo_id]);
        res.json({ success: true, data: rows.map(withRemaining) });
    } catch (err) {
        console.error("List requests error:", err);
        fail(res, 500, "Failed to fetch requests");
    }
};

/** PATCH /api/requests/:id/cancel — own Pending / Partially Fulfilled requests only. */
export const cancelRequest = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[r]] = await conn.query("SELECT * FROM food_requests WHERE id = ? FOR UPDATE", [req.params.id]);
        if (!r) { await conn.rollback(); return fail(res, 404, "Request not found."); }
        if (!req.user.ngo_id || r.ngo_id !== req.user.ngo_id) { await conn.rollback(); return fail(res, 403, "Not your request."); }
        if (!["Pending", "Partially Fulfilled"].includes(r.status)) {
            await conn.rollback();
            return fail(res, 409, `A ${r.status.toLowerCase()} request can't be cancelled.`);
        }
        await conn.query("UPDATE food_requests SET status = 'Cancelled' WHERE id = ?", [r.id]);
        await conn.commit();
        await logActivity(req.user.id, "request_cancelled", `Request #${r.id}`);
        res.json({ success: true, status: "Cancelled" });
    } catch (err) {
        await conn.rollback();
        console.error("Cancel request error:", err);
        fail(res, 500, "Could not cancel the request");
    } finally {
        conn.release();
    }
};

/**
 * GET /api/requests/open[?food_id=] — restaurant/admin view of requests still needing food,
 * Urgent -> High -> Normal then oldest first. With food_id (restaurant: its own food only)
 * the list is limited to requests that item can serve and shows what each NGO would receive.
 */
export const listOpenRequests = async (req, res) => {
    try {
        const foodId = req.query.food_id;
        if (foodId !== undefined && foodId !== "") {
            const [[food]] = await db.query("SELECT * FROM food_items WHERE id = ?", [foodId]);
            if (!food) return fail(res, 404, "Food item not found.");
            if (req.user.role === "restaurant" && food.restaurant_id !== req.user.restaurant_id) return fail(res, 403, "Not your listing.");

            let left = cents(food.remaining_quantity ?? food.quantity);
            const ranked = await rankRequestsForFood(food);
            const data = ranked.map(({ ngo, match, blocked, ...r }) => {
                const need = cents(r.quantity) - cents(r.fulfilled_quantity);
                const give = blocked ? 0 : Math.max(0, Math.min(left, need));
                left -= give;
                return {
                    ...withRemaining(r), ngo_name: ngo.name, ngo_address: ngo.address,
                    distance_km: match.distanceKm, can_serve: !blocked, skip_reason: blocked ? match.reason : null,
                    would_receive: fromCents(give),
                };
            });
            return res.json({ success: true, data });
        }

        const [rows] = await db.query(
            `SELECT fr.*, n.name AS ngo_name, n.address AS ngo_address
             FROM food_requests fr JOIN ngos n ON n.id = fr.ngo_id
             WHERE fr.status IN ('Pending','Partially Fulfilled') AND fr.fulfilled_quantity < fr.quantity
             ORDER BY FIELD(fr.priority,'Urgent','High','Normal'), fr.created_at ASC, fr.id ASC`);
        res.json({ success: true, data: rows.map(withRemaining) });
    } catch (err) {
        console.error("Open requests error:", err);
        fail(res, 500, "Failed to fetch open requests");
    }
};
