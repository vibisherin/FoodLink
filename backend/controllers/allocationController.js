import db from "../config/db.js";
import { loadNgoContext, rankRequestsForFood, scoreMatch } from "../services/matchEngine.js";
import { cents, fromCents, requestStatusFor, servingsFor } from "../services/allocationService.js";
import { logActivity } from "../utils/activity.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });

/**
 * POST /api/allocations { food_id }
 * Splits a restaurant's remaining food across open NGO requests, Urgent -> High -> Normal,
 * oldest first, partially fulfilling the last one if the food runs out. All-or-nothing.
 */
export const allocateFood = async (req, res) => {
    const foodId = Number(req.body?.food_id);
    if (!Number.isInteger(foodId) || foodId < 1) return fail(res, 400, "food_id is required.");
    if (!req.user.restaurant_id) return fail(res, 403, "Your account has no restaurant profile.");

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [[food]] = await conn.query("SELECT * FROM food_items WHERE id = ? FOR UPDATE", [foodId]);
        if (!food) { await conn.rollback(); return fail(res, 404, "Food item not found."); }
        if (food.restaurant_id !== req.user.restaurant_id) { await conn.rollback(); return fail(res, 403, "Not your listing."); }
        if (!["Available", "Expiring Soon"].includes(food.status) || new Date(food.expiry_time) <= new Date()) {
            await conn.rollback();
            return fail(res, 409, "This item is not available for allocation.");
        }

        const foodQtyC = cents(food.quantity);
        let leftC = cents(food.remaining_quantity ?? food.quantity);
        if (leftC <= 0) { await conn.rollback(); return fail(res, 409, "Nothing is left to allocate from this item."); }

        const ctx = await loadNgoContext();
        const [[restaurant]] = await conn.query("SELECT * FROM restaurants WHERE id = ?", [food.restaurant_id]);
        const open = await rankRequestsForFood(food, { conn, restaurant, ctx, lock: true });

        const allocations = [], skipped = [];
        for (const r of open) {
            if (leftC <= 0) break;
            const needC = cents(r.quantity) - cents(r.fulfilled_quantity);
            if (needC <= 0 || !["Pending", "Partially Fulfilled"].includes(r.status)) continue;

            const m = scoreMatch({ food, restaurant, ngo: r.ngo, ctx }); // ctx tracks meals already given this run
            if (!m.feasible && ["out_of_radius", "cannot_arrive_in_time", "capacity_full"].includes(m.reason)) {
                skipped.push({ request_id: r.id, ngo: r.ngo.name, reason: m.reason });
                continue;
            }

            const giveC = Math.min(leftC, needC);
            const give = fromCents(giveC);
            const servings = servingsFor(food.servings, fromCents(foodQtyC), give);
            const newFulfilled = fromCents(cents(r.fulfilled_quantity) + giveC);
            const status = requestStatusFor(r.quantity, newFulfilled, r.status);

            await conn.query(
                `UPDATE food_requests SET fulfilled_quantity = ?, fulfilled_servings = fulfilled_servings + ?, status = ? WHERE id = ?`,
                [newFulfilled, servings, status, r.id]);
            const [d] = await conn.query(
                `INSERT INTO donations (food_id, ngo_id, initiated_by, request_id, quantity_delivered, unit_delivered, status, match_score)
                 VALUES (?, ?, 'restaurant', ?, ?, ?, 'Accepted', ?)`,
                [food.id, r.ngo_id, r.id, give, food.unit, m.feasible ? m.score : null]);

            ctx.committed.set(r.ngo_id, (ctx.committed.get(r.ngo_id) || 0) + servings);
            leftC -= giveC;
            allocations.push({
                donation_id: d.insertId, request_id: r.id, ngo_id: r.ngo_id, ngo_name: r.ngo.name, priority: r.priority,
                allocated: give, unit: food.unit, request_status: status, request_remaining: fromCents(needC - giveC),
            });
        }

        if (!allocations.length) {
            await conn.rollback();
            return res.json({
                success: true, allocations: [], skipped, food_remaining: fromCents(leftC),
                message: open.length ? "No NGO that has an open request could take this food in time." : "No open NGO requests match this food.",
            });
        }

        const remaining = fromCents(leftC);
        await conn.query(
            "UPDATE food_items SET remaining_quantity = ?, status = ? WHERE id = ?",
            [remaining, leftC === 0 ? "Reserved" : food.status, food.id]);
        await conn.commit();

        const total = allocations.reduce((s, a) => s + a.allocated, 0);
        await logActivity(req.user.id, "food_allocated", `${food.name}: ${total} ${food.unit} to ${allocations.length} NGO request(s)`);
        res.status(201).json({
            success: true, allocations, skipped, food_remaining: remaining,
            message: `Allocated ${total} ${food.unit} to ${allocations.length} NGO request${allocations.length > 1 ? "s" : ""}.`,
        });
    } catch (err) {
        await conn.rollback();
        console.error("Allocation error:", err);
        fail(res, 500, "Could not allocate this food");
    } finally {
        conn.release();
    }
};
