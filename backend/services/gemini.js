import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const aiEnabled = () => Boolean(apiKey);

export const callGemini = async ({ system, imageBase64, mimeType, prompt }) => {
    if (!genAI) {
        const error = new Error("Gemini API key is not configured.");
        error.code = "NO_KEY";
        throw error;
    }

    const model = genAI.getGenerativeModel({
       model: "gemini-3.5-flash-lite",
        systemInstruction: system,
    });

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType,
                data: imageBase64,
            },
        },
        {
            text: prompt,
        },
    ]);

    return result.response.text();
};