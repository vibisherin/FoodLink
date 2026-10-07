import db from "../config/db.js";
import { releaseRequestShare } from "./allocationService.js";

/**
 * Keeps food status truthful without anyone clicking anything.
 * Runs at start-up, every minute, and before listings are served.
 */
export async function refreshFoodStatuses() {
    await cancelSpoiledOffers();
    await db.query(
        `UPDATE food_items SET status = 'Expired'
         WHERE status IN ('Available','Expiring Soon','Reserved')
           AND expiry_time <= UTC_TIMESTAMP()
           AND id NOT IN (SELECT food_id FROM donations WHERE status = 'Picked Up')`
    );
    await db.query(
        `UPDATE food_items SET status = 'Expiring Soon'
         WHERE status = 'Available'
           AND expiry_time > UTC_TIMESTAMP()
           AND expiry_time <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR)`
    );
}

// Open offers on food that has now spoiled are cancelled; any quantity that was
// allocated from an NGO request goes back to that request. Row locks stop two
// overlapping runs from releasing the same share twice.
async function cancelSpoiledOffers() {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT d.id, d.request_id, d.quantity_delivered, f.servings AS food_servings, f.quantity AS food_quantity
             FROM donations d JOIN food_items f ON f.id = d.food_id
             WHERE d.status IN ('Pending','Accepted') AND f.expiry_time <= UTC_TIMESTAMP()
             FOR UPDATE`);
        for (const d of rows) {
            await conn.query("UPDATE donations SET status = 'Cancelled' WHERE id = ?", [d.id]);
            await releaseRequestShare(conn, d);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

export function startExpiryJob() {
    const run = () => refreshFoodStatuses().catch((e) => console.error("Expiry job:", e.message));
    run();
    return setInterval(run, 60 * 1000);
}

export function statusForExpiry(expiryTime) {
    const ms = new Date(expiryTime).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    if (ms <= 24 * 3600 * 1000) return "Expiring Soon";
    return "Available";
}
