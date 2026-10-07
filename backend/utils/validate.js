export const CATEGORIES = ["cooked", "bakery", "produce", "dairy", "packaged"];
export const UNITS = ["kg", "litres", "packs", "plates"];
export const PRIORITIES = ["Urgent", "High", "Normal"];
export const LANGS = ["en", "hi", "ta"];

export const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export function passwordProblem(pw) {
    if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must include a letter and a number.";
    return null;
}

export const numOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
};

export function validCoords(lat, lng) {
    return (
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    );
}

export function foodProblem(b, { requireFutureExpiry = true } = {}) {
    if (!b.name || String(b.name).trim().length < 2) return "Food name is required.";
    if (!CATEGORIES.includes(b.category)) return "Invalid category.";
    if (!UNITS.includes(b.unit)) return "Invalid unit.";
    if (!(Number(b.quantity) > 0)) return "Quantity must be greater than 0.";
    if (!Number.isInteger(Number(b.servings)) || Number(b.servings) < 1) return "Servings must be a whole number of at least 1.";
    const exp = new Date(b.expiry_time);
    if (Number.isNaN(exp.getTime())) return "A valid expiry time is required.";
    if (requireFutureExpiry && exp.getTime() <= Date.now()) return "Expiry time must be in the future.";
    return null;
}

export function requestProblem(b) {
    if (!CATEGORIES.includes(b.category)) return "Invalid category.";
    if (!UNITS.includes(b.unit)) return "Invalid unit.";
    const q = Number(b.quantity);
    if (!(q > 0) || q > 999999.99) return "Quantity must be greater than 0.";
    if (!Number.isInteger(Number(b.servings_requested)) || Number(b.servings_requested) < 1) return "Servings must be a whole number of at least 1.";
    if (b.priority !== undefined && !PRIORITIES.includes(b.priority)) return "Invalid priority.";
    if (b.reason != null && typeof b.reason !== "string") return "Reason must be text.";
    return null;
}
