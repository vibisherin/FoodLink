import bcrypt from "bcryptjs";

const H = 3600 * 1000;
const D = 24 * H;

const USER_PASSWORD = process.env.SEED_PASSWORD || "FoodLink@2026";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@FoodLink2026";

// Realistic organisations. Coordinates are neighbourhood-level, so SmartMatch
// distances, travel times and radii behave like they would in a real city.
const ACCOUNTS = [
    { key: "admin", name: "FoodLink Administrator", email: "admin@foodlink.app", role: "admin", lang: "en" },

    { key: "greenbowl", name: "Meera Krishnan", email: "greenbowl@foodlink.app", role: "restaurant", lang: "en",
      org: { name: "Green Bowl Restaurant", address: "Indiranagar 100 Feet Road", city: "Bengaluru", lat: 12.9784, lng: 77.6408, phone: null } },
    { key: "spiceroute", name: "Rohan Shetty", email: "spiceroute@foodlink.app", role: "restaurant", lang: "hi",
      org: { name: "Spice Route Kitchen", address: "Koramangala 5th Block", city: "Bengaluru", lat: 12.9352, lng: 77.6245, phone: null } },
    { key: "bakebloom", name: "Farah Khan", email: "bakebloom@foodlink.app", role: "restaurant", lang: "en",
      org: { name: "Bake & Bloom Bakery", address: "Jayanagar 4th Block", city: "Bengaluru", lat: 12.9250, lng: 77.5938, phone: null } },

    { key: "annapurna", name: "Lakshmi Narayanan", email: "annapurna@foodlink.app", role: "ngo", lang: "ta",
      org: { name: "Annapurna Meals Foundation", address: "Domlur", city: "Bengaluru", lat: 12.9609, lng: 77.6387, cap: 300, radius: 12, vehicle: 1,
             cats: "cooked,bakery,produce,dairy,packaged" } },
    { key: "hope", name: "Thomas Mathew", email: "hopeshelter@foodlink.app", role: "ngo", lang: "en",
      org: { name: "Hope Shelter Trust", address: "Shivajinagar", city: "Bengaluru", lat: 12.9857, lng: 77.6057, cap: 150, radius: 8, vehicle: 0,
             cats: "cooked,bakery,produce" } },
    { key: "seva", name: "Priya Venkatesh", email: "sevahands@foodlink.app", role: "ngo", lang: "en",
      org: { name: "Seva Hands Community Kitchen", address: "HSR Layout", city: "Bengaluru", lat: 12.9116, lng: 77.6474, cap: 200, radius: 10, vehicle: 1,
             cats: "cooked,produce,dairy,packaged" } },
];

// Live listings: expiry is relative to the moment you seed, so they are always current.
// [restaurant, name, category, quantity, unit, servings, hoursUntilExpiry, notes]
const LIVE_FOOD = [
    ["greenbowl", "Vegetable Biryani", "cooked", 12, "kg", 40, 7, "Prepared at lunch service, kept hot-held"],
    ["greenbowl", "Dal Tadka", "cooked", 8, "kg", 28, 10, null],
    ["greenbowl", "Whole Wheat Bread", "bakery", 20, "packs", 20, 30, "Baked this morning"],
    ["greenbowl", "Seasonal Fruit Salad", "produce", 6, "kg", 24, 4, null],
    ["spiceroute", "Paneer Butter Masala", "cooked", 6, "kg", 22, 6, null],
    ["spiceroute", "Set Curd", "dairy", 10, "litres", 40, 60, "Sealed tubs, refrigerated"],
    ["spiceroute", "Mixed Vegetable Curry", "cooked", 15, "kg", 50, 20, null],
    ["bakebloom", "Multigrain Buns", "bakery", 30, "packs", 30, 14, null],
    ["bakebloom", "Milk Bread Loaves", "bakery", 25, "packs", 25, 36, null],
    ["bakebloom", "Packaged Oat Cookies", "packaged", 40, "packs", 40, 96, "Sealed, labelled, best-before on pack"],
];

// Past completed/declined donations so reliability scores, impact and charts are real.
// [restaurant, ngo, food, category, servings, daysAgo, status]
const HISTORY = [
    ["greenbowl", "annapurna", "Jeera Rice", "cooked", 45, 13, "Completed"],
    ["spiceroute", "seva", "Rajma Masala", "cooked", 30, 12, "Completed"],
    ["bakebloom", "hope", "Pav Buns", "bakery", 36, 11, "Completed"],
    ["greenbowl", "hope", "Sambar", "cooked", 28, 10, "Declined"],
    ["spiceroute", "annapurna", "Chapati Stack", "cooked", 60, 9, "Completed"],
    ["greenbowl", "seva", "Lemon Rice", "cooked", 35, 8, "Completed"],
    ["bakebloom", "annapurna", "Sandwich Bread", "bakery", 40, 7, "Completed"],
    ["spiceroute", "hope", "Veg Pulao", "cooked", 32, 6, "Completed"],
    ["greenbowl", "annapurna", "Curd Rice", "cooked", 38, 5, "Completed"],
    ["bakebloom", "seva", "Fruit Cake Slices", "packaged", 24, 4, "Completed"],
    ["spiceroute", "annapurna", "Dal Fry", "cooked", 42, 3, "Completed"],
    ["greenbowl", "hope", "Idli Batter Idlis", "cooked", 50, 2, "Completed"],
    ["bakebloom", "annapurna", "Garlic Bread", "bakery", 30, 1, "Completed"],
];

export async function seed(conn) {
    console.log("Seeding database...");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of ["activity_log", "refresh_tokens", "recently_accessed", "donations", "food_items", "ngos", "restaurants", "users"]) {
        await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    const userHash = await bcrypt.hash(USER_PASSWORD, 10);
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const restaurantId = {}, ngoId = {};

    for (const a of ACCOUNTS) {
        const [u] = await conn.query(
            "INSERT INTO users (name, email, password_hash, role, language) VALUES (?, ?, ?, ?, ?)",
            [a.name, a.email, a.role === "admin" ? adminHash : userHash, a.role, a.lang]);
        if (a.role === "restaurant") {
            const o = a.org;
            const [r] = await conn.query(
                "INSERT INTO restaurants (user_id, name, address, city, latitude, longitude, phone) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [u.insertId, o.name, o.address, o.city, o.lat, o.lng, o.phone]);
            restaurantId[a.key] = r.insertId;
        }
        if (a.role === "ngo") {
            const o = a.org;
            const [n] = await conn.query(
                `INSERT INTO ngos (user_id, name, address, city, latitude, longitude, daily_capacity_meals, max_radius_km, accepted_categories, has_vehicle)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [u.insertId, o.name, o.address, o.city, o.lat, o.lng, o.cap, o.radius, o.cats, o.vehicle]);
            ngoId[a.key] = n.insertId;
        }
    }

    const now = Date.now();
    for (const [rk, ngoKey, name, cat, servings, daysAgo, status] of HISTORY) {
        const created = new Date(now - daysAgo * D);
        const expiry = new Date(created.getTime() + 8 * H);
        const qty = Math.max(1, Math.round(servings * 0.4));
        const [f] = await conn.query(
            `INSERT INTO food_items (restaurant_id, name, category, quantity, unit, servings, expiry_time, status, created_at)
             VALUES (?, ?, ?, ?, 'kg', ?, ?, ?, ?)`,
            [restaurantId[rk], name, cat, qty, servings, expiry, status === "Completed" ? "Donated" : "Expired", created]);
        await conn.query(
            `INSERT INTO donations (food_id, ngo_id, initiated_by, status, match_score, servings_delivered, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [f.insertId, ngoId[ngoKey], daysAgo % 2 ? "restaurant" : "ngo", status, 70 + ((servings * 7) % 25),
             status === "Completed" ? servings : null, created, new Date(created.getTime() + 3 * H)]);
    }

    const liveIds = [];
    for (const [rk, name, cat, qty, unit, servings, hours, notes] of LIVE_FOOD) {
        const expiry = new Date(now + hours * H);
        const [f] = await conn.query(
            `INSERT INTO food_items (restaurant_id, name, category, quantity, unit, servings, expiry_time, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [restaurantId[rk], name, cat, qty, unit, servings, expiry, hours <= 24 ? "Expiring Soon" : "Available", notes]);
        liveIds.push(f.insertId);
    }

    // One offer waiting for an NGO reply, and one accepted pickup in progress,
    // so the donation workflow is visible on every dashboard straight away.
    await conn.query("UPDATE food_items SET status = 'Reserved' WHERE id IN (?, ?)", [liveIds[3], liveIds[4]]);
    await conn.query(
        `INSERT INTO donations (food_id, ngo_id, initiated_by, status, match_score) VALUES (?, ?, 'restaurant', 'Pending', 88.4)`,
        [liveIds[3], ngoId.annapurna]);
    await conn.query(
        `INSERT INTO donations (food_id, ngo_id, initiated_by, status, match_score) VALUES (?, ?, 'ngo', 'Accepted', 81.2)`,
        [liveIds[4], ngoId.seva]);

    console.log(`Seeded ${ACCOUNTS.length} users (1 admin, 3 restaurants, 3 NGOs).`);
    console.log("  Admin:        admin@foodlink.app      /", ADMIN_PASSWORD);
    console.log("  Others:       <name>@foodlink.app     /", USER_PASSWORD);
}

export const SEEDED_LOGINS = {
    password: USER_PASSWORD,
    adminPassword: ADMIN_PASSWORD,
    accounts: ACCOUNTS.map((a) => ({ email: a.email, role: a.role })),
};
