import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createRequest, listMyRequests, cancelRequest, listOpenRequests } from "../controllers/requestController.js";

const router = express.Router();
router.use(authenticate);

router.post("/", requireRole("ngo"), createRequest);
router.get("/my", requireRole("ngo"), listMyRequests);
router.get("/open", requireRole("restaurant", "admin"), listOpenRequests);
router.patch("/:id/cancel", requireRole("ngo"), cancelRequest);

export default router;
