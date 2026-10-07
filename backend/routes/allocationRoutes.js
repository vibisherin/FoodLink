import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { allocateFood } from "../controllers/allocationController.js";

const router = express.Router();
router.use(authenticate);

router.post("/", requireRole("restaurant"), allocateFood);

export default router;
