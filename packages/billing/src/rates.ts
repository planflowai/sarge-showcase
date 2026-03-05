export interface ModelRate {
  input: number;   // USD per 1M input tokens
  output: number;  // USD per 1M output tokens
}

/**
 * Single source of truth for all model pricing.
 * Updated: 2026-03-05 — real 2026 rates from provider docs.
 * DO NOT hardcode rates anywhere else. Import getRate() or MODEL_RATES.
 */
export const MODEL_RATES: Record<string, ModelRate> = {
  // ── Anthropic ────────────────────────────────────────────
  "claude-opus-4-6":              { input: 15.00, output: 75.00 },
  "claude-opus-4.6":              { input: 15.00, output: 75.00 },
  "claude-opus-4-5-20250514":     { input: 15.00, output: 75.00 },
  "claude-opus-4.5":              { input: 15.00, output: 75.00 },
  "claude-opus-4-5":              { input: 15.00, output: 75.00 },
  "claude-sonnet-4-6":            { input: 3.00,  output: 15.00 },
  "claude-sonnet-4.6":            { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5-20241022":   { input: 3.00,  output: 15.00 },
  "claude-sonnet-4.5":            { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5":            { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001":    { input: 0.80,  output: 4.00  },
  "claude-haiku-4.5":             { input: 0.80,  output: 4.00  },
  "claude-haiku-4-5":             { input: 0.80,  output: 4.00  },

  // ── OpenAI ───────────────────────────────────────────────
  "gpt-4.1":                      { input: 2.00,  output: 8.00  },
  "gpt-4.1-mini":                 { input: 0.40,  output: 1.60  },
  "gpt-4o":                       { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":                  { input: 0.15,  output: 0.60  },
  "gpt-5-mini":                   { input: 1.10,  output: 4.40  },
  "o3":                           { input: 10.00, output: 40.00 },
  "o4-mini":                      { input: 1.10,  output: 4.40  },
  "o1":                           { input: 15.00, output: 60.00 },
  "o1-mini":                      { input: 3.00,  output: 12.00 },

  // ── Google ───────────────────────────────────────────────
  "gemini-2.5-pro":               { input: 1.25,  output: 10.00 },
  "gemini-2.5-flash":             { input: 0.15,  output: 0.60  },
  "gemini-2.0-flash":             { input: 0.10,  output: 0.40  },
  "gemini-3-flash":               { input: 0.15,  output: 0.60  },

  // ── xAI ──────────────────────────────────────────────────
  "grok-3":                       { input: 3.00,  output: 15.00 },
  "grok-3-mini":                  { input: 0.30,  output: 0.50  },
  "grok-4":                       { input: 3.00,  output: 15.00 },
  "grok-4.1-fast":                { input: 0.80,  output: 2.00  },

  // ── DeepSeek ─────────────────────────────────────────────
  "deepseek-chat":                { input: 0.27,  output: 1.10  },
  "deepseek-reasoner":            { input: 0.55,  output: 2.19  },
  "deepseek-v3":                  { input: 0.27,  output: 1.10  },
  "deepseek-r1":                  { input: 0.55,  output: 2.19  },

  // ── Mistral ──────────────────────────────────────────────
  "devstral-2512":                { input: 0.30,  output: 0.90  },
  "devstral-small-2512":          { input: 0.30,  output: 0.90  },
  "mistral-medium-3":             { input: 0.40,  output: 2.00  },

  // ── HuggingFace (serverless — variable pricing) ──────────
  "huggingface:*":                { input: 0,     output: 0     },

  // ── Local — always free ──────────────────────────────────
  "local:*":                      { input: 0,     output: 0     },
};

/** Console URLs per provider */
export const PROVIDER_CONSOLE_URLS: Record<string, string> = {
  anthropic:    "https://console.anthropic.com/settings/billing",
  openai:       "https://platform.openai.com/settings/organization/billing/overview",
  google:       "https://aistudio.google.com/billing",
  xai:          "https://console.x.ai",
  deepseek:     "https://platform.deepseek.com/usage",
  mistral:      "https://console.mistral.ai/billing",
  huggingface:  "https://huggingface.co/settings/billing",
};

/** Provider balance API info — which endpoints to call for live balance */
export const PROVIDER_BALANCE_APIS: Record<string, { method: string; url: string; headerKey: string }> = {
  openai:    { method: "GET", url: "https://api.openai.com/v1/organization/costs?start_date=2026-01-01&limit=0", headerKey: "Authorization" },
  deepseek:  { method: "GET", url: "https://api.deepseek.com/user/balance",    headerKey: "Authorization" },
};

// Prefixes that are always local (free)
const LOCAL_PREFIXES = [
  "qwen", "phi", "llama", "codellama", "gemma",
  "cogito", "starcoder", "deepseek-coder", "nomic", "mxbai",
];

/** Get rate for a model. Local models always return zero. */
export function getRate(model: string, provider: string): ModelRate {
  // Local providers are always free
  if (provider === "ollama" || provider === "lmstudio" || provider === "lm-studio") {
    return MODEL_RATES["local:*"];
  }

  // HuggingFace — variable pricing
  if (provider === "huggingface") {
    return MODEL_RATES["huggingface:*"];
  }

  // Exact match
  if (MODEL_RATES[model]) return MODEL_RATES[model];

  // Check local prefixes (handles local models on any provider)
  const lower = model.toLowerCase();
  if (LOCAL_PREFIXES.some(p => lower.startsWith(p))) {
    return MODEL_RATES["local:*"];
  }

  // Partial match — try matching the base name without version suffixes
  for (const [key, rate] of Object.entries(MODEL_RATES)) {
    if (key === "local:*" || key === "huggingface:*") continue;
    if (lower.includes(key) || key.includes(lower)) return rate;
  }

  // Unknown cloud model — return zero rather than guess wrong
  return { input: 0, output: 0 };
}

/** Get all rates (for dashboard display). */
export function getAllRates(): Record<string, ModelRate> {
  return { ...MODEL_RATES };
}
