import db from "../config/db.js";
import { refreshFoodStatuses, statusForExpiry } from "../services/expiryJob.js";
import { scoreMatch, loadNgoContext } from "../services/matchEngine.js";
import { recordAccess } from "../utils/recent.js";
import { logActivity } from "../utils/activity.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });

const SELECT = `
    SELECT d.*, f.name AS food_name, f.category, f.servings, f.quantity, f.unit, f.expiry_time,
           r.id AS restaurant_id, r.name AS restaurant_name, r.address AS restaurant_address, r.user_id AS restaurant_user_id,
           n.name AS ngo_name, n.address AS ngo_address, n.user_id AS ngo_user_id
    FROM donations d
    JOIN food_items f ON f.id = d.food_id
    JOIN restaurants r ON r.id = f.restaurant_id
    JOIN ngos n ON n.id = d.ngo_id`;

export const listDonations = async (req, res) => {
    try {
        await refreshFoodStatuses();
        const { role, restaurant_id, ngo_id } = req.user;
        let where = "", params = [];
        if (role === "restaurant") { where = "WHERE r.id = ?"; params = [restaurant_id]; }
        if (role === "ngo") { where = "WHERE n.id = ?"; params = [ngo_id]; }
        const [rows] = await db.query(`${SELECT} ${where} ORDER BY d.updated_at DESC, d.id DESC`, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("List donations error:", err);
        fail(res, 500, "Failed to fetch donations");
    }
};

export const getDonation = async (req, res) => {
    try {
        const [[d]] = await db.query(`${SELECT} WHERE d.id = ?`, [req.params.id]);
        if (!d) return fail(res, 404, "Donation not found.");
        const { role, restaurant_id, ngo_id } = req.user;
        if ((role === "restaurant" && d.restaurant_id !== restaurant_id) || (role === "ngo" && d.ngo_id !== ngo_id)) {
            return fail(res, 403, "Not your donation.");
        }
        await recordAccess(req.user.id, "donation", d.id, `${d.food_name} → ${d.ngo_name}`);
        res.json({ success: true, data: d });
    } catch (err) {
        console.error("Get donation error:", err);
        fail(res, 500, "Failed to fetch donation");
    }
};

/** POST /api/donations/claim { food_id } — an NGO claims food straight from its ranked feed. */
export const claimFood = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[food]] = await conn.query("SELECT * FROM food_items WHERE id = ? FOR UPDATE", [req.body.food_id]);
        if (!food) { await conn.rollback(); return fail(res, 404, "Food item not found."); }
        if (!["Available", "Expiring Soon"].includes(food.status) || new Date(food.expiry_time) <= new Date()) {
            await conn.rollback();
            return fail(res, 409, "Someone else already claimed this item, or it has expired.");
        }
        const [[rest]] = await conn.query("SELECT * FROM restaurants WHERE id = ?", [food.restaurant_id]);
        const [[ngo]] = await conn.query("SELECT * FROM ngos WHERE id = ?", [req.user.ngo_id]);
        const ctx = await loadNgoContext();
        const m = scoreMatch({ food, restaurant: rest, ngo, ctx });
        if (!m.feasible) {
            await conn.rollback();
            return res.status(422).json({ success: false, reason: m.reason, message: "You can't take this item in time." });
        }
        const [d] = await conn.query(
            `INSERT INTO donations (food_id, ngo_id, initiated_by, status, match_score) VALUES (?, ?, 'ngo', 'Accepted', ?)`,
            [food.id, ngo.id, m.score]);
        await conn.query("UPDATE food_items SET status = 'Reserved' WHERE id = ?", [food.id]);
        await conn.commit();
        await logActivity(req.user.id, "donation_claimed", `${ngo.name} claimed ${food.name}`);
        res.status(201).json({ success: true, donation_id: d.insertId });
    } catch (err) {
        await conn.rollback();
        console.error("Claim error:", err);
        fail(res, 500, "Could not claim this item");
    } finally {
        conn.release();
    }
};

// Who may move a donation from which status to which.
const TRANSITIONS = {
    Pending:     { ngo: ["Accepted", "Declined"], restaurant: ["Cancelled"] },
    Accepted:    { ngo: ["Picked Up", "Cancelled"], restaurant: ["Cancelled"] },
    "Picked Up": { ngo: ["Completed"], restaurant: ["Completed"] },
};

/** PATCH /api/donations/:id/status { status } */
export const updateStatus = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[d]] = await conn.query(
            `SELECT d.*, f.expiry_time, f.servings, f.name AS food_name, r.user_id AS r_user, n.user_id AS n_user
             FROM donations d JOIN food_items f ON f.id = d.food_id
             JOIN restaurants r ON r.id = f.restaurant_id JOIN ngos n ON n.id = d.ngo_id
             WHERE d.id = ? FOR UPDATE`, [req.params.id]);
        if (!d) { await conn.rollback(); return fail(res, 404, "Donation not found."); }

        const side = d.r_user === req.user.id ? "restaurant" : d.n_user === req.user.id ? "ngo" : null;
        if (!side) { await conn.rollback(); return fail(res, 403, "Not your donation."); }

        const allowed = TRANSITIONS[d.status]?.[side] || [];
        const next = req.body.status;
        if (!allowed.includes(next)) {
            await conn.rollback();
            return fail(res, 409, `You can't change a "${d.status}" donation to "${next}".`);
        }

        await conn.query(
            "UPDATE donations SET status = ?, servings_delivered = ? WHERE id = ?",
            [next, next === "Completed" ? d.servings : d.servings_delivered, d.id]);

        let foodStatus = null;
        if (next === "Completed") foodStatus = "Donated";
        if (["Declined", "Cancelled"].includes(next)) foodStatus = statusForExpiry(d.expiry_time);
        if (foodStatus) await conn.query("UPDATE food_items SET status = ? WHERE id = ?", [foodStatus, d.food_id]);

        await conn.commit();
        await logActivity(req.user.id, `donation_${next.toLowerCase().replace(" ", "_")}`, d.food_name);
        res.json({ success: true, status: next });
    } catch (err) {
        await conn.rollback();
        console.error("Update status error:", err);
        fail(res, 500, "Could not update the donation");
    } finally {
        conn.release();
    }
};
