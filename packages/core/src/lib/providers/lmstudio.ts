import OpenAI from "openai";
import type { Message, ChatOptions, ChatResponse } from "../types";

// LM Studio uses an OpenAI-compatible API on local port
const LM_STUDIO_BASE_URL = process.env.NEXT_PUBLIC_LM_STUDIO_URL || "http://127.0.0.1:1240/v1";
// Check LMStudio_API_KEY first (actual key), then LM_STUDIO_API_KEY, no default fallback
const LM_STUDIO_DEFAULT_KEY = process.env.LMStudio_API_KEY || process.env.LM_STUDIO_API_KEY || "";

export function createClient(apiKey?: string) {
  return new OpenAI({
    apiKey: apiKey || LM_STUDIO_DEFAULT_KEY,
    baseURL: LM_STUDIO_BASE_URL,
  });
}

export async function listModels(): Promise<string[]> {
  try {
    const client = createClient();
    const response = await client.models.list();
    return response.data.map((m) => m.id);
  } catch (error) {
    console.error("[LM Studio] Failed to fetch models:", error);
    return [];
  }
}

export async function chat(
  messages: (Message & { images?: string[] })[],
  model: string,
  apiKey?: string,
  options?: ChatOptions
): Promise<ChatResponse> {
  const client = createClient(apiKey);

  // LM Studio may or may not support vision depending on loaded model
  // Strip images and use text only for compatibility
  const formatted = messages.map((m) => {
    let content = m.content;

    if (m.images && m.images.length > 0) {
      const imageNote = `[Note: ${m.images.length} image(s) attached. Processing as text only.]`;
      content = content ? `${imageNote}\n\n${content}` : imageNote;
    }

    return {
      role: m.role as "user" | "assistant" | "system",
      content,
    };
  });

  const response = await client.chat.completions.create({
    model,
    messages: formatted,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.topP ?? 1,
  });

  const content = response.choices[0]?.message?.content ?? "";
  const tokens = response.usage?.total_tokens ?? 0;

  return { content, tokens };
}

// Streaming chat for real-time responses
export async function* streamChat(
  messages: Message[],
  model: string,
  apiKey?: string,
  options?: ChatOptions
): AsyncGenerator<{ content: string; done: boolean }> {
  const client = createClient(apiKey);

  const formatted = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const stream = await client.chat.completions.create({
    model,
    messages: formatted,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.topP ?? 1,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? "";
    const done = chunk.choices[0]?.finish_reason === "stop";
    if (content || done) {
      yield { content, done };
    }
  }
}
