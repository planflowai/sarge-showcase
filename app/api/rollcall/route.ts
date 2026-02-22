import { NextRequest, NextResponse } from "next/server";
import type { Provider } from "@/lib/types";

/**
 * Roll Call API - Tests each model directly WITHOUT fallback
 * Returns the model's self-identification to verify routing
 */

const ROLLCALL_PROMPT = "Respond with ONLY your model name/identifier. Nothing else. Just your name.";

async function testOllama(model: string): Promise<{ success: boolean; response?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: ROLLCALL_PROMPT,
        stream: false,
      }),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `${res.status}: ${text.substring(0, 100)}`, latencyMs };
    }

    const data = await res.json();
    return { success: true, response: data.response?.trim(), latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

async function testAnthropic(model: string, apiKey: string): Promise<{ success: boolean; response?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        messages: [{ role: "user", content: ROLLCALL_PROMPT }],
      }),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `${res.status}: ${text.substring(0, 200)}`, latencyMs };
    }

    const data = await res.json();
    const content = data.content?.[0]?.text?.trim() || "No response";
    return { success: true, response: content, latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

async function testOpenAI(model: string, apiKey: string): Promise<{ success: boolean; response?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        messages: [{ role: "user", content: ROLLCALL_PROMPT }],
      }),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `${res.status}: ${text.substring(0, 200)}`, latencyMs };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "No response";
    return { success: true, response: content, latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

async function testGoogle(model: string, apiKey: string): Promise<{ success: boolean; response?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ROLLCALL_PROMPT }] }],
      }),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `${res.status}: ${text.substring(0, 200)}`, latencyMs };
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response";
    return { success: true, response: content, latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

async function testXAI(model: string, apiKey: string): Promise<{ success: boolean; response?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        messages: [{ role: "user", content: ROLLCALL_PROMPT }],
      }),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `${res.status}: ${text.substring(0, 200)}`, latencyMs };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "No response";
    return { success: true, response: content, latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", latencyMs: Date.now() - start };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, model } = body as { provider: Provider; model: string };

    const apiKeys = {
      anthropic: process.env.ANTHROPIC_API_KEY ?? "",
      openai: process.env.OPENAI_API_KEY ?? "",
      google: process.env.GOOGLE_API_KEY ?? "",
      xai: process.env.XAI_API_KEY ?? "",
    };

    let result;

    switch (provider) {
      case "ollama":
        result = await testOllama(model);
        break;
      case "anthropic":
        if (!apiKeys.anthropic) {
          return NextResponse.json({ success: false, error: "No Anthropic API key configured" });
        }
        result = await testAnthropic(model, apiKeys.anthropic);
        break;
      case "openai":
        if (!apiKeys.openai) {
          return NextResponse.json({ success: false, error: "No OpenAI API key configured" });
        }
        result = await testOpenAI(model, apiKeys.openai);
        break;
      case "google":
        if (!apiKeys.google) {
          return NextResponse.json({ success: false, error: "No Google API key configured" });
        }
        result = await testGoogle(model, apiKeys.google);
        break;
      case "xai":
        if (!apiKeys.xai) {
          return NextResponse.json({ success: false, error: "No xAI API key configured" });
        }
        result = await testXAI(model, apiKeys.xai);
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown provider: ${provider}` });
    }

    return NextResponse.json({
      provider,
      model,
      requested: `${provider}/${model}`,
      ...result,
    });
  } catch (err) {
    console.error("[rollcall] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
