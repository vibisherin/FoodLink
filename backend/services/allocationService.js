/**
 * Shared helpers for NGO food requests <-> food allocations.
 * Money-style maths is done in integer hundredths so 0.1 + 0.2 never drifts.
 */
export const cents = (n) => Math.round(Number(n) * 100);
export const fromCents = (c) => c / 100;

/** Servings that correspond to `qty` of a food item (pro-rata of its total). */
export function servingsFor(foodServings, foodQuantity, qty) {
    if (!(Number(foodQuantity) > 0)) return 0;
    return Math.max(0, Math.round((Number(foodServings) * Number(qty)) / Number(foodQuantity)));
}

/** Request status derived from its quantities. A cancelled request stays cancelled. */
export function requestStatusFor(quantity, fulfilled, current) {
    if (current === "Cancelled") return "Cancelled";
    const f = cents(fulfilled);
    if (f <= 0) return "Pending";
    return f >= cents(quantity) ? "Fulfilled" : "Partially Fulfilled";
}

/**
 * Give an allocated share back to its request (donation cancelled/declined or the
 * food spoiled), so another restaurant can fulfil it. Call inside a transaction.
 */
export async function releaseRequestShare(conn, d) {
    if (!d.request_id || d.quantity_delivered == null) return;
    const [[req]] = await conn.query("SELECT * FROM food_requests WHERE id = ? FOR UPDATE", [d.request_id]);
    if (!req) return;
    const fulfilled = Math.max(0, fromCents(cents(req.fulfilled_quantity) - cents(d.quantity_delivered)));
    const servings = Math.max(0, req.fulfilled_servings - servingsFor(d.food_servings, d.food_quantity, d.quantity_delivered));
    await conn.query(
        "UPDATE food_requests SET fulfilled_quantity = ?, fulfilled_servings = ?, status = ? WHERE id = ?",
        [fulfilled, servings, requestStatusFor(req.quantity, fulfilled, req.status), req.id]);
}
