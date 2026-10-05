import { config } from "../config/env.js";

export const aiEnabled = () => Boolean(config.anthropic.apiKey);

/** Minimal Anthropic Messages API client (uses Node's built-in fetch, no SDK needed). */
export async function callClaude({ system, messages, maxTokens = 800 }) {
    if (!aiEnabled()) {
        const e = new Error("ANTHROPIC_API_KEY is not set");
        e.code = "NO_KEY";
        throw e;
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": config.anthropic.apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: config.anthropic.model, max_tokens: maxTokens, system, messages }),
    });
    const data = await res.json();
    if (!res.ok) {
        const e = new Error(data?.error?.message || `Anthropic API error ${res.status}`);
        e.code = "API_ERROR";
        throw e;
    }
    return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
