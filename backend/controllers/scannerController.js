import { callGemini, aiEnabled } from "../services/gemini.js";
import { CATEGORIES } from "../utils/validate.js";
import { logActivity } from "../utils/activity.js";

const LANG_NAME = {
    en: "English",
    hi: "Hindi",
    ta: "Tamil",
};

const MAX_BYTES = 5 * 1024 * 1024;

const SYSTEM = `You are the food-safety vision module of FoodLink, a platform that helps restaurants donate surplus food before it spoils.

Look at the photo and respond with ONLY one JSON object, no prose, no markdown fences:

{
  "is_food": boolean,
  "detected_foods": [
    {
      "name": string,
      "confidence": integer 0-100
    }
  ],
  "category": "cooked" | "bakery" | "produce" | "dairy" | "packaged",
  "freshness": "fresh" | "use_soon" | "spoiled",
  "estimated_shelf_hours": integer,
  "safe_to_donate": boolean,
  "storage_tip": string,
  "reasoning": string
}

Be conservative: if you cannot judge freshness from the image, say "use_soon" and keep shelf hours short.

If the image is not food, set is_food=false and use neutral values for the other fields.`;

export const analyzeImage = async (req, res) => {
    try {
        if (!aiEnabled()) {
            return res.status(503).json({
                success: false,
                code: "NO_KEY",
                message:
                    "The AI scanner needs a Gemini API key. Add GEMINI_API_KEY to backend/.env and restart the server.",
            });
        }

        const { image, lang } = req.body;

        const m =
            /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
                image || ""
            );

        if (!m) {
            return res.status(400).json({
                success: false,
                message: "Upload a JPEG, PNG or WebP image.",
            });
        }

        if (Buffer.byteLength(m[2], "base64") > MAX_BYTES) {
            return res.status(413).json({
                success: false,
                message: "Image is larger than 5 MB.",
            });
        }

        const language = LANG_NAME[lang] || "English";

        const text = await callGemini({
            system: `${SYSTEM}

Write "storage_tip" and "reasoning" in ${language}.
Keep food names in ${language} too, but all enum values exactly as specified.`,

            imageBase64: m[2],
            mimeType: m[1],

            prompt: "Analyse this food photo and return only the requested JSON object.",
        });

        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");

        if (start === -1 || end === -1) {
            return res.status(502).json({
                success: false,
                message:
                    "The AI returned an unreadable answer. Please try again.",
            });
        }

        const json = text.slice(start, end + 1);

        let r;

        try {
            r = JSON.parse(json);
        } catch {
            return res.status(502).json({
                success: false,
                message:
                    "The AI returned an unreadable answer. Please try again.",
            });
        }

        const result = {
            is_food: Boolean(r.is_food),

            detected_foods: (
                Array.isArray(r.detected_foods) ? r.detected_foods : []
            )
                .slice(0, 6)
                .map((f) => ({
                    name: String(f.name || "").slice(0, 80),
                    confidence: Math.max(
                        0,
                        Math.min(
                            100,
                            Math.round(Number(f.confidence) || 0)
                        )
                    ),
                })),

            category: CATEGORIES.includes(r.category)
                ? r.category
                : "cooked",

            freshness: ["fresh", "use_soon", "spoiled"].includes(
                r.freshness
            )
                ? r.freshness
                : "use_soon",

            estimated_shelf_hours: Math.max(
                0,
                Math.min(
                    240,
                    Math.round(Number(r.estimated_shelf_hours) || 0)
                )
            ),

            safe_to_donate:
                Boolean(r.safe_to_donate) &&
                r.freshness !== "spoiled",

            storage_tip: String(r.storage_tip || "").slice(0, 300),

            reasoning: String(r.reasoning || "").slice(0, 300),
        };

        await logActivity(
            req.user.id,
            "food_scanned",
            result.detected_foods.map((f) => f.name).join(", ")
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        console.error("Scanner error:", err);

        res.status(err.code === "API_ERROR" ? 502 : 500).json({
            success: false,
            message: `Scanner failed: ${err.message}`,
        });
    }
};