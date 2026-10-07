import db from "../config/db.js";
import { refreshFoodStatuses, statusForExpiry } from "../services/expiryJob.js";
import { rankNgosForFood, scoreMatch, loadNgoContext } from "../services/matchEngine.js";
import { recordAccess } from "../utils/recent.js";
import { logActivity } from "../utils/activity.js";
import { foodProblem } from "../utils/validate.js";
import { cents } from "../services/allocationService.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const ACTIVE_DONATION = ["Pending", "Accepted", "Picked Up"];

async function getFoodWithRestaurant(id) {
    const [rows] = await db.query(
        `SELECT f.*, r.name AS restaurant_name, r.address AS restaurant_address, r.city AS restaurant_city,
                r.latitude AS restaurant_lat, r.longitude AS restaurant_lng, r.user_id AS restaurant_user_id
         FROM food_items f JOIN restaurants r ON r.id = f.restaurant_id WHERE f.id = ?`, [id]);
    return rows[0];
}

const restaurantOf = (f) => ({ latitude: f.restaurant_lat, longitude: f.restaurant_lng });

/**
 * GET /api/food
 *  restaurant -> own inventory
 *  ngo        -> open food ranked by SmartMatch score for THIS ngo (infeasible items hidden)
 *  admin      -> everything
 */
export const getFoodItems = async (req, res) => {
    try {
        await refreshFoodStatuses();
        const { role, restaurant_id, ngo_id } = req.user;

        if (role === "restaurant") {
            const [rows] = await db.query(
                `SELECT f.*, r.name AS restaurant_name,
                    (SELECT d.id FROM donations d WHERE d.food_id = f.id AND d.status IN ('Pending','Accepted','Picked Up') ORDER BY d.id DESC LIMIT 1) AS active_donation_id,
                    (SELECT d.status FROM donations d WHERE d.food_id = f.id AND d.status IN ('Pending','Accepted','Picked Up') ORDER BY d.id DESC LIMIT 1) AS active_donation_status,
                    (SELECT n.name FROM donations d JOIN ngos n ON n.id = d.ngo_id WHERE d.food_id = f.id AND d.status IN ('Pending','Accepted','Picked Up') ORDER BY d.id DESC LIMIT 1) AS active_ngo_name
                 FROM food_items f JOIN restaurants r ON r.id = f.restaurant_id
                 WHERE f.restaurant_id = ? ORDER BY f.expiry_time ASC`, [restaurant_id]);
            return res.json({ success: true, data: rows });
        }

        if (role === "ngo") {
            const [[ngo]] = await db.query("SELECT * FROM ngos WHERE id = ?", [ngo_id]);
            const [rows] = await db.query(
                `SELECT f.*, r.name AS restaurant_name, r.address AS restaurant_address,
                        r.latitude AS restaurant_lat, r.longitude AS restaurant_lng
                 FROM food_items f JOIN restaurants r ON r.id = f.restaurant_id
                 WHERE f.status IN ('Available','Expiring Soon') AND f.expiry_time > UTC_TIMESTAMP()
                   AND COALESCE(f.remaining_quantity, f.quantity) >= f.quantity`);
            const ctx = await loadNgoContext();
            const ranked = rows
                .map((f) => ({ ...f, match: scoreMatch({ food: f, restaurant: restaurantOf(f), ngo, ctx }) }))
                .sort((a, b) => Number(b.match.feasible) - Number(a.match.feasible) || b.match.score - a.match.score);
            return res.json({ success: true, data: ranked });
        }

        const [rows] = await db.query(
            `SELECT f.*, r.name AS restaurant_name FROM food_items f
             JOIN restaurants r ON r.id = f.restaurant_id ORDER BY f.created_at DESC`);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Get Food Error:", error);
        fail(res, 500, "Failed to fetch food items");
    }
};

/** GET /api/food/:id — also records the item in "recently accessed". */
export const getFoodItem = async (req, res) => {
    try {
        await refreshFoodStatuses();
        const food = await getFoodWithRestaurant(req.params.id);
        if (!food) return fail(res, 404, "Food item not found.");
        const { role, restaurant_id } = req.user;
        if (role === "restaurant" && food.restaurant_id !== restaurant_id) return fail(res, 403, "Not your listing.");

        const [donations] = await db.query(
            `SELECT d.id, d.status, d.match_score, d.created_at, n.name AS ngo_name
             FROM donations d JOIN ngos n ON n.id = d.ngo_id WHERE d.food_id = ? ORDER BY d.id DESC`, [food.id]);
        await recordAccess(req.user.id, "food", food.id, food.name);
        res.json({ success: true, data: { ...food, donations } });
    } catch (error) {
        console.error("Get food item error:", error);
        fail(res, 500, "Failed to fetch food item");
    }
};

export const addFoodItem = async (req, res) => {
    try {
        const b = req.body;
        const problem = foodProblem(b);
        if (problem) return fail(res, 400, problem);

        const expiry = new Date(b.expiry_time);
        const [result] = await db.query(
            `INSERT INTO food_items (restaurant_id, name, category, quantity, remaining_quantity, unit, servings, expiry_time, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.restaurant_id, b.name.trim(), b.category, Number(b.quantity), Number(b.quantity), b.unit,
             Number(b.servings), expiry, statusForExpiry(expiry), b.notes?.slice(0, 250) || null]);

        await logActivity(req.user.id, "food_added", `${b.name.trim()} (${b.servings} servings)`);
        res.status(201).json({ success: true, message: "Food item added successfully", food_id: result.insertId });
    } catch (error) {
        console.error("Add Food Error:", error);
        fail(res, 500, "Failed to add food item");
    }
};

export const updateFoodItem = async (req, res) => {
    try {
        const food = await getFoodWithRestaurant(req.params.id);
        if (!food) return fail(res, 404, "Food item not found.");
        if (food.restaurant_id !== req.user.restaurant_id) return fail(res, 403, "Not your listing.");
        if (["Reserved", "Donated"].includes(food.status)) {
            return fail(res, 409, `A ${food.status.toLowerCase()} item can't be edited.`);
        }
        const b = { ...food, ...req.body };
        const problem = foodProblem(b);
        if (problem) return fail(res, 400, problem);

        // Once part of an item is allocated to NGO requests its size/type is fixed.
        const partlyAllocated = food.remaining_quantity != null && cents(food.remaining_quantity) < cents(food.quantity);
        if (partlyAllocated && (Number(b.quantity) !== Number(food.quantity) || b.unit !== food.unit || b.category !== food.category)) {
            return fail(res, 409, "Part of this item is already allocated to NGO requests, so its quantity, unit and category can't change.");
        }
        const expiry = new Date(b.expiry_time);
        await db.query(
            `UPDATE food_items SET name=?, category=?, quantity=?, remaining_quantity=?, unit=?, servings=?, expiry_time=?, status=?, notes=? WHERE id=?`,
            [b.name.trim(), b.category, Number(b.quantity), partlyAllocated ? food.remaining_quantity : Number(b.quantity), b.unit, Number(b.servings), expiry,
             statusForExpiry(expiry), b.notes?.slice(0, 250) || null, food.id]);
        await logActivity(req.user.id, "food_updated", b.name.trim());
        res.json({ success: true, message: "Food item updated" });
    } catch (error) {
        console.error("Update food error:", error);
        fail(res, 500, "Failed to update food item");
    }
};

export const deleteFoodItem = async (req, res) => {
    try {
        const food = await getFoodWithRestaurant(req.params.id);
        if (!food) return fail(res, 404, "Food item not found.");
        if (food.restaurant_id !== req.user.restaurant_id) return fail(res, 403, "Not your listing.");
        const [active] = await db.query(
            `SELECT id FROM donations WHERE food_id = ? AND status IN (?)`, [food.id, ACTIVE_DONATION]);
        if (active.length) return fail(res, 409, "This item has an active donation. Cancel the donation first.");
        await db.query("DELETE FROM food_items WHERE id = ?", [food.id]);
        await logActivity(req.user.id, "food_removed", food.name);
        res.json({ success: true, message: "Food item removed" });
    } catch (error) {
        console.error("Delete food error:", error);
        fail(res, 500, "Failed to remove food item");
    }
};

/** GET /api/food/:id/matches — SmartMatch ranking of NGOs for one item. */
export const getMatches = async (req, res) => {
    try {
        const food = await getFoodWithRestaurant(req.params.id);
        if (!food) return fail(res, 404, "Food item not found.");
        if (req.user.role === "restaurant" && food.restaurant_id !== req.user.restaurant_id) return fail(res, 403, "Not your listing.");
        const matches = await rankNgosForFood(food, restaurantOf(food));
        res.json({ success: true, data: { food_id: food.id, matches } });
    } catch (error) {
        console.error("Matches error:", error);
        fail(res, 500, "Could not compute matches");
    }
};

/** POST /api/food/:id/offer { ngo_id } — restaurant offers the item to a chosen NGO. */
export const offerToNgo = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[food]] = await conn.query("SELECT * FROM food_items WHERE id = ? FOR UPDATE", [req.params.id]);
        if (!food) { await conn.rollback(); return fail(res, 404, "Food item not found."); }
        if (food.restaurant_id !== req.user.restaurant_id) { await conn.rollback(); return fail(res, 403, "Not your listing."); }
        if (!["Available", "Expiring Soon"].includes(food.status)) {
            await conn.rollback();
            return fail(res, 409, `This item is ${food.status.toLowerCase()} and can't be offered.`);
        }

        if (food.remaining_quantity != null && cents(food.remaining_quantity) < cents(food.quantity)) {
            await conn.rollback();
            return fail(res, 409, "Part of this item is already allocated to NGO requests. Use Allocate Food for the rest.");
        }
        const [[ngo]] = await conn.query(
            "SELECT n.* FROM ngos n JOIN users u ON u.id = n.user_id WHERE n.id = ? AND u.is_active = 1", [req.body.ngo_id]);
        if (!ngo) { await conn.rollback(); return fail(res, 404, "NGO not found."); }
        const [[rest]] = await conn.query("SELECT * FROM restaurants WHERE id = ?", [food.restaurant_id]);

        const ctx = await loadNgoContext();
        const m = scoreMatch({ food, restaurant: rest, ngo, ctx });
        if (!m.feasible) { await conn.rollback(); return res.status(422).json({ success: false, reason: m.reason, message: "This NGO can't take this item in time." }); }

        const [d] = await conn.query(
            `INSERT INTO donations (food_id, ngo_id, initiated_by, status, match_score) VALUES (?, ?, 'restaurant', 'Pending', ?)`,
            [food.id, ngo.id, m.score]);
        await conn.query("UPDATE food_items SET status = 'Reserved' WHERE id = ?", [food.id]);
        await conn.commit();

        await logActivity(req.user.id, "donation_offered", `${food.name} → ${ngo.name} (score ${m.score})`);
        res.status(201).json({ success: true, donation_id: d.insertId, match_score: m.score });
    } catch (error) {
        await conn.rollback();
        console.error("Offer error:", error);
        fail(res, 500, "Could not create the offer");
    } finally {
        conn.release();
    }
};
