import dotenv from "dotenv";
dotenv.config();

const required = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DB_HOST", "DB_USER", "DB_NAME"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
    console.error(`\n[config] Missing required .env values: ${missing.join(", ")}`);
    console.error("[config] Copy backend/.env.example to backend/.env and fill them in.\n");
    process.exit(1);
}

export const config = {
    port: Number(process.env.PORT) || 5000,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
    refreshDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        callbackUrl:
            process.env.GOOGLE_CALLBACK_URL ||
            "http://localhost:5000/api/auth/google/callback",
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || "",
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    },
    // Impact estimates (clearly labelled as estimates in the UI)
    impact: { kgPerMeal: 0.4, co2KgPerKgFood: 2.5 },
};

export const googleEnabled = Boolean(config.google.clientId && config.google.clientSecret);
