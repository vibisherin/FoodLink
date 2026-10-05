import db from "../config/db.js";
import { refreshFoodStatuses } from "./expiryJob.js";
import { rankNgosForFood, rankFeedForNgo } from "./matchEngine.js";
import { summaryFor, impactFromMeals } from "../controllers/dashboardController.js";
import { getRecent } from "../utils/recent.js";
import { callClaude, aiEnabled } from "./anthropic.js";

/* ------------------------------ localisation ------------------------------ */
const T = {
    en: {
        greeting: (n) => `Hello ${n}! I'm the FoodLink assistant. I can check expiring food, donation status, your best NGO match, your impact and what you viewed recently.`,
        help: "Try asking: “What is expiring soon?”, “Donation status”, “Best NGO match”, “My impact” or “Recently viewed”.",
        how: "How FoodLink works: restaurants list surplus food → SmartMatch ranks NGOs that can reach it before it expires → the NGO accepts → pickup → completed. Every step is tracked.",
        noneExpiring: "Nothing is close to expiring right now.",
        expiringHead: "Expiring soonest:",
        left: (h, m) => `${h}h ${m}m left`,
        feedHead: "Best open food for you right now:",
        feedItem: (f) => `${f.name} from ${f.restaurant_name} — match ${f.match.score}%, ${f.match.distanceKm} km`,
        feedNone: "No open food can reach you in time right now.",
        adminExpiring: (n, e) => `${n} items are expiring within 24 hours and ${e} have already expired across the platform.`,
        donationsR: (s) => `Your donations: ${s.pending} waiting for an NGO reply, ${s.active} in progress, ${s.completed} completed.`,
        donationsN: (s) => `Your donations: ${s.pending} waiting for your reply, ${s.active} in progress, ${s.completed} completed.`,
        donationsA: (s) => `Platform donations: ${s.pending} pending, ${s.active} in progress, ${s.completed} completed.`,
        matchNone: "You have no available food to match. Add a listing first.",
        matchFor: (f, m) => `For “${f}” the best NGO is ${m.ngo.name}: score ${m.score}/100, ${m.distanceKm} km away, about ${m.etaMinutes} min to arrive.`,
        matchNoNgo: (f) => `No NGO can currently collect “${f}” before it expires. Check your location in Profile or add a nearer partner.`,
        matchNgo: "As an NGO, your ranked feed on the dashboard already shows food sorted by match score.",
        impact: (i) => `Impact so far: ${i.meals} meals rescued, about ${i.kgFoodSaved} kg of food and ${i.co2AvoidedKg} kg CO₂e avoided (estimates).`,
        recentNone: "You haven't opened anything yet.",
        recentHead: "You recently viewed:",
        fallback: "I didn't catch that. " ,
        aiOff: "I can answer about expiry, donations, matches, impact and recent items.",
        sug: ["What is expiring soon?", "Donation status", "Best NGO match", "My impact", "Recently viewed"],
    },
    hi: {
        greeting: (n) => `नमस्ते ${n}! मैं FoodLink सहायक हूँ। मैं एक्सपायर होने वाला खाना, दान की स्थिति, सबसे अच्छा NGO मिलान, आपका प्रभाव और हाल में देखे गए आइटम बता सकता हूँ।`,
        help: "पूछकर देखें: “जल्दी क्या खराब होगा?”, “दान की स्थिति”, “सबसे अच्छा NGO”, “मेरा प्रभाव” या “हाल में देखा”।",
        how: "FoodLink कैसे काम करता है: रेस्टोरेंट बचा हुआ खाना जोड़ते हैं → SmartMatch उन NGO को चुनता है जो समय सीमा से पहले पहुँच सकें → NGO स्वीकार करता है → पिकअप → पूर्ण। हर चरण ट्रैक होता है।",
        noneExpiring: "अभी कुछ भी जल्दी एक्सपायर नहीं हो रहा।",
        expiringHead: "सबसे पहले समाप्त होने वाले:",
        left: (h, m) => `${h} घं ${m} मि शेष`,
        feedHead: "अभी आपके लिए सबसे अच्छा उपलब्ध खाना:",
        feedItem: (f) => `${f.name} (${f.restaurant_name}) — मिलान ${f.match.score}%, ${f.match.distanceKm} किमी`,
        feedNone: "अभी कोई खाना समय पर आप तक नहीं पहुँच सकता।",
        adminExpiring: (n, e) => `प्लेटफ़ॉर्म पर ${n} आइटम 24 घंटे में समाप्त होंगे और ${e} समाप्त हो चुके हैं।`,
        donationsR: (s) => `आपके दान: ${s.pending} NGO के उत्तर की प्रतीक्षा में, ${s.active} जारी, ${s.completed} पूर्ण।`,
        donationsN: (s) => `आपके दान: ${s.pending} आपके उत्तर की प्रतीक्षा में, ${s.active} जारी, ${s.completed} पूर्ण।`,
        donationsA: (s) => `प्लेटफ़ॉर्म दान: ${s.pending} लंबित, ${s.active} जारी, ${s.completed} पूर्ण।`,
        matchNone: "मिलान के लिए कोई उपलब्ध खाना नहीं है। पहले एक आइटम जोड़ें।",
        matchFor: (f, m) => `“${f}” के लिए सबसे अच्छा NGO ${m.ngo.name} है: स्कोर ${m.score}/100, ${m.distanceKm} किमी दूर, पहुँचने में लगभग ${m.etaMinutes} मिनट।`,
        matchNoNgo: (f) => `अभी कोई NGO “${f}” को समाप्ति से पहले नहीं ले सकता। प्रोफ़ाइल में अपना स्थान जाँचें।`,
        matchNgo: "NGO के रूप में, डैशबोर्ड की सूची पहले से मिलान स्कोर के अनुसार क्रमबद्ध है।",
        impact: (i) => `अब तक का प्रभाव: ${i.meals} भोजन बचाए, लगभग ${i.kgFoodSaved} किग्रा खाना और ${i.co2AvoidedKg} किग्रा CO₂e बचाया (अनुमान)।`,
        recentNone: "आपने अभी तक कुछ नहीं खोला।",
        recentHead: "हाल में देखे गए:",
        fallback: "मैं समझ नहीं पाया। ",
        aiOff: "मैं एक्सपायरी, दान, मिलान, प्रभाव और हाल के आइटम के बारे में बता सकता हूँ।",
        sug: ["जल्दी क्या खराब होगा?", "दान की स्थिति", "सबसे अच्छा NGO", "मेरा प्रभाव", "हाल में देखा"],
    },
    ta: {
        greeting: (n) => `வணக்கம் ${n}! நான் FoodLink உதவியாளர். காலாவதியாகும் உணவு, நன்கொடை நிலை, சிறந்த NGO பொருத்தம், உங்கள் தாக்கம், சமீபத்தில் பார்த்தவை ஆகியவற்றைச் சொல்வேன்.`,
        help: "இவ்வாறு கேளுங்கள்: “எது விரைவில் காலாவதியாகும்?”, “நன்கொடை நிலை”, “சிறந்த NGO”, “என் தாக்கம்”, “சமீபத்தில் பார்த்தவை”.",
        how: "FoodLink செயல்படும் விதம்: உணவகங்கள் மீதமுள்ள உணவைப் பதிவு செய்கின்றன → காலாவதிக்குள் சென்றடையக்கூடிய NGO-க்களை SmartMatch வரிசைப்படுத்துகிறது → NGO ஏற்கிறது → எடுத்துச் செல்லுதல் → நிறைவு. ஒவ்வொரு படியும் கண்காணிக்கப்படும்.",
        noneExpiring: "இப்போது எதுவும் விரைவில் காலாவதியாகவில்லை.",
        expiringHead: "விரைவில் காலாவதியாகும் உணவு:",
        left: (h, m) => `${h} ம ${m} நி மீதம்`,
        feedHead: "இப்போது உங்களுக்கு ஏற்ற சிறந்த உணவு:",
        feedItem: (f) => `${f.name} (${f.restaurant_name}) — பொருத்தம் ${f.match.score}%, ${f.match.distanceKm} கி.மீ`,
        feedNone: "இப்போது நேரத்துக்குள் உங்களால் எடுக்கக்கூடிய உணவு இல்லை.",
        adminExpiring: (n, e) => `தளத்தில் ${n} பொருட்கள் 24 மணி நேரத்தில் காலாவதியாகும்; ${e} ஏற்கனவே காலாவதியாகிவிட்டன.`,
        donationsR: (s) => `உங்கள் நன்கொடைகள்: ${s.pending} NGO பதிலுக்காகக் காத்திருக்கின்றன, ${s.active} நடைபெறுகின்றன, ${s.completed} நிறைவு.`,
        donationsN: (s) => `உங்கள் நன்கொடைகள்: ${s.pending} உங்கள் பதிலுக்காகக் காத்திருக்கின்றன, ${s.active} நடைபெறுகின்றன, ${s.completed} நிறைவு.`,
        donationsA: (s) => `தள நன்கொடைகள்: ${s.pending} நிலுவையில், ${s.active} நடைபெறுகின்றன, ${s.completed} நிறைவு.`,
        matchNone: "பொருத்த உணவு எதுவும் இல்லை. முதலில் ஒரு பதிவைச் சேர்க்கவும்.",
        matchFor: (f, m) => `“${f}” உணவுக்குச் சிறந்த NGO ${m.ngo.name}: மதிப்பெண் ${m.score}/100, ${m.distanceKm} கி.மீ தொலைவு, சென்றடைய சுமார் ${m.etaMinutes} நிமிடம்.`,
        matchNoNgo: (f) => `“${f}” காலாவதிக்குள் எடுக்கக்கூடிய NGO இப்போது இல்லை. சுயவிவரத்தில் உங்கள் இருப்பிடத்தைச் சரிபாருங்கள்.`,
        matchNgo: "NGO ஆக, டாஷ்போர்டில் உள்ள பட்டியல் ஏற்கனவே பொருத்த மதிப்பெண் படி வரிசைப்படுத்தப்பட்டுள்ளது.",
        impact: (i) => `இதுவரை தாக்கம்: ${i.meals} உணவுகள் மீட்கப்பட்டன, சுமார் ${i.kgFoodSaved} கிலோ உணவு, ${i.co2AvoidedKg} கிலோ CO₂e தவிர்க்கப்பட்டது (மதிப்பீடு).`,
        recentNone: "நீங்கள் இன்னும் எதையும் திறக்கவில்லை.",
        recentHead: "சமீபத்தில் பார்த்தவை:",
        fallback: "எனக்குப் புரியவில்லை. ",
        aiOff: "காலாவதி, நன்கொடை, பொருத்தம், தாக்கம், சமீபத்திய பொருட்கள் பற்றி நான் சொல்ல முடியும்.",
        sug: ["எது விரைவில் காலாவதியாகும்?", "நன்கொடை நிலை", "சிறந்த NGO", "என் தாக்கம்", "சமீபத்தில் பார்த்தவை"],
    },
};

/* ------------------------------ intent detection ------------------------------ */
const INTENTS = [
    ["greeting", ["hello", "hi ", "hey", "namaste", "नमस्ते", "வணக்கம்"]],
    ["how", ["how does", "how it works", "how to", "works", "कैसे", "எப்படி", "செயல்"]],
    ["recent", ["recent", "history", "last viewed", "viewed", "हाल", "देखा", "சமீப", "பார்த்த"]],
    ["impact", ["impact", "meals", "saved", "co2", "rescued", "प्रभाव", "बचा", "தாக்கம்", "மீட்"]],
    ["match", ["match", "best ngo", "which ngo", "recommend", "मिलान", "सबसे अच्छा", "பொருத்த", "சிறந்த"]],
    ["donations", ["donation", "status", "pickup", "pending", "दान", "स्थिति", "நன்கொடை", "நிலை"]],
    ["expiring", ["expir", "spoil", "urgent", "soon", "खराब", "एक्सपायर", "समाप्त", "காலாவதி", "விரைவில்"]],
    ["help", ["help", "what can you", "मदद", "सहायता", "உதவி"]],
];

function detectIntent(text) {
    const s = ` ${text.toLowerCase()} `;
    for (const [name, words] of INTENTS) if (words.some((w) => s.includes(w))) return name;
    return null;
}

function minutesLeft(expiry) { return Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 60000)); }

/* ------------------------------ handlers ------------------------------ */
async function handle(intent, user, L) {
    const t = T[L];
    switch (intent) {
        case "greeting": return t.greeting(user.name.split(" ")[0]);
        case "help": return t.help;
        case "how": return t.how;

        case "expiring": {
            await refreshFoodStatuses();
            if (user.role === "restaurant") {
                const [rows] = await db.query(
                    `SELECT name, expiry_time FROM food_items WHERE restaurant_id = ? AND status IN ('Available','Expiring Soon')
                     AND expiry_time > UTC_TIMESTAMP() ORDER BY expiry_time LIMIT 5`, [user.restaurant_id]);
                if (!rows.length) return t.noneExpiring;
                return [t.expiringHead, ...rows.map((r) => { const m = minutesLeft(r.expiry_time); return `• ${r.name} — ${t.left(Math.floor(m / 60), m % 60)}`; })].join("\n");
            }
            if (user.role === "ngo") {
                const feed = await rankFeedForNgo(user.ngo_id, 3);
                if (!feed.length) return t.feedNone;
                return [t.feedHead, ...feed.map((f) => `• ${t.feedItem(f)}`)].join("\n");
            }
            const [[a]] = await db.query(`SELECT COALESCE(SUM(status='Expiring Soon'),0) AS soon, COALESCE(SUM(status='Expired'),0) AS expired FROM food_items`);
            return t.adminExpiring(Number(a.soon), Number(a.expired));
        }

        case "donations": {
            if (user.role === "restaurant") {
                const [[d]] = await db.query(
                    `SELECT COALESCE(SUM(d.status='Pending'),0) AS pending, COALESCE(SUM(d.status IN ('Accepted','Picked Up')),0) AS active,
                            COALESCE(SUM(d.status='Completed'),0) AS completed
                     FROM donations d JOIN food_items f ON f.id = d.food_id WHERE f.restaurant_id = ?`, [user.restaurant_id]);
                return t.donationsR(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Number(v)])));
            }
            if (user.role === "ngo") return t.donationsN((await summaryFor(user)).counts);
            const [[d]] = await db.query(
                `SELECT COALESCE(SUM(status='Pending'),0) AS pending, COALESCE(SUM(status IN ('Accepted','Picked Up')),0) AS active,
                        COALESCE(SUM(status='Completed'),0) AS completed FROM donations`);
            return t.donationsA(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Number(v)])));
        }

        case "match": {
            if (user.role !== "restaurant") return t.matchNgo;
            await refreshFoodStatuses();
            const [rows] = await db.query(
                `SELECT f.*, r.latitude, r.longitude FROM food_items f JOIN restaurants r ON r.id = f.restaurant_id
                 WHERE f.restaurant_id = ? AND f.status IN ('Available','Expiring Soon') ORDER BY f.expiry_time LIMIT 1`, [user.restaurant_id]);
            if (!rows.length) return t.matchNone;
            const food = rows[0];
            const best = (await rankNgosForFood(food, food)).find((m) => m.feasible);
            return best ? t.matchFor(food.name, best) : t.matchNoNgo(food.name);
        }

        case "impact": {
            if (user.role === "admin") {
                const [[m]] = await db.query(`SELECT COALESCE(SUM(f.servings),0) AS meals FROM donations d JOIN food_items f ON f.id = d.food_id WHERE d.status='Completed'`);
                return t.impact(impactFromMeals(Number(m.meals)));
            }
            return t.impact((await summaryFor(user)).impact);
        }

        case "recent": {
            const rows = await getRecent(user.id, 5);
            if (!rows.length) return t.recentNone;
            return [t.recentHead, ...rows.map((r) => `• ${r.title}`)].join("\n");
        }
    }
}

/* ------------------------------ entry point ------------------------------ */
export async function chatReply({ user, message, lang }) {
    const L = T[lang] ? lang : "en";
    const intent = detectIntent(message);
    let reply = intent ? await handle(intent, user, L) : null;

    if (!reply) {
        if (aiEnabled()) {
            try {
                const ctx = await summaryFor(user);
                reply = await callClaude({
                    maxTokens: 400,
                    system: `You are FoodLink's assistant. FoodLink connects restaurants with surplus food to nearby NGOs; SmartMatch ranks NGOs by distance, time-to-expiry vs travel time, capacity and reliability. The user is a ${user.role} named ${user.name}. Their live numbers: ${JSON.stringify(ctx)}. Answer briefly (max 4 sentences) in ${{ en: "English", hi: "Hindi", ta: "Tamil" }[L]}. If asked about food safety, be conservative. Don't invent data you weren't given.`,
                    messages: [{ role: "user", content: message }],
                });
            } catch {
                reply = null;
            }
        }
        if (!reply) reply = T[L].fallback + T[L].aiOff;
    }
    return { reply, suggestions: T[L].sug };
}
