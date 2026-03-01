import { NextRequest, NextResponse } from "next/server";

type Provider = "anthropic" | "openai" | "google" | "xai" | "deepseek" | "ollama" | "lmstudio";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://127.0.0.1:11434";

function getApiKey(provider: Provider): string {
  switch (provider) {
    case "anthropic": return process.env.ANTHROPIC_API_KEY ?? "";
    case "openai": return process.env.OPENAI_API_KEY ?? "";
    case "google": return process.env.GOOGLE_API_KEY ?? "";
    case "xai": return process.env.XAI_API_KEY ?? "";
    case "deepseek": return process.env.DEEPSEEK_API_KEY ?? "";
    case "lmstudio": return process.env.LMStudio_API_KEY || process.env.LM_STUDIO_API_KEY || "";
    default: return "";
  }
}

async function chatOllama(messages: Message[], model: string): Promise<{ content: string; tokens: number }> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return {
    content: data.message?.content || "",
    tokens: (data.eval_count || 0) + (data.prompt_eval_count || 0),
  };
}

async function chatAnthropic(messages: Message[], model: string, apiKey: string): Promise<{ content: string; tokens: number }> {
  const systemMsg = messages.find(m => m.role === "system");
  const chatMessages = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemMsg?.content || "",
      messages: chatMessages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.content?.[0]?.text || "",
    tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}

async function chatOpenAI(messages: Message[], model: string, apiKey: string, baseUrl = "https://api.openai.com/v1"): Promise<{ content: string; tokens: number }> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096 }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    tokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
  };
}

async function chatGoogle(messages: Message[], model: string, apiKey: string): Promise<{ content: string; tokens: number }> {
  const systemMsg = messages.find(m => m.role === "system");
  const chatMessages = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: chatMessages,
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        generationConfig: { maxOutputTokens: 8192 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Google error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    tokens: (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, provider, model } = body as {
      messages: Message[];
      provider: Provider;
      model: string;
    };

    const apiKey = getApiKey(provider);
    if (!apiKey && provider !== "ollama") {
      return NextResponse.json(
        { error: `No API key configured for ${provider}. Add the key in .env.local.` },
        { status: 401 }
      );
    }

    let result: { content: string; tokens: number };

    switch (provider) {
      case "ollama":
        result = await chatOllama(messages, model);
        break;
      case "anthropic":
        result = await chatAnthropic(messages, model, apiKey);
        break;
      case "openai":
        result = await chatOpenAI(messages, model, apiKey);
        break;
      case "google":
        result = await chatGoogle(messages, model, apiKey);
        break;
      case "xai":
        result = await chatOpenAI(messages, model, apiKey, "https://api.x.ai/v1");
        break;
      case "deepseek":
        result = await chatOpenAI(messages, model, apiKey, "https://api.deepseek.com/v1");
        break;
      case "lmstudio":
        result = await chatOpenAI(messages, model, apiKey, "http://127.0.0.1:1240/v1");
        break;
      default:
        return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[debate-standalone/api/chat]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
