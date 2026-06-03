import OpenAI from "openai";

// Cockpit chat LLM client. Default: Kimi via Hypercli. But Hypercli's Kimi GPU
// backend (merely-cuddly-hyena-gpu.hypercli.com) goes down, taking the chat
// with it. Set CHAT_LLM=anthropic to route the chat through Anthropic's
// OpenAI-compatible endpoint instead — same OpenAI client shape, no handler
// change, fully reversible by flipping the env back. Both clients stay
// OpenAI-SDK compatible so @hearst/cockpit-shell's handler is provider-agnostic.
const useAnthropic = process.env.CHAT_LLM === "anthropic";

export const kimi = useAnthropic
  ? new OpenAI({
      apiKey: process.env.ANTHROPIC_API_KEY || "build-placeholder",
      baseURL: "https://api.anthropic.com/v1/",
    })
  : new OpenAI({
      apiKey: process.env.HYPERCLI_API_KEY || "build-placeholder",
      baseURL: process.env.HYPERCLI_BASE_URL || "https://api.hypercli.com/v1",
    });

export const KIMI_MODEL = useAnthropic
  ? process.env.CHAT_ANTHROPIC_MODEL || "claude-sonnet-4-6"
  : process.env.HYPERCLI_DEFAULT_MODEL || "kimi-k2.6";
