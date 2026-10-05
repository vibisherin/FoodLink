import { chatReply } from "../services/chatbot.js";

export const chat = async (req, res) => {
    try {
        const message = String(req.body.message || "").trim().slice(0, 500);
        if (!message) return res.status(400).json({ success: false, message: "Type a message first." });
        const lang = ["en", "hi", "ta"].includes(req.body.lang) ? req.body.lang : req.user.language;
        res.json({ success: true, ...(await chatReply({ user: req.user, message, lang })) });
    } catch (err) {
        console.error("Chat error:", err);
        res.status(500).json({ success: false, message: "The assistant is unavailable right now." });
    }
};
