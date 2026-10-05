import db from "../config/db.js";

/**
 * Keeps food status truthful without anyone clicking anything.
 * Runs at start-up, every minute, and before listings are served.
 */
export async function refreshFoodStatuses() {
    // Open offers on food that has now spoiled are cancelled.
    await db.query(
        `UPDATE donations d JOIN food_items f ON f.id = d.food_id
         SET d.status = 'Cancelled'
         WHERE d.status IN ('Pending','Accepted') AND f.expiry_time <= UTC_TIMESTAMP()`
    );
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
