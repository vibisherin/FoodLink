import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("⚠️ GEMINI_API_KEY is not configured");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const aiEnabled = Boolean(apiKey);

export async function callGemini(
  prompt,
  imageBase64 = null,
  mimeType = "image/jpeg"
) {
  if (!ai) {
    throw new Error("Gemini API key is not configured");
  }

  const contents = [];

  if (prompt) {
    contents.push({ text: prompt });
  }

  if (imageBase64) {
    contents.push({
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    });
  }

  const models = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
];

  let lastError;

  for (const model of models) {
    try {
      console.log(`🤖 Trying Gemini model: ${model}`);

      const response = await ai.models.generateContent({
        model,
        contents,
      });

      return response.text;
    } catch (error) {
      lastError = error;

      console.warn(
        `Gemini ${model} failed:`,
        error?.message || error
      );

      // Retry another model for temporary server/rate-limit errors
      if (
        !String(error?.message || "").includes("503") &&
        !String(error?.message || "").includes("429")
      ) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Gemini request failed");
}