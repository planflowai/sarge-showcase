/**
 * Standalone /api/chat route — works WITHOUT the beast (localhost:5000).
 * Calls providers directly: Ollama, LMStudio, Anthropic, OpenAI, Google, xAI, DeepSeek.
 * This route takes priority over the next.config.ts rewrite proxy.
 */
import { NextRequest, NextResponse } from "next/server";

type ChatMessage = { role: string; content: string };

function getEnvKey(provider: string): string {
  switch (provider) {
    case "anthropic": return process.env.ANTHROPIC_API_KEY || "";
    case "openai":    return process.env.OPENAI_API_KEY || "";
    case "google":    return process.env.GOOGLE_API_KEY || "";
    case "xai":       return process.env.XAI_API_KEY || "";
    case "deepseek":  return process.env.DEEPSEEK_API_KEY || "";
    case "lmstudio":  return process.env.LMStudio_API_KEY || process.env.LM_STUDIO_API_KEY || "lm-studio";
    default:          return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, provider, model } = body as {
      messages: ChatMessage[];
      provider: string;
      model: string;
    };

    if (!provider || !model) {
      return NextResponse.json({ error: "provider and model are required" }, { status: 400 });
    }

    switch (provider) {
      case "ollama":    return await callOllama(model, messages);
      case "lmstudio":  return await callLMStudio(model, messages);
      case "anthropic": return await callAnthropic(model, messages, getEnvKey("anthropic"));
      case "openai":    return await callOpenAI(model, messages, getEnvKey("openai"));
      case "google":    return await callGoogle(model, messages, getEnvKey("google"));
      case "xai":       return await callXAI(model, messages, getEnvKey("xai"));
      case "deepseek":  return await callDeepSeek(model, messages, getEnvKey("deepseek"));
      default: {
        // Custom provider fallback — OpenAI-compatible
        const KNOWN_BASE_URLS: Record<string, string> = {
          mistral: "https://api.mistral.ai/v1",
          huggingface: "https://api-inference.huggingface.co/v1",
          perplexity: "https://api.perplexity.ai",
          together: "https://api.together.xyz/v1",
          groq: "https://api.groq.com/openai/v1",
        };
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        const apiKey = process.env[envKey] || "";
        const baseUrl = KNOWN_BASE_URLS[provider] || "";
        if (apiKey && baseUrl) {
          return await callOpenAICompatible(model, messages, baseUrl, apiKey, provider);
        }
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
      }
    }
  } catch (err) {
    console.error("[standalone /api/chat] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Ollama ────────────────────────────────────────────────────────────────────

async function callOllama(model: string, messages: ChatMessage[]) {
  const baseUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `${res.status}`);
    throw new Error(`Ollama error: ${text}`);
  }
  const data = await res.json();
  return NextResponse.json({ content: data.message?.content || "" });
}

// ── LM Studio ─────────────────────────────────────────────────────────────────

async function callLMStudio(model: string, messages: ChatMessage[]) {
  const baseUrl = process.env.LMSTUDIO_URL || "http://localhost:1234";
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getEnvKey("lmstudio")}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `${res.status}`);
    throw new Error(`LM Studio error: ${text}`);
  }
  const data = await res.json();
  return NextResponse.json({ content: data.choices?.[0]?.message?.content || "" });
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async function callAnthropic(model: string, messages: ChatMessage[], apiKey: string) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Anthropic API key. Add ANTHROPIC_API_KEY to .env.local" },
      { status: 401 }
    );
  }
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      max_tokens: 8192,
      ...(systemMsg ? { system: systemMsg.content } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Anthropic error: ${res.status}`);
  return NextResponse.json({ content: data.content?.[0]?.text || "" });
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

async function callOpenAI(model: string, messages: ChatMessage[], apiKey: string) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "No OpenAI API key. Add OPENAI_API_KEY to .env.local" },
      { status: 401 }
    );
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI error: ${res.status}`);
  return NextResponse.json({ content: data.choices?.[0]?.message?.content || "" });
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

async function callGoogle(model: string, messages: ChatMessage[], apiKey: string) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Google API key. Add GOOGLE_API_KEY to .env.local" },
      { status: 401 }
    );
  }
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const contents = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Google error: ${res.status}`);
  return NextResponse.json({
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
  });
}

// ── xAI (Grok) ────────────────────────────────────────────────────────────────

async function callXAI(model: string, messages: ChatMessage[], apiKey: string) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "No xAI API key. Add XAI_API_KEY to .env.local" },
      { status: 401 }
    );
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `xAI error: ${res.status}`);
  return NextResponse.json({ content: data.choices?.[0]?.message?.content || "" });
}

// ── DeepSeek ──────────────────────────────────────────────────────────────────

async function callDeepSeek(model: string, messages: ChatMessage[], apiKey: string) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "No DeepSeek API key. Add DEEPSEEK_API_KEY to .env.local" },
      { status: 401 }
    );
  }
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `DeepSeek error: ${res.status}`);
  return NextResponse.json({ content: data.choices?.[0]?.message?.content || "" });
}

// ── Generic OpenAI-compatible (Mistral, Perplexity, Together, Groq, etc.) ────

async function callOpenAICompatible(model: string, messages: ChatMessage[], baseUrl: string, apiKey: string, provider: string) {
  if (!apiKey) {
    return NextResponse.json(
      { error: `No API key. Add ${provider.toUpperCase()}_API_KEY to .env.local` },
      { status: 401 }
    );
  }
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `${provider} error: ${res.status}`);
  return NextResponse.json({ content: data.choices?.[0]?.message?.content || "" });
}
