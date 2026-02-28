"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useThreadGuardianStore } from "@sarge/core";
import { countTokens } from "@sarge/core";
import { createDebouncedStorage } from "@sarge/core";

// Fixed conversation ID for builder chat (isolated from main chat)
const BUILDER_CONVERSATION_ID = 'builder-chat';

// Builder system prompt - structured output format for edit card display
const BUILDER_SYSTEM_PROMPT = `You are a UI builder assistant. Help build and refine web UI code.

RESPONSE FORMAT - ALWAYS follow this structure:

1. EXPLANATION (1-3 sentences max): Brief description of what you're doing
2. CODE: One code block with the complete file

IF EDITING PROJECT FILES (you will see file paths in context):
Use FILE: format for each file change:

FILE: src/components/Header.tsx
\`\`\`html
<complete updated file content>
\`\`\`

Example response:
"I'll add a dark mode toggle to the header.

FILE: src/components/Header.tsx
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <style>
    header { background: white; }
    .dark header { background: black; }
  </style>
</head>
<body>
  <header>
    <button id="darkToggle">🌙</button>
  </header>
</body>
</html>
\`\`\`"

RULES:
- Keep explanations SHORT (1-3 sentences)
- Put ALL code in ONE code block with proper language tag (\`\`\`html, \`\`\`css, \`\`\`tsx)
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
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

      const latencyMs = Date.now() - startTime;
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

      // Update the message with error
      const errorContent = `Error: ${err instanceof Error ? err.message : "Failed to get response"}`;
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
        messages: state.messages.slice(-50),
        // Don't persist: sending, streaming, currentStreamId, abortController, hydrated, prefilledInput
      }),
    }
  )
);
