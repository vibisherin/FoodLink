import express from "express";

import {
    getFoodItems,
    addFoodItem
} from "../controllers/foodController.js";

const router = express.Router();

router.get("/", getFoodItems);

router.post("/", addFoodItem);

export default router;