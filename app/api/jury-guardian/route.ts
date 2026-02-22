import { NextRequest, NextResponse } from "next/server";
import type { JuryApiRequest, Tier1Result, Tier2Result, Tier3Result } from "@/lib/types/juryGuardian";

// Ollama endpoint
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://127.0.0.1:11434";

// Cloud provider API keys
function getApiKey(provider: string): string {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY || "";
    case "openai":
      return process.env.OPENAI_API_KEY || "";
    case "google":
      return process.env.GOOGLE_API_KEY || "";
    case "xai":
      return process.env.XAI_API_KEY || "";
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY || "";
    default:
      return "";
  }
}

/**
 * Call Ollama for local model inference
 */
async function callOllama(
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: false,
        format: "json", // Request JSON format
        options: {
          temperature: 0.1, // Low temperature for consistent output
          num_predict: 2048,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `Ollama error: ${res.status} - ${errorText}` };
    }

    const data = await res.json();
    return { success: true, content: data.message?.content || "" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ollama connection failed",
    };
  }
}

/**
 * Call Anthropic Claude
 */
async function callAnthropic(
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) {
    return { success: false, error: "Anthropic API key not configured" };
  }

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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return { success: false, error: `Anthropic error: ${errorData.error?.message || res.status}` };
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "";
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Anthropic request failed",
    };
  }
}

/**
 * Call OpenAI
 */
async function callOpenAI(
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const apiKey = getApiKey("openai");
  if (!apiKey) {
    return { success: false, error: "OpenAI API key not configured" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 2048,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return { success: false, error: `OpenAI error: ${errorData.error?.message || res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "OpenAI request failed",
    };
  }
}

/**
 * Call xAI Grok
 */
async function callXAI(
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const apiKey = getApiKey("xai");
  if (!apiKey) {
    return { success: false, error: "xAI API key not configured" };
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return { success: false, error: `xAI error: ${errorData.error?.message || res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "xAI request failed",
    };
  }
}

/**
 * Call DeepSeek
 */
async function callDeepSeek(
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const apiKey = getApiKey("deepseek");
  if (!apiKey) {
    return { success: false, error: "DeepSeek API key not configured" };
  }

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return { success: false, error: `DeepSeek error: ${errorData.error?.message || res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "DeepSeek request failed",
    };
  }
}

/**
 * Parse JSON response, handling markdown code blocks
 */
function parseJsonResponse(content: string): Tier1Result | Tier2Result | Tier3Result | null {
  try {
    // Try direct parse first
    return JSON.parse(content);
  } catch {
    // Try extracting from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    // Try finding JSON object in content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through
      }
    }

    return null;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = (await req.json()) as JuryApiRequest;
    const { tier, model, provider, messages, systemPrompt } = body;

    // Validate input
    if (!tier || !model || !provider || !messages || !systemPrompt) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const userContent = messages.map((m) => m.content).join("\n");

    // Route to appropriate provider
    let result: { success: boolean; content?: string; error?: string };

    switch (provider) {
      case "ollama":
        result = await callOllama(model, systemPrompt, userContent);
        break;
      case "anthropic":
        result = await callAnthropic(model, systemPrompt, userContent);
        break;
      case "openai":
        result = await callOpenAI(model, systemPrompt, userContent);
        break;
      case "xai":
        result = await callXAI(model, systemPrompt, userContent);
        break;
      case "deepseek":
        result = await callDeepSeek(model, systemPrompt, userContent);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    const duration = Date.now() - startTime;

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, duration },
        { status: 500 }
      );
    }

    // Parse JSON response
    const parsed = parseJsonResponse(result.content || "");

    if (!parsed) {
      console.error("[Jury API] Failed to parse JSON response:", result.content?.slice(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse model response as JSON",
          rawContent: result.content?.slice(0, 1000),
          duration,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: parsed,
      duration,
    });
  } catch (error) {
    console.error("[Jury API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
