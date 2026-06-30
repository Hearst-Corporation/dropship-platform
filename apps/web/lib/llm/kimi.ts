import OpenAI from "openai";

/**
 * OpenAI client — official API. Used by light/chat-style call sites.
 * Provider migrated from Hypercli/Kimi to OpenAI (GPT-4o) in June 2026.
 * The exported name stays `kimi`/`KIMI_MODEL` so call sites are unchanged.
 */
export const kimi = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "build-placeholder",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

export const KIMI_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o";
