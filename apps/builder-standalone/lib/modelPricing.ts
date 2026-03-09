/**
 * Model Pricing Data — Editable
 *
 * To update: change prices, add models, or add providers below.
 * The Forge Trials dashboard reads from this file.
 * All costs are per 1M tokens. Context is in tokens.
 *
 * Last verified: March 2026
 */

export type PricingTier = "budget" | "mid" | "premium" | "free" | "beta";

export interface ModelPricing {
  /** Display name (e.g. "Grok 4.1 Fast") */
  name: string;
  /** Cost per 1M input tokens in USD */
  inputPer1M: number | null;
  /** Cost per 1M output tokens in USD */
  outputPer1M: number | null;
  /** Context window size (e.g. "2M", "128K", "200K") */
  context: string;
  /** Pricing tier */
  tier: PricingTier;
  /** Optional note (e.g. "reasoning", "vision", "beta") */
  note?: string;
}

export interface ProviderPricing {
  /** Provider display name */
  label: string;
  /** Dot color for the provider badge */
  color: string;
  /** Models in this provider group */
  models: Record<string, ModelPricing>;
}

/**
 * All model pricing data, keyed by provider ID (matches model store provider field).
 * Edit this object to update pricing across the dashboard.
 */
export const MODEL_PRICING: Record<string, ProviderPricing> = {
  xai: {
    label: "xAI — Grok",
    color: "#EF4444",
    models: {
      "grok-4.1-fast": { name: "Grok 4.1 Fast", inputPer1M: 0.20, outputPer1M: 0.50, context: "2M", tier: "budget" },
      "grok-4-fast": { name: "Grok 4 Fast", inputPer1M: 0.20, outputPer1M: 0.50, context: "2M", tier: "budget" },
      "grok-code-fast-1": { name: "Grok Code Fast 1", inputPer1M: 0.20, outputPer1M: 1.50, context: "2M", tier: "budget" },
      "grok-4": { name: "Grok 4", inputPer1M: 3.00, outputPer1M: 15.00, context: "256K", tier: "premium" },
      "grok-4.2-beta": { name: "Grok 4.2 (beta)", inputPer1M: null, outputPer1M: null, context: "—", tier: "beta", note: "Pricing TBD" },
      "grok-3": { name: "Grok 3", inputPer1M: 3.00, outputPer1M: 15.00, context: "131K", tier: "premium" },
      "grok-3-mini": { name: "Grok 3 Mini", inputPer1M: 0.30, outputPer1M: 0.50, context: "131K", tier: "budget" },
    },
  },

  anthropic: {
    label: "Anthropic — Claude",
    color: "#B570FA",
    models: {
      "claude-opus-4-6": { name: "Claude Opus 4.6", inputPer1M: 5.00, outputPer1M: 25.00, context: "1M", tier: "premium" },
      "claude-sonnet-4-6": { name: "Claude Sonnet 4.6", inputPer1M: 3.00, outputPer1M: 15.00, context: "200K", tier: "mid" },
      "claude-sonnet-4-5-20250514": { name: "Claude Sonnet 4.5", inputPer1M: 3.00, outputPer1M: 15.00, context: "200K", tier: "mid" },
      "claude-haiku-4-5-20251001": { name: "Claude Haiku 4.5", inputPer1M: 1.00, outputPer1M: 5.00, context: "200K", tier: "budget" },
      "claude-opus-4-5-20250514": { name: "Claude Opus 4.5", inputPer1M: 5.00, outputPer1M: 25.00, context: "200K", tier: "premium" },
    },
  },

  deepseek: {
    label: "DeepSeek",
    color: "#34D399",
    models: {
      "deepseek-chat": { name: "DeepSeek V3.2", inputPer1M: 0.28, outputPer1M: 0.42, context: "128K", tier: "budget" },
      "deepseek-reasoner": { name: "DeepSeek R1", inputPer1M: 0.50, outputPer1M: 2.18, context: "128K", tier: "mid" },
      "deepseek-v3.1": { name: "DeepSeek V3.1", inputPer1M: 0.15, outputPer1M: 0.75, context: "128K", tier: "budget" },
      "deepseek-v3": { name: "DeepSeek V3", inputPer1M: 0.32, outputPer1M: 0.89, context: "164K", tier: "budget" },
    },
  },

  openai: {
    label: "OpenAI — GPT",
    color: "#3AB7FE",
    models: {
      "gpt-5.4": { name: "GPT-5.4", inputPer1M: 2.50, outputPer1M: 20.00, context: "1M", tier: "premium" },
      "gpt-5.2": { name: "GPT-5.2", inputPer1M: 1.75, outputPer1M: 14.00, context: "128K", tier: "mid" },
      "gpt-5-mini": { name: "GPT-5 Mini", inputPer1M: 0.25, outputPer1M: 2.00, context: "128K", tier: "budget" },
      "gpt-5-nano": { name: "GPT-5 Nano", inputPer1M: 0.05, outputPer1M: 0.40, context: "128K", tier: "budget" },
      "gpt-4.1": { name: "GPT-4.1", inputPer1M: 2.00, outputPer1M: 8.00, context: "1M", tier: "mid" },
      "gpt-4.1-mini": { name: "GPT-4.1 Mini", inputPer1M: 0.40, outputPer1M: 1.60, context: "1M", tier: "budget" },
      "gpt-4o": { name: "GPT-4o", inputPer1M: 2.50, outputPer1M: 10.00, context: "128K", tier: "mid" },
      "gpt-4o-mini": { name: "GPT-4o Mini", inputPer1M: 0.15, outputPer1M: 0.60, context: "128K", tier: "budget" },
      "o3": { name: "o3", inputPer1M: 10.00, outputPer1M: 40.00, context: "200K", tier: "premium" },
      "o4-mini": { name: "o4-mini", inputPer1M: 1.10, outputPer1M: 4.40, context: "200K", tier: "mid" },
    },
  },

  google: {
    label: "Google — Gemini",
    color: "#F59E0B",
    models: {
      "gemini-3.1-pro-preview": { name: "Gemini 3.1 Pro Preview", inputPer1M: 2.00, outputPer1M: 12.00, context: "1M", tier: "premium" },
      "gemini-3-flash-preview": { name: "Gemini 3 Flash Preview", inputPer1M: 0.50, outputPer1M: 3.00, context: "1M", tier: "budget" },
      "gemini-2.5-pro": { name: "Gemini 2.5 Pro", inputPer1M: 1.25, outputPer1M: 10.00, context: "1M", tier: "mid" },
      "gemini-2.5-flash": { name: "Gemini 2.5 Flash", inputPer1M: 0.30, outputPer1M: 2.50, context: "1M", tier: "budget" },
      "gemini-2.5-flash-lite": { name: "Gemini 2.5 Flash-Lite", inputPer1M: 0.10, outputPer1M: 0.40, context: "1M", tier: "budget" },
      "gemini-2.0-flash": { name: "Gemini 2.0 Flash", inputPer1M: 0.10, outputPer1M: 0.40, context: "1M", tier: "free" },
      "gemini-2.0-flash-lite": { name: "Gemini 2.0 Flash-Lite", inputPer1M: 0.075, outputPer1M: 0.30, context: "1M", tier: "free" },
    },
  },

  mistral: {
    label: "Mistral",
    color: "#E8722A",
    models: {
      "devstral-2": { name: "Devstral 2 (123B)", inputPer1M: 0.40, outputPer1M: 2.00, context: "256K", tier: "mid" },
      "devstral-small-2": { name: "Devstral Small 2 (24B)", inputPer1M: 0.10, outputPer1M: 0.30, context: "256K", tier: "budget" },
      "mistral-medium-3.1": { name: "Mistral Medium 3.1", inputPer1M: 0.40, outputPer1M: 2.00, context: "128K", tier: "mid" },
      "mistral-small-3.2": { name: "Mistral Small 3.2", inputPer1M: 0.06, outputPer1M: 0.18, context: "128K", tier: "budget" },
      "mistral-large-2411": { name: "Mistral Large 2411", inputPer1M: 2.00, outputPer1M: 6.00, context: "128K", tier: "mid" },
      "codestral-2508": { name: "Codestral 2508", inputPer1M: 0.30, outputPer1M: 0.90, context: "256K", tier: "budget" },
      "mistral-nemo": { name: "Mistral Nemo", inputPer1M: 0.02, outputPer1M: 0.05, context: "128K", tier: "free", note: "Cheapest cloud" },
    },
  },

  huggingface: {
    label: "Hugging Face",
    color: "#D4A843",
    models: {
      "llama-3.3-70b": { name: "Llama 3.3 70B", inputPer1M: 0.80, outputPer1M: 0.80, context: "128K", tier: "budget", note: "Compute-time billing" },
      "qwen-3-235b": { name: "Qwen 3 235B", inputPer1M: null, outputPer1M: null, context: "128K", tier: "mid", note: "Compute-time billing" },
      "qwen3-coder-480b": { name: "Qwen3-Coder-480B", inputPer1M: null, outputPer1M: null, context: "256K", tier: "premium", note: "Compute-time billing" },
    },
  },

  ollama: {
    label: "Local — Ollama",
    color: "#808090",
    models: {
      "qwen2.5-coder:7b": { name: "qwen2.5-coder:7b", inputPer1M: 0, outputPer1M: 0, context: "32K", tier: "free", note: "Local — free" },
      "codellama:7b": { name: "codellama:7b", inputPer1M: 0, outputPer1M: 0, context: "16K", tier: "free", note: "Local — free" },
      "deepseek-coder:6.7b": { name: "deepseek-coder:6.7b", inputPer1M: 0, outputPer1M: 0, context: "16K", tier: "free", note: "Local — free" },
    },
  },
};

/**
 * Look up pricing for a model by its ID and optional provider.
 * Tries exact match first, then fuzzy match on model ID substrings.
 */
export function getModelPricing(modelId: string, provider?: string): ModelPricing | null {
  // Exact match with provider
  if (provider && MODEL_PRICING[provider]) {
    const exact = MODEL_PRICING[provider].models[modelId];
    if (exact) return exact;
  }

  // Exact match across all providers
  for (const prov of Object.values(MODEL_PRICING)) {
    if (prov.models[modelId]) return prov.models[modelId];
  }

  // Fuzzy: try matching model ID as substring
  const lower = modelId.toLowerCase();
  for (const prov of Object.values(MODEL_PRICING)) {
    for (const [key, pricing] of Object.entries(prov.models)) {
      if (lower.includes(key) || key.includes(lower)) return pricing;
      if (lower.includes(pricing.name.toLowerCase()) || pricing.name.toLowerCase().includes(lower)) return pricing;
    }
  }

  return null;
}

/**
 * Get the provider pricing group for a given provider ID.
 */
export function getProviderPricing(provider: string): ProviderPricing | null {
  return MODEL_PRICING[provider] || null;
}

/**
 * Tier badge colors matching the dashboard theme.
 */
export const TIER_COLORS: Record<PricingTier, { bg: string; text: string }> = {
  budget: { bg: "rgba(52,211,153,0.15)", text: "#34D399" },
  mid: { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" },
  premium: { bg: "rgba(239,68,68,0.15)", text: "#EF4444" },
  free: { bg: "rgba(58,183,254,0.15)", text: "#3AB7FE" },
  beta: { bg: "rgba(181,112,250,0.15)", text: "#B570FA" },
};
