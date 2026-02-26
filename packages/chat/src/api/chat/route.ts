import { NextRequest, NextResponse } from "next/server";
import { chatWithFallback } from "@sarge/core";
import type { Message, Provider } from "@sarge/core";

// Provider display names for user-friendly error messages
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "OpenAI (GPT)",
  google: "Google (Gemini)",
  xai: "xAI (Grok)",
  deepseek: "DeepSeek",
  ollama: "Ollama",
  lmstudio: "LM Studio",
};

// Environment variable names for each provider
const PROVIDER_ENV_VARS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  xai: "XAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  lmstudio: "LMStudio_API_KEY",
};

function getApiKey(provider: Provider): string {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? "";
    case "openai":
      return process.env.OPENAI_API_KEY ?? "";
    case "google":
      return process.env.GOOGLE_API_KEY ?? "";
    case "xai":
      return process.env.XAI_API_KEY ?? "";
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY ?? "";
    case "lmstudio":
      return process.env.LMStudio_API_KEY || process.env.LM_STUDIO_API_KEY || "";
    default:
      return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, provider, model, sessionId } = body as {
      messages: Message[];
      provider: Provider;
      model: string;
      sessionId?: string;
    };

    const apiKey = getApiKey(provider);
    if (!apiKey && provider !== "ollama") {
      const displayName = PROVIDER_DISPLAY_NAMES[provider] || provider;
      const envVar = PROVIDER_ENV_VARS[provider] || `${provider.toUpperCase()}_API_KEY`;
      return NextResponse.json(
        {
          error: `No API key configured for ${displayName}. Add ${envVar} in Settings or .env.local.`,
          code: "MISSING_API_KEY",
          provider,
        },
        { status: 401 }
      );
    }

    // Use fallback wrapper - automatically handles errors and retries
    const response = await chatWithFallback(messages, provider, model, apiKey, sessionId);

    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/chat] Error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
