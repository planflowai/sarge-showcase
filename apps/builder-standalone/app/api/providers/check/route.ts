import { NextResponse } from "next/server";

/**
 * GET /api/providers/check — Scans ALL environment variables and tests connections.
 * Returns categorized status for every configured service.
 */

interface ServiceStatus {
  id: string;
  name: string;
  envKey: string;
  category: string;
  configured: boolean;
  connected?: boolean;
  latencyMs?: number;
  error?: string;
}

// Lightweight connection tests for services that support them
async function checkBearer(url: string, key: string, timeout = 8000): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(timeout) });
    return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Failed" };
  }
}

async function checkAnthropic(key: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Failed" };
  }
}

async function checkGoogle(key: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, { signal: AbortSignal.timeout(8000) });
    return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Failed" };
  }
}

async function checkOllama(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start, error: "Not running" };
  }
}

async function checkSupabase(url: string, key: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok || res.status === 404, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Failed" };
  }
}

// All known environment variables organized by category
const ENV_REGISTRY: { id: string; name: string; envKey: string; category: string; testFn?: string }[] = [
  // Cloud AI Providers
  { id: "anthropic",   name: "Anthropic (Claude)",  envKey: "ANTHROPIC_API_KEY",    category: "Cloud AI",  testFn: "anthropic" },
  { id: "openai",      name: "OpenAI (GPT)",        envKey: "OPENAI_API_KEY",       category: "Cloud AI",  testFn: "openai" },
  { id: "google",      name: "Google (Gemini)",      envKey: "GOOGLE_API_KEY",       category: "Cloud AI",  testFn: "google" },
  { id: "xai",         name: "xAI (Grok)",          envKey: "XAI_API_KEY",          category: "Cloud AI",  testFn: "xai" },
  { id: "deepseek",    name: "DeepSeek",            envKey: "DEEPSEEK_API_KEY",     category: "Cloud AI",  testFn: "deepseek" },
  { id: "mistral",     name: "Mistral",             envKey: "MISTRAL_API_KEY",      category: "Cloud AI",  testFn: "mistral" },
  { id: "groq",        name: "Groq",                envKey: "GROQ_API_KEY",         category: "Cloud AI",  testFn: "groq" },
  { id: "together",    name: "Together AI",          envKey: "TOGETHER_API_KEY",     category: "Cloud AI",  testFn: "together" },
  { id: "perplexity",  name: "Perplexity",          envKey: "PERPLEXITY_API_KEY",   category: "Cloud AI",  testFn: "perplexity" },
  { id: "huggingface", name: "HuggingFace",         envKey: "HUGGINGFACE_API_KEY",  category: "Cloud AI",  testFn: "huggingface" },

  // Local AI
  { id: "ollama",      name: "Ollama",              envKey: "OLLAMA_URL",            category: "Local AI",  testFn: "ollama" },
  { id: "ollama-pub",  name: "Ollama (Public URL)",  envKey: "NEXT_PUBLIC_OLLAMA_URL", category: "Local AI" },
  { id: "lmstudio",    name: "LM Studio",           envKey: "LOCAL_AI_ENDPOINT",     category: "Local AI" },
  { id: "lmstudio-key",name: "LM Studio Key",       envKey: "LMStudio_API_KEY",      category: "Local AI" },
  { id: "lmstudio-url",name: "LM Studio URL",       envKey: "NEXT_PUBLIC_LM_STUDIO_URL", category: "Local AI" },

  // Database
  { id: "supabase-url",  name: "Supabase URL",      envKey: "NEXT_PUBLIC_SUPABASE_URL",      category: "Database", testFn: "supabase" },
  { id: "supabase-key",  name: "Supabase Key",      envKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY", category: "Database" },

  // Search & Research
  { id: "tavily",        name: "Tavily",             envKey: "TAVILY_API_KEY",         category: "Search" },
  { id: "brave-search",  name: "Brave Search",       envKey: "BRAVE_SEARCH_API_KEY",   category: "Search" },
  { id: "google-search", name: "Google Search",      envKey: "GOOGLE_SEARCH_API_KEY",  category: "Search" },
  { id: "google-cx",     name: "Google Search CX",   envKey: "GOOGLE_SEARCH_CX",       category: "Search" },
  { id: "searxng",       name: "SearXNG",            envKey: "SEARXNG_URL",            category: "Search" },

  // Email
  { id: "resend",        name: "Resend",             envKey: "RESEND_API_KEY",         category: "Email" },
  { id: "notif-email",   name: "Notification Email", envKey: "NOTIFICATION_EMAIL",     category: "Email" },

  // Trading & Finance
  { id: "alpaca-key",    name: "Alpaca Key",         envKey: "ALPACA_API_KEY",         category: "Trading" },
  { id: "alpaca-secret", name: "Alpaca Secret",      envKey: "ALPACA_API_SECRET",      category: "Trading" },
  { id: "finnhub-key",   name: "Finnhub Key",        envKey: "FINNHUB_API_KEY",        category: "Trading" },
  { id: "finnhub-secret",name: "Finnhub Secret",     envKey: "FINNHUB_API_SECRET",     category: "Trading" },
  { id: "polygon-key",   name: "Polygon Key",        envKey: "POLYGON_API_KEY",        category: "Trading" },
  { id: "polygon-secret",name: "Polygon Secret",     envKey: "POLYGON_API_SECRET",     category: "Trading" },

  // Media & Voice
  { id: "pexels",        name: "Pexels",             envKey: "PEXELS_API_KEY",         category: "Media" },
  { id: "xtts",          name: "XTTS (Voice)",       envKey: "NEXT_PUBLIC_XTTS_URL",   category: "Media" },

  // Developer & Build
  { id: "github",        name: "GitHub",             envKey: "GITHUB_TOKEN",           category: "Developer" },
  { id: "builder-dir",   name: "Builder Projects",   envKey: "BUILDER_PROJECTS_DIR",   category: "Developer" },
  { id: "air-gap",       name: "Air Gap Mode",       envKey: "AIR_GAP_MODE",           category: "Developer" },
];

// Connection test map
const TEST_FNS: Record<string, (key: string) => Promise<{ ok: boolean; latencyMs: number; error?: string }>> = {
  anthropic:   (key) => checkAnthropic(key),
  openai:      (key) => checkBearer("https://api.openai.com/v1/models", key),
  google:      (key) => checkGoogle(key),
  xai:         (key) => checkBearer("https://api.x.ai/v1/models", key),
  deepseek:    (key) => checkBearer("https://api.deepseek.com/models", key),
  mistral:     (key) => checkBearer("https://api.mistral.ai/v1/models", key),
  groq:        (key) => checkBearer("https://api.groq.com/openai/v1/models", key),
  together:    (key) => checkBearer("https://api.together.xyz/v1/models", key),
  perplexity:  (key) => checkBearer("https://api.perplexity.ai/models", key),
  huggingface: (key) => checkBearer("https://router.huggingface.co/v1/models", key),
  ollama:      () => checkOllama(),
};

export async function GET() {
  const checks = ENV_REGISTRY.map(async (entry): Promise<ServiceStatus> => {
    const value = process.env[entry.envKey];
    const configured = !!value && value.trim().length > 0;

    const status: ServiceStatus = {
      id: entry.id,
      name: entry.name,
      envKey: entry.envKey,
      category: entry.category,
      configured,
    };

    // Run connection test if available and key is configured
    if (entry.testFn && configured) {
      const testFn = TEST_FNS[entry.testFn];
      if (testFn) {
        try {
          // Special case: supabase needs URL + key
          if (entry.testFn === "supabase") {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (url && key) {
              const result = await checkSupabase(url, key);
              status.connected = result.ok;
              status.latencyMs = result.latencyMs;
              status.error = result.error;
            }
          } else if (entry.testFn === "ollama") {
            const result = await checkOllama();
            status.connected = result.ok;
            status.latencyMs = result.latencyMs;
            status.error = result.error;
          } else {
            const result = await testFn(value!);
            status.connected = result.ok;
            status.latencyMs = result.latencyMs;
            status.error = result.error;
          }
        } catch (err) {
          status.connected = false;
          status.error = err instanceof Error ? err.message : "Check failed";
        }
      }
    }

    return status;
  });

  const results = await Promise.all(checks);

  // Group by category
  const categories: Record<string, ServiceStatus[]> = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = [];
    categories[r.category].push(r);
  }

  return NextResponse.json({ categories, services: results });
}
