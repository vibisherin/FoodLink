import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config, googleEnabled } from "./config/env.js";
import db from "./config/db.js";
import foodRoutes from "./routes/foodroutes.js";
import authRoutes from "./routes/authRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import allocationRoutes from "./routes/allocationRoutes.js";
import { ngoRouter, dashboardRouter, chatRouter, scannerRouter, adminRouter } from "./routes/featureRoutes.js";
import { startExpiryJob } from "./services/expiryJob.js";
import { aiEnabled } from "./services/anthropic.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: [config.frontendUrl, "http://127.0.0.1:5173"], credentials: true }));
app.use(express.json({ limit: "8mb" })); // scanner uploads arrive as base64 JSON

// Test backend
app.get("/", (req, res) => {
    res.json({ message: "FoodLink Backend is running!" });
});

// Test database
app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS result");
        res.json({ success: true, message: "MySQL database connected successfully!", data: rows });
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ success: false, message: "Database connection failed", error: error.message });
    }
});

app.get("/api/health", (req, res) =>
    res.json({ status: "ok", features: { googleOAuth: googleEnabled, aiScanner: aiEnabled() } }));

app.use("/api/auth", authRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/allocations", allocationRoutes);
app.use("/api/ngos", ngoRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/chat", chatRouter);
app.use("/api/scanner", scannerRouter);
app.use("/api/admin", adminRouter);

app.use("/api", (req, res) => res.status(404).json({ success: false, message: "Endpoint not found." }));

// Last-resort error handler (e.g. malformed JSON, oversized body)
app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error("Unhandled error:", err);
    res.status(status).json({ success: false, message: status === 413 ? "Upload is too large." : status < 500 ? "Bad request." : "Server error." });
});

const PORT = config.port;

try {
    await db.query("SELECT 1");
} catch (e) {
    console.error(`\n[db] Cannot connect to MySQL: ${e.message}`);
    console.error("[db] Check backend/.env and that MySQL is running, then run: npm run db:setup\n");
    process.exit(1);
}

startExpiryJob();
app.listen(PORT, () => {
    console.log(`FoodLink Backend running on port ${PORT}`);
    console.log(`  Google OAuth: ${googleEnabled ? "enabled" : "not configured (add GOOGLE_CLIENT_ID/SECRET)"}`);
    console.log(`  AI scanner:   ${aiEnabled() ? "enabled" : "not configured (add ANTHROPIC_API_KEY)"}`);
});
