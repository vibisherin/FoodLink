import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
    getFoodItems, getFoodItem, addFoodItem, updateFoodItem, deleteFoodItem, getMatches, offerToNgo,
} from "../controllers/foodController.js";

const router = express.Router();
router.use(authenticate);

router.get("/", getFoodItems);
router.post("/", requireRole("restaurant"), addFoodItem);
router.get("/:id", getFoodItem);
router.put("/:id", requireRole("restaurant"), updateFoodItem);
router.delete("/:id", requireRole("restaurant"), deleteFoodItem);
router.get("/:id/matches", requireRole("restaurant", "admin"), getMatches);
router.post("/:id/offer", requireRole("restaurant"), offerToNgo);

export default router;
