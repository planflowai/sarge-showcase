export interface ModelRate {
  input: number;   // USD per 1M input tokens
  output: number;  // USD per 1M output tokens
}

export const MODEL_RATES: Record<string, ModelRate> = {
  // Anthropic
  "claude-opus-4-5-20250514":  { input: 15.00, output: 75.00 },
  "claude-opus-4.5":    { input: 15.00, output: 75.00 },
  "claude-opus-4-5":    { input: 15.00, output: 75.00 },
  "claude-opus-4.6":    { input: 15.00, output: 75.00 },
  "claude-sonnet-4-5-20241022": { input: 3.00, output: 15.00 },
  "claude-sonnet-4.5":  { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5":  { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001":  { input: 0.80, output: 4.00 },
  "claude-haiku-4.5":   { input: 0.80,  output: 4.00  },
  "claude-haiku-4-5":   { input: 0.80,  output: 4.00  },
  "claude-sonnet-4.6":  { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-6":  { input: 3.00,  output: 15.00 },
  "claude-opus-4-6":    { input: 15.00, output: 75.00 },

  // OpenAI
  "gpt-4o":             { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":        { input: 0.15,  output: 0.60  },
  "gpt-5.2":            { input: 3.00,  output: 12.00 },
  "o1":                 { input: 15.00, output: 60.00 },
  "o1-mini":            { input: 3.00,  output: 12.00 },

  // xAI
  "grok-4":             { input: 2.00,  output: 10.00 },
  "grok-4.1-fast":      { input: 0.20,  output: 0.50  },

  // Google
  "gemini-2.5-flash":   { input: 0.50,  output: 3.00  },
  "gemini-3-flash":     { input: 0.50,  output: 3.00  },
  "gemini-2.5-pro":     { input: 1.25,  output: 10.00 },

  // DeepSeek
  "deepseek-chat":      { input: 0.27,  output: 1.10  },
  "deepseek-reasoner":  { input: 0.55,  output: 2.19  },
  "deepseek-v3":        { input: 0.27,  output: 1.10  },
  "deepseek-r1":        { input: 0.55,  output: 2.19  },

  // Local — always free
  "local:*":            { input: 0,     output: 0     },
};

// Prefixes that are always local (free)
const LOCAL_PREFIXES = [
  "qwen", "phi", "llama", "mistral", "codellama", "gemma",
  "cogito", "starcoder", "deepseek-coder", "nomic", "mxbai",
];

/** Get rate for a model. Local models always return zero. */
export function getRate(model: string, provider: string): ModelRate {
  // Local providers are always free
  if (provider === "ollama" || provider === "lmstudio" || provider === "lm-studio") {
    return MODEL_RATES["local:*"];
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
    if (key === "local:*") continue;
    if (lower.includes(key) || key.includes(lower)) return rate;
  }

  // Unknown cloud model — return zero rather than guess wrong
  return { input: 0, output: 0 };
}

/** Get all rates (for dashboard display). */
export function getAllRates(): Record<string, ModelRate> {
  return { ...MODEL_RATES };
}
