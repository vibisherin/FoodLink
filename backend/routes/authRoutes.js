import express from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth.js";
import * as c from "../controllers/authController.js";

const router = express.Router();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Please try again in a few minutes." },
});

router.post("/register", limiter, c.register);
router.post("/login", limiter, c.login);
router.post("/refresh", c.refresh);
router.post("/logout", c.logout);
router.get("/providers", c.providers);
router.get("/google", c.googleStart);
router.get("/google/callback", c.googleCallback);
router.get("/me", authenticate, c.me);
router.patch("/me", authenticate, c.updateMe);

export default router;
