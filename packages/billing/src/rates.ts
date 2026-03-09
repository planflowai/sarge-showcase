export interface ModelRate {
  input: number;   // USD per 1M input tokens
  output: number;  // USD per 1M output tokens
}

/**
 * Single source of truth for all model pricing.
 * Updated: 2026-03-09 — matched to SARGE_Model_Pricing_Breakdown.html
 * DO NOT hardcode rates anywhere else. Import getRate() or MODEL_RATES.
 */
export const MODEL_RATES: Record<string, ModelRate> = {
  // ── Anthropic (Mar 2026) ─────────────────────────────────
  // API returns dated IDs like claude-sonnet-4-20250514 (no minor version)
  // AND claude-sonnet-4-5-20250514 (with minor version) — need both
  "claude-opus-4-6":              { input: 5.00,  output: 25.00 },
  "claude-opus-4.6":              { input: 5.00,  output: 25.00 },
  "claude-opus-4-20250514":       { input: 5.00,  output: 25.00 },
  "claude-opus-4-5-20250514":     { input: 5.00,  output: 25.00 },
  "claude-opus-4.5":              { input: 5.00,  output: 25.00 },
  "claude-opus-4-5":              { input: 5.00,  output: 25.00 },
  "claude-sonnet-4-6":            { input: 3.00,  output: 15.00 },
  "claude-sonnet-4.6":            { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-20250514":     { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5-20250514":   { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5-20241022":   { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5-20250929":   { input: 3.00,  output: 15.00 },
  "claude-sonnet-4.5":            { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5":            { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001":    { input: 1.00,  output: 5.00  },
  "claude-haiku-4.5":             { input: 1.00,  output: 5.00  },
  "claude-haiku-4-5":             { input: 1.00,  output: 5.00  },

  // ── OpenAI (Mar 2026) ────────────────────────────────────
  "gpt-5.4":                      { input: 2.50,  output: 20.00 },
  "gpt-5.2":                      { input: 1.75,  output: 14.00 },
  "gpt-5-mini":                   { input: 0.25,  output: 2.00  },
  "gpt-5-nano":                   { input: 0.05,  output: 0.40  },
  "gpt-4.1":                      { input: 2.00,  output: 8.00  },
  "gpt-4.1-mini":                 { input: 0.40,  output: 1.60  },
  "gpt-4o":                       { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":                  { input: 0.15,  output: 0.60  },
  "o3":                           { input: 10.00, output: 40.00 },
  "o4-mini":                      { input: 1.10,  output: 4.40  },
  "o1":                           { input: 15.00, output: 60.00 },
  "o1-mini":                      { input: 3.00,  output: 12.00 },

  // ── Google (Mar 2026) ────────────────────────────────────
  "gemini-3.1-pro-preview":       { input: 2.00,  output: 12.00 },
  "gemini-3-flash-preview":       { input: 0.50,  output: 3.00  },
  "gemini-3-flash":               { input: 0.50,  output: 3.00  },
  "gemini-2.5-pro":               { input: 1.25,  output: 10.00 },
  "gemini-2.5-flash":             { input: 0.30,  output: 2.50  },
  "gemini-2.5-flash-lite":        { input: 0.10,  output: 0.40  },
  "gemini-2.0-flash":             { input: 0.10,  output: 0.40  },
  "gemini-2.0-flash-lite":        { input: 0.075, output: 0.30  },

  // ── xAI (Mar 2026) ─────────────────────────────────────
  "grok-3":                       { input: 3.00,  output: 15.00 },
  "grok-3-mini":                  { input: 0.30,  output: 0.50  },
  "grok-4":                       { input: 3.00,  output: 15.00 },
  "grok-4-0709":                  { input: 3.00,  output: 15.00 },
  "grok-4.1-fast":                { input: 0.20,  output: 0.50  },
  "grok-4-1-fast-non-reasoning":  { input: 0.20,  output: 0.50  },
  "grok-4-1-fast-reasoning":      { input: 0.20,  output: 0.50  },
  "grok-4-fast":                  { input: 0.20,  output: 0.50  },
  "grok-code-fast-1":             { input: 0.20,  output: 1.50  },

  // ── DeepSeek (Mar 2026) ─────────────────────────────────
  "deepseek-chat":                { input: 0.28,  output: 0.42  },
  "deepseek-reasoner":            { input: 0.50,  output: 2.18  },
  "deepseek-r1":                  { input: 0.50,  output: 2.18  },
  "deepseek-v3":                  { input: 0.32,  output: 0.89  },
  "deepseek-v3.1":                { input: 0.15,  output: 0.75  },
  "deepseek-v3.2":                { input: 0.28,  output: 0.42  },

  // ── Mistral (Mar 2026) ──────────────────────────────────
  "devstral-2":                   { input: 0.40,  output: 2.00  },
  "devstral-2512":                { input: 0.40,  output: 2.00  },
  "devstral-small-2":             { input: 0.10,  output: 0.30  },
  "devstral-small-2512":          { input: 0.10,  output: 0.30  },
  "mistral-medium-3":             { input: 0.40,  output: 2.00  },
  "mistral-medium-3.1":           { input: 0.40,  output: 2.00  },
  "mistral-small-3.2":            { input: 0.06,  output: 0.18  },
  "mistral-large-2411":           { input: 2.00,  output: 6.00  },
  "codestral-2508":               { input: 0.30,  output: 0.90  },
  "mistral-nemo":                 { input: 0.02,  output: 0.05  },

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

  // Anthropic dated variants: claude-{type}-{major}-{YYYYMMDD} → match claude-{type}-{major}-{minor}
  // API returns e.g. "claude-sonnet-4-20250514" but rates has "claude-sonnet-4-5" or "claude-sonnet-4-5-20250514"
  const anthropicDated = lower.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d{8})$/);
  if (anthropicDated) {
    const [, type, major] = anthropicDated;
    const base = `claude-${type}-${major}`;
    // Try base without minor version (claude-sonnet-4)
    for (const [key, rate] of Object.entries(MODEL_RATES)) {
      if (key.startsWith(base)) return rate;
    }
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
