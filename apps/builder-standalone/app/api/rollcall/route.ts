import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/rollcall — Tests a single model directly (no fallback).
 * Returns the model's self-identification to verify routing.
 * Body: { provider: string, model: string }
 */

const ROLLCALL_PROMPT = "Respond with ONLY your model name/identifier. Nothing else. Just your name.";

type TestResult = { success: boolean; response?: string; error?: string; latencyMs: number };

async function testOllama(model: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: ROLLCALL_PROMPT, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { success: false, error: `${res.status}: ${(await res.text()).substring(0, 100)}`, latencyMs };
    const data = await res.json();
    return { success: true, response: data.response?.trim(), latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

// OpenAI reasoning models (o-series) require max_completion_tokens instead of max_tokens
const REASONING_MODELS = ["o3", "o4-mini", "o3-mini", "o1", "o1-mini", "o1-preview"];

function isReasoningModel(model: string): boolean {
  return REASONING_MODELS.some(rm => model === rm || model.startsWith(`${rm}-`));
}

async function testOpenAICompatible(
  model: string, apiKey: string, baseUrl: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const tokenParam = isReasoningModel(model)
      ? { max_completion_tokens: 100 }
      : { max_tokens: 100 };
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, ...tokenParam, messages: [{ role: "user", content: ROLLCALL_PROMPT }] }),
      signal: AbortSignal.timeout(30000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { success: false, error: `${res.status}: ${(await res.text()).substring(0, 200)}`, latencyMs };
    const data = await res.json();
    return { success: true, response: data.choices?.[0]?.message?.content?.trim() || "No response", latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

async function testAnthropic(model: string, apiKey: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 100, messages: [{ role: "user", content: ROLLCALL_PROMPT }] }),
      signal: AbortSignal.timeout(30000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { success: false, error: `${res.status}: ${(await res.text()).substring(0, 200)}`, latencyMs };
    const data = await res.json();
    return { success: true, response: data.content?.[0]?.text?.trim() || "No response", latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

async function testGoogle(model: string, apiKey: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: ROLLCALL_PROMPT }] }] }),
        signal: AbortSignal.timeout(30000),
      }
    );
    const latencyMs = Date.now() - start;
    if (!res.ok) return { success: false, error: `${res.status}: ${(await res.text()).substring(0, 200)}`, latencyMs };
    const data = await res.json();
    return { success: true, response: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response", latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

// Provider → { baseUrl, envKey } for OpenAI-compatible APIs
const PROVIDER_CONFIG: Record<string, { baseUrl: string; envKey: string }> = {
  openai:    { baseUrl: "https://api.openai.com/v1",       envKey: "OPENAI_API_KEY" },
  xai:       { baseUrl: "https://api.x.ai/v1",             envKey: "XAI_API_KEY" },
  deepseek:  { baseUrl: "https://api.deepseek.com",        envKey: "DEEPSEEK_API_KEY" },
  mistral:   { baseUrl: "https://api.mistral.ai/v1",       envKey: "MISTRAL_API_KEY" },
  groq:      { baseUrl: "https://api.groq.com/openai/v1",  envKey: "GROQ_API_KEY" },
  together:  { baseUrl: "https://api.together.xyz/v1",     envKey: "TOGETHER_API_KEY" },
  perplexity:{ baseUrl: "https://api.perplexity.ai",       envKey: "PERPLEXITY_API_KEY" },
};

export async function POST(req: NextRequest) {
  try {
    const { provider, model } = await req.json();

    let result: TestResult;

    if (provider === "ollama" || provider === "lmstudio") {
      result = await testOllama(model);
    } else if (provider === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return NextResponse.json({ provider, model, requested: `${provider}/${model}`, success: false, error: "No API key" });
      result = await testAnthropic(model, key);
    } else if (provider === "google") {
      const key = process.env.GOOGLE_API_KEY;
      if (!key) return NextResponse.json({ provider, model, requested: `${provider}/${model}`, success: false, error: "No API key" });
      result = await testGoogle(model, key);
    } else {
      // All other providers use OpenAI-compatible API
      const config = PROVIDER_CONFIG[provider];
      const envKey = config?.envKey || `${provider.toUpperCase()}_API_KEY`;
      const baseUrl = config?.baseUrl || `https://api.${provider}.com/v1`;
      const key = process.env[envKey];
      if (!key) return NextResponse.json({ provider, model, requested: `${provider}/${model}`, success: false, error: `No ${envKey} configured` });
      result = await testOpenAICompatible(model, key, baseUrl);
    }

    return NextResponse.json({ provider, model, requested: `${provider}/${model}`, ...result });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
