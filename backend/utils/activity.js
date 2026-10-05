import db from "../config/db.js";

// Fire-and-forget audit trail shown on the admin dashboard.
export async function logActivity(userId, action, details = null) {
    try {
        await db.query("INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)", [
            userId ?? null,
            action,
            details ? String(details).slice(0, 250) : null,
        ]);
    } catch (err) {
        console.error("Activity log failed:", err.message);
    }
}
