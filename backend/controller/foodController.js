import db from "../config/db.js";

// Get all food items
export const getFoodItems = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                food_items.*,
                restaurants.name AS restaurant_name
            FROM food_items
            LEFT JOIN restaurants
                ON food_items.restaurant_id = restaurants.id
            ORDER BY food_items.created_at DESC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Get Food Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch food items"
        });
    }
};


// Add a new food item
export const addFoodItem = async (req, res) => {
    try {
        const {
            restaurant_id,
            name,
            quantity,
            expiry_time,
            status
        } = req.body;

        const [result] = await db.query(
            `INSERT INTO food_items
            (restaurant_id, name, quantity, expiry_time, status)
            VALUES (?, ?, ?, ?, ?)`,
            [
                restaurant_id,
                name,
                quantity,
                expiry_time,
                status || "Available"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Food item added successfully",
            food_id: result.insertId
        });

    } catch (error) {
        console.error("Add Food Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to add food item"
        });
    }
};