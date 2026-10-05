import db from "../config/db.js";

const KEEP_PER_USER = 10;

// "Recently accessed": upsert the item with a fresh timestamp, keep only the newest 10.
export async function recordAccess(userId, type, id, title) {
    try {
        await db.query(
            `INSERT INTO recently_accessed (user_id, entity_type, entity_id, title, accessed_at)
             VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE title = VALUES(title), accessed_at = UTC_TIMESTAMP()`,
            [userId, type, id, String(title).slice(0, 190)]
        );
        await db.query(
            `DELETE FROM recently_accessed
             WHERE user_id = ? AND id NOT IN (
                SELECT id FROM (
                    SELECT id FROM recently_accessed WHERE user_id = ?
                    ORDER BY accessed_at DESC, id DESC LIMIT ${KEEP_PER_USER}
                ) keep
             )`,
            [userId, userId]
        );
    } catch (err) {
        console.error("Recent access failed:", err.message);
    }
}

export async function getRecent(userId, limit = 8) {
    const [rows] = await db.query(
        `SELECT entity_type, entity_id, title, accessed_at
         FROM recently_accessed WHERE user_id = ?
         ORDER BY accessed_at DESC, id DESC LIMIT ?`,
        [userId, limit]
    );
    return rows;
}
