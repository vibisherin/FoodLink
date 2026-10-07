/**
 * End-to-end check of the features that go beyond CRUD:
 * SmartMatch, donation lifecycle, recently accessed, chatbot (3 languages), admin controls.
 * Start the backend first, then run:  npm run test:workflow
 * NOTE: it creates one extra listing and moves it through the lifecycle.
 */
import "../config/env.js";
import { SEEDED_LOGINS } from "../db/seed.js";

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
let passed = 0, failed = 0;
const check = (label, ok, extra = "") => { ok ? passed++ : failed++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`); };
const call = async (path, { method = "GET", token, body } = {}) => {
    const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json().catch(() => ({})) };
};
const login = async (email, password = SEEDED_LOGINS.password) => (await call("/api/auth/login", { method: "POST", body: { email, password } })).json.accessToken;

const rest = await login("greenbowl@foodlink.app");
const ngoA = await login("annapurna@foodlink.app");
const ngoH = await login("hopeshelter@foodlink.app");
const admin = await login("admin@foodlink.app", SEEDED_LOGINS.adminPassword);

console.log("\n1. Food CRUD + validation (restaurant)");
const bad = await call("/api/food", { method: "POST", token: rest, body: { name: "Old Rice", category: "cooked", quantity: 1, unit: "kg", servings: 5, expiry_time: new Date(Date.now() - 1000).toISOString() } });
check("past expiry rejected", bad.status === 400 && /future/.test(bad.json.message), bad.json.message);
const soon = new Date(Date.now() + 5 * 3600 * 1000).toISOString();
const created = await call("/api/food", { method: "POST", token: rest, body: { name: "Chole Masala", category: "cooked", quantity: 9, unit: "kg", servings: 30, expiry_time: soon } });
check("create food 201", created.status === 201);
const foodId = created.json.food_id;
const upd = await call(`/api/food/${foodId}`, { method: "PUT", token: rest, body: { servings: 32 } });
check("update food 200", upd.status === 200);
const list = await call("/api/food", { token: rest });
const mine = list.json.data.find((f) => f.id === foodId);
check("new item shows computed status 'Expiring Soon'", mine?.status === "Expiring Soon", mine?.status);

console.log("\n2. SmartMatch (unique feature)");
const m = await call(`/api/food/${foodId}/matches`, { token: rest });
const feasible = m.json.data.matches.filter((x) => x.feasible);
check("returns ranked NGOs", m.status === 200 && m.json.data.matches.length === 3);
check("scores sorted high -> low", feasible.every((x, i) => i === 0 || feasible[i - 1].score >= x.score), feasible.map((x) => `${x.ngo.name}:${x.score}`).join(" | "));
const bd = feasible[0]?.breakdown;
check("score breakdown present (proximity, timeSafety, capacity, reliability)", bd && ["proximity", "timeSafety", "capacity", "reliability"].every((k) => bd[k] >= 0 && bd[k] <= 100), JSON.stringify(bd));
const tight = await call("/api/food", { method: "POST", token: rest, body: { name: "Hot Soup", category: "cooked", quantity: 4, unit: "litres", servings: 12, expiry_time: new Date(Date.now() + 25 * 60000).toISOString() } });
const tm = await call(`/api/food/${tight.json.food_id}/matches`, { token: rest });
check("NGOs that can't arrive before expiry are excluded", tm.json.data.matches.some((x) => x.reason === "cannot_arrive_in_time" || x.reason === "out_of_radius") , tm.json.data.matches.map((x) => x.reason || "ok").join(","));
const dairy = await call("/api/food", { method: "POST", token: rest, body: { name: "Paneer Cubes", category: "dairy", quantity: 3, unit: "kg", servings: 10, expiry_time: new Date(Date.now() + 40 * 3600000).toISOString() } });
const dm = await call(`/api/food/${dairy.json.food_id}/matches`, { token: rest });
check("category filter: Hope Shelter doesn't accept dairy", dm.json.data.matches.find((x) => x.ngo.name.startsWith("Hope"))?.reason === "category_not_accepted");

console.log("\n3. Donation lifecycle");
const top = feasible[0];
const offer = await call(`/api/food/${foodId}/offer`, { method: "POST", token: rest, body: { ngo_id: top.ngo.id } });
check("restaurant offers to top NGO", offer.status === 201, `score ${offer.json.match_score}`);
const donationId = offer.json.donation_id;
const again = await call(`/api/food/${foodId}/offer`, { method: "POST", token: rest, body: { ngo_id: top.ngo.id } });
check("same item can't be offered twice", again.status === 409);
const delBlocked = await call(`/api/food/${foodId}`, { method: "DELETE", token: rest });
check("reserved item can't be deleted", delBlocked.status === 409);
const owningNgoToken = top.ngo.name.startsWith("Annapurna") ? ngoA : ngoH;
const otherNgoToken = owningNgoToken === ngoA ? ngoH : ngoA;
check("a different NGO can't touch the donation", (await call(`/api/donations/${donationId}/status`, { method: "PATCH", token: otherNgoToken, body: { status: "Accepted" } })).status === 403);
check("NGO can't skip to Completed", (await call(`/api/donations/${donationId}/status`, { method: "PATCH", token: owningNgoToken, body: { status: "Completed" } })).status === 409);
for (const s of ["Accepted", "Picked Up", "Completed"]) {
    const r = await call(`/api/donations/${donationId}/status`, { method: "PATCH", token: owningNgoToken, body: { status: s } });
    check(`NGO moves donation to "${s}"`, r.status === 200);
}
const after = await call(`/api/food/${foodId}`, { token: rest });
check("food becomes 'Donated' after completion", after.json.data.status === "Donated", after.json.data.status);

console.log("\n4. NGO feed + claim");
const feed = await call("/api/food", { token: ngoA });
check("NGO feed is ranked by match score", feed.json.data.length > 0 && feed.json.data.filter((f) => f.match.feasible).every((f, i, a) => i === 0 || a[i - 1].match.score >= f.match.score));
const claimable = feed.json.data.find((f) => f.match.feasible && f.id === dairy.json.food_id);
const claim = await call("/api/donations/claim", { method: "POST", token: ngoA, body: { food_id: claimable.id } });
check("NGO claims food from feed", claim.status === 201);
check("second claim on same item is refused", (await call("/api/donations/claim", { method: "POST", token: ngoH, body: { food_id: claimable.id } })).status === 409);

console.log("\n5. Recently accessed");
await call(`/api/food/${foodId}`, { token: rest });
await call(`/api/ngos/${top.ngo.id}`, { token: rest });
const recent = await call("/api/dashboard/recent", { token: rest });
check("tracks food + NGO views, newest first", recent.json.data[0]?.entity_type === "ngo" && recent.json.data.some((r) => r.entity_type === "food"), recent.json.data.slice(0, 3).map((r) => r.title).join(" > "));

console.log("\n6. Chatbot (live data, 3 languages)");
for (const [lang, msg] of [["en", "What is expiring soon?"], ["hi", "जल्दी क्या खराब होगा?"], ["ta", "எது விரைவில் காலாவதியாகும்?"]]) {
    const c = await call("/api/chat", { method: "POST", token: rest, body: { message: msg, lang } });
    check(`chat answers in ${lang}`, c.status === 200 && c.json.reply?.length > 10, c.json.reply?.split("\n")[0].slice(0, 60));
}
const imp = await call("/api/chat", { method: "POST", token: rest, body: { message: "my impact", lang: "en" } });
check("chat impact uses real totals", /meals rescued/.test(imp.json.reply), imp.json.reply);

console.log("\n7. Admin dashboard API");
const st = await call("/api/admin/stats", { token: admin });
check("platform stats", st.status === 200 && st.json.data.users.total >= 7 && st.json.data.impact.meals > 0, `${st.json.data.users.total} users, ${st.json.data.impact.meals} meals`);
const users = await call("/api/admin/users", { token: admin });
const target = users.json.data.find((u) => u.email === "hopeshelter@foodlink.app");
check("admin disables a user", (await call(`/api/admin/users/${target.id}/active`, { method: "PATCH", token: admin, body: { is_active: false } })).status === 200);
check("disabled user's token stops working immediately", (await call("/api/dashboard/summary", { token: ngoH })).status === 401);
check("disabled user can't sign in", (await call("/api/auth/login", { method: "POST", body: { email: "hopeshelter@foodlink.app", password: SEEDED_LOGINS.password } })).status === 403);
await call(`/api/admin/users/${target.id}/active`, { method: "PATCH", token: admin, body: { is_active: true } });
check("admin re-enables the user", (await call("/api/auth/login", { method: "POST", body: { email: "hopeshelter@foodlink.app", password: SEEDED_LOGINS.password } })).status === 200);
check("activity log is populated", (await call("/api/admin/activity", { token: admin })).json.data.length > 5);

console.log("\n8. Optional integrations fail gracefully when keys are absent");
const sc = await call("/api/scanner/analyze", { method: "POST", token: rest, body: { image: "data:image/png;base64,AAAA" } });
check("scanner responds with a clear message (no crash)", [503, 400, 502].includes(sc.status), sc.json.message?.slice(0, 70));
const gs = await fetch(`${BASE}/api/auth/google`, { redirect: "manual" });
check("Google OAuth start redirects", gs.status === 302, gs.headers.get("location")?.slice(0, 60));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
