"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useThreadGuardianStore } from "@sarge/core";
import { countTokens } from "@sarge/core";
import { createDebouncedStorage } from "@sarge/core";

// Fixed conversation ID for builder chat (isolated from main chat)
const BUILDER_CONVERSATION_ID = 'builder-chat';

/** Convert raw API errors into user-friendly messages */
function friendlyError(raw: string, provider: string, model: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes('cannot connect') || lower.includes('econnrefused') || lower.includes('fetch failed')) {
    if (provider === 'ollama') return `Could not connect to Ollama. Make sure it's running (\`ollama serve\`) and try again.`;
    if (provider === 'lmstudio') return `Could not connect to LM Studio. Make sure it's running and a model is loaded.`;
    return `Could not reach the ${provider} API. Check your internet connection and try again.`;
  }
  if (lower.includes('api key') || lower.includes('401') || lower.includes('unauthorized') || lower.includes('authentication')) {
    return `API key issue for ${provider}. Go to **Settings** to check your ${provider} API key.`;
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return `Rate limited by ${provider}. Wait a moment and try again, or switch to a different model.`;
  }
  if (lower.includes('model not found') || lower.includes('does not exist') || lower.includes('404')) {
    return `Model "${model}" not found. It may have been removed or renamed. Try a different model.`;
  }
  if (lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient') || lower.includes('402')) {
    return `Your ${provider} account has hit its usage limit. Check your billing at ${provider}'s dashboard.`;
  }
  if (lower.includes('context length') || lower.includes('too long') || lower.includes('maximum')) {
    return `The message was too long for this model's context window. Try a shorter prompt or switch to a model with a larger context.`;
  }
  if (lower.includes('500') || lower.includes('internal server error') || lower.includes('502') || lower.includes('503')) {
    return `${provider} is having server issues. Try again in a minute, or switch to a different provider.`;
  }
  if (lower.includes('no response body')) {
    return `Got an empty response from ${provider}. The model may be overloaded — try again.`;
  }
  return `Something went wrong with ${provider}: ${raw.slice(0, 200)}`;
}

// Builder system prompt - structured output format for edit card display
const BUILDER_SYSTEM_PROMPT = `You are a website builder. RULES:
1) Always create index.html FIRST before any other files.
2) Write complete, working HTML — never partial.
3) Include all CSS inline or in a style tag unless the user asks for separate files.
4) Every response that builds or edits must output the FULL file inside a code fence with the filename.
5) Do not explain unless asked — just build.
6) Keep the user's existing content — never remove sections unless told to.
7) If you need multiple files, create them in order: index.html, then CSS, then JS.

RESPONSE FORMAT:
1. Brief explanation (1-3 sentences max) of what you're building or changing
2. Code in a single code block with proper language tag (\`\`\`html, \`\`\`css, \`\`\`tsx)

IF EDITING PROJECT FILES (you will see file paths in context):
Use FILE: format for each file change:

FILE: index.html
\`\`\`html
<complete file content>
\`\`\`

ADDITIONAL RULES:
- HTML must be self-contained: inline CSS in <style>, inline JS in <script>
- NEVER reference external files like ./main.js or ./style.css
- When modifying code: change ONLY what was asked, preserve everything else
- Do NOT dump extra commentary after the code block`;

export interface BuilderMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider: string;
  model: string;
  timestamp: Date;
  tokenCount?: number;
  latencyMs?: number;
  isStreaming?: boolean;
  imageUrl?: string;  // For image generation responses
  images?: string[];  // Base64 data URLs for vision (user attachments)
  thinking?: string;  // Reasoning/thinking tokens (DeepSeek R1, etc.)
}

const STORAGE_KEY = "builder-chat-store";

interface BuilderChatState {
  messages: BuilderMessage[];
  sending: boolean;
  hydrated: boolean;
  currentStreamId: string | null;
  abortController: AbortController | null;
  prefilledInput: string | null;

  hydrate: () => void;
  setPrefilledInput: (text: string | null) => void;
  addMessage: (message: BuilderMessage) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  finalizeStreamingMessage: (id: string, tokenCount?: number, latencyMs?: number) => void;
  clearMessages: () => void;
  sendMessage: (
    displayMessage: string,
    apiPrompt: string,
    provider: string,
    model: string,
    systemPrompt?: string,
    images?: string[],
    webSearch?: boolean
  ) => Promise<void>;
  generateImage: (
    prompt: string,
    provider: string,
    model: string
  ) => Promise<string | null>;  // Returns image URL or null on error
  abortStream: () => void;
}

export const useBuilderChatStore = create<BuilderChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      sending: false,
      hydrated: false,
      currentStreamId: null,
      abortController: null,
      prefilledInput: null,

      hydrate: () => {
        set({ hydrated: true });
      },

  setPrefilledInput: (text) => {
    set({ prefilledInput: text });
  },

  addMessage: (message) => {
    const updated = [...get().messages, message];
    set({ messages: updated });
  },

  updateStreamingMessage: (id, content) => {
    const messages = get().messages.map(m =>
      m.id === id ? { ...m, content } : m
    );
    set({ messages });
  },

  finalizeStreamingMessage: (id, tokenCount, latencyMs) => {
    const messages = get().messages.map(m =>
      m.id === id ? { ...m, isStreaming: false, tokenCount, latencyMs } : m
    );
    set({ messages, sending: false, currentStreamId: null, abortController: null });
  },

  clearMessages: () => {
    console.log('[BuilderChatStore] Clearing messages');
    set({ messages: [] });
  },

  abortStream: () => {
    const { abortController, currentStreamId, messages } = get();
    if (abortController) {
      abortController.abort();
    }
    // Remove the streaming message if it exists
    if (currentStreamId) {
      const updated = messages.filter(m => m.id !== currentStreamId);
      set({ messages: updated, sending: false, currentStreamId: null, abortController: null });
    }
  },

  sendMessage: async (displayMessage, apiPrompt, provider, model, systemPrompt, images, webSearch = false) => {
    // Use provided system prompt or fall back to default
    const effectiveSystemPrompt = systemPrompt || BUILDER_SYSTEM_PROMPT;
    const { addMessage, updateStreamingMessage, finalizeStreamingMessage } = get();

    // Add user message - show only what user typed, not the injected context
    const userMessage: BuilderMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: displayMessage,
      provider,
      model,
      timestamp: new Date(),
      images: images && images.length > 0 ? images : undefined,
    };
    addMessage(userMessage);

    // Create streaming assistant message placeholder
    const assistantId = crypto.randomUUID();
    const assistantMessage: BuilderMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      provider,
      model,
      timestamp: new Date(),
      isStreaming: true,
    };
    addMessage(assistantMessage);

    const abortController = new AbortController();
    set({ sending: true, currentStreamId: assistantId, abortController });

    const startTime = Date.now();
    let totalContent = "";
    let totalThinking = "";
    let tokenCount = 0;

    try {
      // Determine if local or cloud
      const isLocal = provider === "ollama" || provider === "lmstudio";
      const source = isLocal ? "local" : "cloud";

      // Call the streaming API - use apiPrompt which includes context injection
      const response = await fetch("/api/test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          provider,
          prompt: apiPrompt,
          systemPrompt: effectiveSystemPrompt,
          source,
          webSearch,
          images: images && images.length > 0 ? images : undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Streaming inactivity timeout: abort if no data received for 120 seconds
      const STREAM_INACTIVITY_TIMEOUT_MS = 120_000;
      let lastChunkTime = Date.now();
      const inactivityTimer = setInterval(() => {
        if (Date.now() - lastChunkTime > STREAM_INACTIVITY_TIMEOUT_MS) {
          console.warn('[BuilderChat] Streaming timeout — no data for 120s, aborting');
          clearInterval(inactivityTimer);
          abortController.abort();
        }
      }, 5_000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lastChunkTime = Date.now();

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              // Capture reasoning/thinking tokens (DeepSeek R1)
              if (data.message?.reasoning_content) {
                totalThinking += data.message.reasoning_content;
                const messages = get().messages.map(m =>
                  m.id === assistantId ? { ...m, thinking: totalThinking } : m
                );
                set({ messages });
              }
              if (data.message?.content) {
                totalContent += data.message.content;
                tokenCount++;
                updateStreamingMessage(assistantId, totalContent);
              }
              // Handle done signal from Ollama
              if (data.done && data.eval_count) {
                tokenCount = data.eval_count;
              }
            } catch {
              // Not valid JSON, might be partial
            }
          }
        }
      } finally {
        clearInterval(inactivityTimer);
      }

      const latencyMs = Date.now() - startTime;
      // Persist thinking content on finalize
      if (totalThinking) {
        const messages = get().messages.map(m =>
          m.id === assistantId ? { ...m, thinking: totalThinking } : m
        );
        set({ messages });
      }
      finalizeStreamingMessage(assistantId, tokenCount, latencyMs);

      // Track model attribution for Thread Guardian
      try {
        const guardianStore = useThreadGuardianStore.getState();
        if (guardianStore.enabled && guardianStore.ledgers[BUILDER_CONVERSATION_ID]) {
          guardianStore.addAttribution(BUILDER_CONVERSATION_ID, {
            messageId: assistantId,
            messageIndex: get().messages.length,
            model,
            provider,
            tokenCount: tokenCount || countTokens(totalContent),
            role: 'assistant',
          });
        }
      } catch (attrErr) {
        // Don't let guardian errors break builder chat
        console.warn('[BuilderChat] Failed to track guardian attribution:', attrErr);
      }

    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User cancelled, message already removed in abortStream
        return;
      }

      // Map raw errors to friendly messages
      const rawMsg = err instanceof Error ? err.message : "Failed to get response";
      const errorContent = friendlyError(rawMsg, provider, model);
      const latencyMs = Date.now() - startTime;

      const messages = get().messages.map(m =>
        m.id === assistantId ? { ...m, content: errorContent, isStreaming: false, latencyMs } : m
      );
      set({ messages, sending: false, currentStreamId: null, abortController: null });
    }
  },

  generateImage: async (prompt, provider, model) => {
    const { addMessage } = get();

    // Add user message showing the image request
    const userMessage: BuilderMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `🎨 Generate image: ${prompt}`,
      provider,
      model,
      timestamp: new Date(),
    };
    addMessage(userMessage);

    set({ sending: true });
    const startTime = Date.now();

    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, provider }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Image API error: ${res.status}`);
      }

      const latencyMs = Date.now() - startTime;

      const imageMessage: BuilderMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: prompt,
        provider,
        model,
        timestamp: new Date(),
        latencyMs,
        imageUrl: data.imageUrl,
      };
      addMessage(imageMessage);

      set({ sending: false });
      return data.imageUrl;
    } catch (err) {
      console.error("[generateImage] Error:", err);
      const errorMessage: BuilderMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Image generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        provider,
        model,
        timestamp: new Date(),
      };
      addMessage(errorMessage);
      set({ sending: false });
      return null;
    }
  },
    }),
    {
      name: STORAGE_KEY,
      storage: createDebouncedStorage({ debounceMs: 1000 }),
      partialize: (state) => ({
        // Only persist message data, keep last 50 messages
        // Clear isStreaming on persist — streaming is transient and must not survive reload
        messages: state.messages.slice(-50).map(m => m.isStreaming ? { ...m, isStreaming: false } : m),
        // Don't persist: sending, streaming, currentStreamId, abortController, hydrated, prefilledInput
      }),
    }
  )
);
