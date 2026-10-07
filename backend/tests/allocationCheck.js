/**
 * End-to-end check of NGO food requests + priority-based allocation.
 * Backend must be running against a seeded database:  npm run db:reset  &&  npm run dev
 * Then:  npm run test:allocation
 * Logs in with the seeded accounts (no tokens to copy). It cancels any open requests the
 * three seeded NGOs already have (the demo ones from the seed) so results are deterministic,
 * then creates its own food and requests. Re-run  npm run db:reset  to restore the demo data.
 */
import "../config/env.js";
import { SEEDED_LOGINS } from "../db/seed.js";

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
let passed = 0, failed = 0;
const check = (label, ok, extra = "") => { ok ? passed++ : failed++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra !== "" ? `  (${extra})` : ""}`); };
const call = async (path, { method = "GET", token, body } = {}) => {
    const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json().catch(() => ({})) };
};
const login = async (email) => (await call("/api/auth/login", { method: "POST", body: { email, password: SEEDED_LOGINS.password } })).json.accessToken;

const greenbowl = await login("greenbowl@foodlink.app");   // restaurant 1
const spice = await login("spiceroute@foodlink.app");      // restaurant 2
const A = await login("annapurna@foodlink.app");           // NGO A
const B = await login("hopeshelter@foodlink.app");         // NGO B
const C = await login("sevahands@foodlink.app");           // NGO C

const myReqs = async (t) => (await call("/api/requests/my", { token: t })).json.data || [];
const reqOf = async (t, id) => (await myReqs(t)).find((r) => r.id === id);
const foodOf = async (t, id) => (await call("/api/food", { token: t })).json.data.find((f) => f.id === id);
const newFood = (t, body) => call("/api/food", { method: "POST", token: t, body: { servings: 40, expiry_time: new Date(Date.now() + 20 * 3600 * 1000).toISOString(), ...body } });
const newReq = (t, body) => call("/api/requests", { method: "POST", token: t, body: { servings_requested: 10, reason: "test", ...body } });

console.log("\n0. Clean slate (cancel open requests left by the seed)");
for (const t of [A, B, C]) for (const r of await myReqs(t)) if (["Pending", "Partially Fulfilled"].includes(r.status)) await call(`/api/requests/${r.id}/cancel`, { method: "PATCH", token: t });
check("no open requests remain", (await Promise.all([A, B, C].map(myReqs))).flat().every((r) => !["Pending", "Partially Fulfilled"].includes(r.status)));

console.log("\n1. Access control + validation");
check("no token -> 401", (await call("/api/requests/my")).status === 401);
check("restaurant can't create a request -> 403", (await newReq(greenbowl, { category: "cooked", quantity: 5, unit: "kg" })).status === 403);
check("NGO can't allocate -> 403", (await call("/api/allocations", { method: "POST", token: A, body: { food_id: 1 } })).status === 403);
check("restaurant can't list an NGO's own requests -> 403", (await call("/api/requests/my", { token: greenbowl })).status === 403);
check("bad category -> 400", (await newReq(A, { category: "pizza", quantity: 5, unit: "kg" })).status === 400);
check("zero quantity -> 400", (await newReq(A, { category: "cooked", quantity: 0, unit: "kg" })).status === 400);
check("bad priority -> 400", (await newReq(A, { category: "cooked", quantity: 5, unit: "kg", priority: "Whenever" })).status === 400);
check("missing food_id -> 400", (await call("/api/allocations", { method: "POST", token: greenbowl, body: {} })).status === 400);

console.log("\n2. Priority allocation: 50 kg vs Urgent 20 / High 15 / Normal 25");
// Created in the "wrong" order on purpose: priority must beat age.
const rC = (await newReq(C, { category: "cooked", quantity: 25, unit: "kg", priority: "Normal", servings_requested: 80 })).json.request_id;
const rB = (await newReq(B, { category: "cooked", quantity: 15, unit: "kg", priority: "High", servings_requested: 45 })).json.request_id;
const rA = (await newReq(A, { category: "cooked", quantity: 20, unit: "kg", priority: "Urgent", servings_requested: 60 })).json.request_id;
check("three requests created", !!(rA && rB && rC));
check("NGO sees only its own requests", (await myReqs(A)).every((r) => r.id !== rB && r.id !== rC));
const food1 = (await newFood(greenbowl, { name: "Allocation Test Biryani", category: "cooked", quantity: 50, unit: "kg", servings: 100 })).json.food_id;
const open = await call(`/api/requests/open?food_id=${food1}`, { token: greenbowl });
check("restaurant list ordered Urgent > High > Normal", open.json.data.map((r) => r.id).join() === [rA, rB, rC].join(), open.json.data.map((r) => r.priority).join(">"));
check("preview shows 20 / 15 / 15", open.json.data.map((r) => r.would_receive).join() === "20,15,15", open.json.data.map((r) => r.would_receive).join("/"));
check("other restaurant can't allocate this food -> 403", (await call("/api/allocations", { method: "POST", token: spice, body: { food_id: food1 } })).status === 403);
const al = await call("/api/allocations", { method: "POST", token: greenbowl, body: { food_id: food1 } });
check("allocation 201", al.status === 201, al.json.message);
check("allocated 20 / 15 / 15 in priority order", al.json.allocations?.map((a) => a.allocated).join() === "20,15,15" && al.json.allocations.map((a) => a.priority).join() === "Urgent,High,Normal");
check("NGO A (Urgent) Fulfilled, fulfilled 20, remaining 0", await reqOf(A, rA).then((r) => r.status === "Fulfilled" && Number(r.fulfilled_quantity) === 20 && r.remaining_quantity === 0));
check("NGO B (High) Fulfilled", await reqOf(B, rB).then((r) => r.status === "Fulfilled" && Number(r.fulfilled_quantity) === 15));
check("NGO C (Normal) Partially Fulfilled, fulfilled 15, remaining 10", await reqOf(C, rC).then((r) => r.status === "Partially Fulfilled" && Number(r.fulfilled_quantity) === 15 && r.remaining_quantity === 10));
const f1 = await foodOf(greenbowl, food1);
check("restaurant food remaining 0 and Reserved", Number(f1.remaining_quantity) === 0 && f1.status === "Reserved", `${f1.remaining_quantity} / ${f1.status}`);
const dons = (await call("/api/donations", { token: C })).json.data.filter((d) => d.request_id === rC);
check("donation row created for NGO C (Accepted, 15 kg, linked to request)", dons.length === 1 && dons[0].status === "Accepted" && Number(dons[0].quantity_delivered) === 15 && dons[0].unit_delivered === "kg");
check("allocating again -> 409 (nothing available)", (await call("/api/allocations", { method: "POST", token: greenbowl, body: { food_id: food1 } })).status === 409);
check("whole-item claim of an allocated item is refused", [409].includes((await call("/api/donations/claim", { method: "POST", token: A, body: { food_id: food1 } })).status));

console.log("\n3. Another restaurant fulfils the remaining 10 kg");
const food2 = (await newFood(spice, { name: "Allocation Test Curry", category: "cooked", quantity: 12, unit: "kg", servings: 36 })).json.food_id;
const al2 = await call("/api/allocations", { method: "POST", token: spice, body: { food_id: food2 } });
check("allocation 201 -> 10 kg to NGO C", al2.status === 201 && al2.json.allocations?.length === 1 && al2.json.allocations[0].allocated === 10, al2.json.message);
check("NGO C now Fulfilled", await reqOf(C, rC).then((r) => r.status === "Fulfilled" && Number(r.fulfilled_quantity) === 25));
const f2 = await foodOf(spice, food2);
check("2 kg left and still available", Number(f2.remaining_quantity) === 2 && ["Available", "Expiring Soon"].includes(f2.status), `${f2.remaining_quantity} / ${f2.status}`);
check("partly allocated item can't be offered whole", (await call(`/api/food/${food2}/offer`, { method: "POST", token: spice, body: { ngo_id: 1 } })).status === 409);
check("quantity of a partly allocated item can't be edited", (await call(`/api/food/${food2}`, { method: "PUT", token: spice, body: { quantity: 99 } })).status === 409);

console.log("\n4. Cancelling requests");
check("fulfilled request can't be cancelled -> 409", (await call(`/api/requests/${rA}/cancel`, { method: "PATCH", token: A })).status === 409);
check("another NGO can't cancel it -> 403", (await call(`/api/requests/${rA}/cancel`, { method: "PATCH", token: B })).status === 403);
const rB2 = (await newReq(B, { category: "cooked", quantity: 5, unit: "kg", priority: "Urgent" })).json.request_id;
check("NGO cancels its own pending request", (await call(`/api/requests/${rB2}/cancel`, { method: "PATCH", token: B })).status === 200);
check("cancelled request can't be cancelled again -> 409", (await call(`/api/requests/${rB2}/cancel`, { method: "PATCH", token: B })).status === 409);
const al3 = await call("/api/allocations", { method: "POST", token: spice, body: { food_id: food2 } });
check("cancelled request receives nothing (no allocation, food unchanged)", al3.status === 200 && al3.json.allocations.length === 0 && Number((await foodOf(spice, food2)).remaining_quantity) === 2);

console.log("\n5. Same priority: oldest request first; cancelling a donation gives the quantity back");
const p1 = (await newReq(A, { category: "packaged", quantity: 6, unit: "packs", priority: "Urgent" })).json.request_id;
const p2 = (await newReq(C, { category: "packaged", quantity: 6, unit: "packs", priority: "Urgent" })).json.request_id;
const food3 = (await newFood(greenbowl, { name: "Allocation Test Cookies", category: "packaged", quantity: 10, unit: "packs", servings: 10 })).json.food_id;
const al4 = await call("/api/allocations", { method: "POST", token: greenbowl, body: { food_id: food3 } });
check("older Urgent request gets 6, newer gets 4", al4.json.allocations?.map((a) => `${a.request_id}:${a.allocated}`).join() === `${p1}:6,${p2}:4`, al4.json.allocations?.map((a) => `${a.request_id}:${a.allocated}`).join());
const donP1 = al4.json.allocations[0].donation_id;
const cancel = await call(`/api/donations/${donP1}/status`, { method: "PATCH", token: greenbowl, body: { status: "Cancelled" } });
check("restaurant cancels the first donation", cancel.status === 200);
check("request A returns to Pending (0 fulfilled)", await reqOf(A, p1).then((r) => r.status === "Pending" && Number(r.fulfilled_quantity) === 0));
const f3 = await foodOf(greenbowl, food3);
check("6 packs returned to the food item", Number(f3.remaining_quantity) === 6, `${f3.remaining_quantity} / ${f3.status}`);

console.log("\n6. Donation lifecycle completes a split item");
const donP2 = al4.json.allocations[1].donation_id;
for (const s of ["Picked Up", "Completed"]) check(`NGO moves its share to "${s}"`, (await call(`/api/donations/${donP2}/status`, { method: "PATCH", token: C, body: { status: s } })).status === 200);
const f3b = await foodOf(greenbowl, food3);
check("food NOT marked Donated while 6 packs remain", f3b.status !== "Donated", f3b.status);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
