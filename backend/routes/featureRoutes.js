import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { listNgos, getNgo } from "../controllers/ngoController.js";
import { getSummary, getRecentAccess } from "../controllers/dashboardController.js";
import { chat } from "../controllers/chatController.js";
import { analyzeImage } from "../controllers/scannerController.js";
import { getStats, listUsers, setUserActive, listActivity } from "../controllers/adminController.js";
import { listDonations } from "../controllers/donationController.js";

export const ngoRouter = express.Router();
ngoRouter.use(authenticate, requireRole("restaurant", "admin"));
ngoRouter.get("/", listNgos);
ngoRouter.get("/:id", getNgo);

export const dashboardRouter = express.Router();
dashboardRouter.use(authenticate);
dashboardRouter.get("/summary", getSummary);
dashboardRouter.get("/recent", getRecentAccess);

export const chatRouter = express.Router();
chatRouter.post("/", authenticate, chat);

export const scannerRouter = express.Router();
scannerRouter.post("/analyze", authenticate, requireRole("restaurant"), analyzeImage);

export const adminRouter = express.Router();
adminRouter.use(authenticate, requireRole("admin"));
adminRouter.get("/stats", getStats);
adminRouter.get("/users", listUsers);
adminRouter.patch("/users/:id/active", setUserActive);
adminRouter.get("/activity", listActivity);
adminRouter.get("/donations", listDonations);
