import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { listDonations, getDonation, claimFood, updateStatus } from "../controllers/donationController.js";

const router = express.Router();
router.use(authenticate);

router.get("/", listDonations);
router.post("/claim", requireRole("ngo"), claimFood);
router.get("/:id", getDonation);
router.patch("/:id/status", requireRole("restaurant", "ngo"), updateStatus);

export default router;
