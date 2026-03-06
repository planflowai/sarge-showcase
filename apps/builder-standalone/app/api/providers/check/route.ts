import { NextResponse } from "next/server";

/**
 * GET /api/providers/check — Tests all configured API keys with lightweight calls.
 * Returns connection status for each provider.
 */

interface ProviderStatus {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  latencyMs?: number;
  error?: string;
}

const PROVIDERS_TO_CHECK: { id: string; name: string; color: string; envKey: string; check: (key: string) => Promise<{ ok: boolean; latencyMs: number; error?: string }> }[] = [
  {
    id: "anthropic", name: "Anthropic (Claude)", color: "#D97757",
    envKey: "ANTHROPIC_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "openai", name: "OpenAI (GPT)", color: "#10A37F",
    envKey: "OPENAI_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "google", name: "Google (Gemini)", color: "#4285F4",
    envKey: "GOOGLE_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "xai", name: "xAI (Grok)", color: "#000000",
    envKey: "XAI_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://api.x.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "deepseek", name: "DeepSeek", color: "#4D6BFE",
    envKey: "DEEPSEEK_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://api.deepseek.com/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "mistral", name: "Mistral", color: "#FF7000",
    envKey: "MISTRAL_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "groq", name: "Groq", color: "#F55036",
    envKey: "GROQ_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "together", name: "Together AI", color: "#6366F1",
    envKey: "TOGETHER_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://api.together.xyz/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "perplexity", name: "Perplexity", color: "#20B2AA",
    envKey: "PERPLEXITY_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "sonar", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
  {
    id: "huggingface", name: "HuggingFace", color: "#FFD21E",
    envKey: "HUGGINGFACE_API_KEY",
    check: async (key) => {
      const start = Date.now();
      const res = await fetch("https://router.huggingface.co/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
    },
  },
];

export async function GET() {
  // Also check Ollama
  const results: ProviderStatus[] = [];

  // Check all cloud providers in parallel
  const checks = PROVIDERS_TO_CHECK.map(async (p) => {
    const key = process.env[p.envKey];
    if (!key) {
      return { id: p.id, name: p.name, color: p.color, connected: false, error: "No API key" };
    }
    try {
      const result = await p.check(key);
      return { id: p.id, name: p.name, color: p.color, connected: result.ok, latencyMs: result.latencyMs, error: result.error };
    } catch (err) {
      return { id: p.id, name: p.name, color: p.color, connected: false, error: err instanceof Error ? err.message : "Check failed" };
    }
  });

  // Check Ollama
  const ollamaCheck = (async (): Promise<ProviderStatus> => {
    try {
      const start = Date.now();
      const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(5000) });
      return { id: "ollama", name: "Ollama (Local)", color: "#808080", connected: res.ok, latencyMs: Date.now() - start };
    } catch {
      return { id: "ollama", name: "Ollama (Local)", color: "#808080", connected: false, error: "Not running" };
    }
  })();

  const allResults = await Promise.all([...checks, ollamaCheck]);
  results.push(...allResults);

  return NextResponse.json({ providers: results });
}
