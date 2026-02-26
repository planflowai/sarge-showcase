"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@sarge/core";
import { useKnowledgeStore } from "./knowledgeStore";
import { useConversationStore } from "./conversationStore";
import { useThreadGuardianStore } from "./threadGuardianStore";
import { useJuryGuardianStore } from "./juryGuardianStore";
import { sanitizeForCloud, summarizeThread } from "../lib/utils/summarize";
import { countTokens } from "@sarge/core";
import { buildContextForModel, shouldInjectContext } from "@sarge/core";
import { runInterventionCheck } from "@sarge/core";
import type { Provider } from "@sarge/core";

const STORAGE_PREFIX = "messages_";
const ARTIFACT_SYSTEM_PROMPT = `You are a helpful assistant. When generating code, structure it as a complete, self-contained artifact. HTML must include CSS and JavaScript in <style> and <script> tags. React components should be complete and ready to render.`;

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider: Provider;
  model: string;
  timestamp: Date;
  tokenCount?: number;
  latencyMs?: number;
  vaultAttachments?: { id: string; name: string; truncated: boolean }[];
  imageUrl?: string;
  isError?: boolean;
  errorCode?: "MISSING_API_KEY" | "PROVIDER_ERROR";
  isKilled?: boolean;
  killedReason?: string;
  fallback?: {
    originalProvider: Provider;
    originalModel: string;
    fallbackProvider: Provider;
    fallbackModel: string;
    attempts: number;
  };
}

// Helper function to add model attribution to messages
function addModelAttribution(messages: Message[], modelName: string, provider: Provider): Message[] {
  return messages.map((msg) => {
    if (msg.role === "assistant" && msg.provider !== provider) {
      const providerName = msg.provider ? `${msg.provider}` : '';
      const attribution = providerName
        ? `[Response from ${modelName} (${providerName})]:\n`
        : `[Response from ${modelName}]:\n`;

      return {
        ...msg,
        content: attribution + msg.content,
      };
    }
    return msg;
  });
}

function loadFromStorage(conversationId: string): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + conversationId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((m: Record<string, unknown>) => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp as string) : new Date(),
    }));
  } catch {
    return [];
  }
}

// Debounce storage writes to prevent jank from JSON.stringify on large message arrays
const storageTimeouts = new Map<string, NodeJS.Timeout>();

function saveToStorage(conversationId: string, messages: Message[]) {
  // Cancel previous timeout for this conversation
  if (storageTimeouts.has(conversationId)) {
    clearTimeout(storageTimeouts.get(conversationId)!);
  }

  // Defer write by 800ms to batch multiple additions
  const timeout = setTimeout(() => {
    try {
      localStorage.setItem(
        STORAGE_PREFIX + conversationId,
        JSON.stringify(messages)
      );
      storageTimeouts.delete(conversationId);
    } catch {
      // ignore
    }
  }, 800);

  storageTimeouts.set(conversationId, timeout);
}

interface SendOptions {
  summarizeForCloud?: boolean;
  sanitizeForCloud?: boolean;
  vaultAttachments?: { id: string; name: string; truncated: boolean }[];
  systemPrompt?: string; // Custom system prompt (e.g., architect mode)
}

interface MessageState {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  loadMessages: (conversationId: string) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  sendMessage: (
    conversationId: string,
    prompt: string,
    provider: Provider,
    model: string,
    options?: SendOptions
  ) => Promise<void>;
  generateImage: (
    conversationId: string,
    prompt: string,
    provider: Provider,
    model: string
  ) => Promise<void>;
  clearMessages: () => void;
}

interface CallProviderResponse {
  content: string;
  tokens?: number;
  _fallback?: {
    fallbackProvider: Provider;
    fallbackModel: string;
    attempts: number;
  };
}

async function callProvider(
  messages: Message[],
  provider: Provider,
  model: string
): Promise<CallProviderResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, provider, model }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

export const useMessageStore = create<MessageState>()(persist(
  (set, get) => ({
  messages: [],
  loading: false,
  sending: false,

  loadMessages: async (conversationId: string) => {
    set({ loading: true, messages: [] });
    const messages = loadFromStorage(conversationId);
    set({ messages, loading: false });
  },

  addMessage: async (message: Message) => {
    const updated = [...get().messages, message];
    set({ messages: updated });
    saveToStorage(message.conversationId, updated);
  },

  sendMessage: async (
    conversationId: string,
    prompt: string,
    provider: Provider,
    model: string,
    options?: SendOptions
  ) => {
    const { addMessage } = get();
    const { summarizeForCloud, sanitizeForCloud: doSanitize, vaultAttachments, systemPrompt } = options ?? {};

    // Add user message with vault attachment info if present
    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversationId,
      role: "user",
      content: prompt,
      provider,
      model,
      timestamp: new Date(),
      vaultAttachments: vaultAttachments,
    };
    await addMessage(userMessage);

    // Auto-generate conversation title from first user message
    const allMessages = get().messages;
    const userMessages = allMessages.filter((m) => m.role === "user");
    if (userMessages.length === 1) {
      // This is the first user message - auto-generate title
      const title = prompt
        .substring(0, 50)
        .trim()
        .replace(/[#*`_~]/g, "") // Remove markdown
        .replace(/\s+/g, " "); // Normalize whitespace

      const finalTitle = title.length < prompt.length ? title + "..." : title;
      useConversationStore.getState().updateConversationTitle(conversationId, finalTitle);
    }

    // Call server-side API route for assistant response
    set({ sending: true });
    const startTime = Date.now();

    try {
      const allMessages = get().messages;
      const isCloud = provider !== "ollama";

      let messagesToSend: Message[];

      if (!isCloud) {
        // === LOCAL OLLAMA: full thread + knowledge vault ===
        // Add model attribution so the receiving model knows which responses came from other models
        messagesToSend = addModelAttribution([...allMessages], model, provider);

        // Inject active knowledge documents as system context
        const activeDocs = useKnowledgeStore.getState().getActiveDocuments();
        if (activeDocs.length > 0) {
          const knowledgeContent = activeDocs
            .map((doc) => `=== ${doc.name} ===\n${doc.content}`)
            .join("\n\n");

          const knowledgeMsg: Message = {
            id: `knowledge-context-${crypto.randomUUID()}`,
            conversationId,
            role: "system",
            content:
              "You have access to the following knowledge documents. Use them to answer questions when relevant.\n\n" +
              knowledgeContent,
            provider: "ollama",
            model,
            timestamp: new Date(),
          };
          messagesToSend = [knowledgeMsg, ...messagesToSend];
        }
      } else if (isCloud && doSanitize) {
        // === CLOUD + SANITIZE: rewrite query via local Ollama ===
        const activeDocs = useKnowledgeStore.getState().getActiveDocuments();
        const priorMessages = allMessages.slice(0, -1);
        const sanitizedQuery = await sanitizeForCloud(
          prompt,
          priorMessages,
          activeDocs
        );

        const sanitizedMsg: Message = {
          ...userMessage,
          id: crypto.randomUUID(),
          content: sanitizedQuery,
        };

        if (summarizeForCloud && priorMessages.length > 0) {
          // Sanitize + summarize: summary of thread + sanitized query
          const summaryContent = await summarizeThread(priorMessages);
          if (summaryContent) {
            const summaryMsg: Message = {
              id: `summary-${crypto.randomUUID()}`,
              conversationId,
              role: "user",
              content: `[Thread summary]: ${summaryContent}`,
              provider,
              model,
              timestamp: new Date(),
            };
            messagesToSend = [summaryMsg, sanitizedMsg];
          } else {
            messagesToSend = [sanitizedMsg];
          }
        } else {
          messagesToSend = [sanitizedMsg];
        }
      } else if (isCloud && summarizeForCloud) {
        // === CLOUD + SUMMARIZE (no sanitize): summary + current message ===
        const priorMessages = allMessages.slice(0, -1);
        let summaryContent = "";
        if (priorMessages.length > 0) {
          summaryContent = await summarizeThread(priorMessages);
        }
        if (summaryContent) {
          const summaryMsg: Message = {
            id: `summary-${crypto.randomUUID()}`,
            conversationId,
            role: "user",
            content: `[Thread summary]: ${summaryContent}`,
            provider,
            model,
            timestamp: new Date(),
          };
          messagesToSend = [summaryMsg, userMessage];
        } else {
          messagesToSend = [userMessage];
        }
      } else {
        // === CLOUD DEFAULT: current thread messages only ===
        // Add model attribution so the receiving model knows which responses came from other models
        messagesToSend = addModelAttribution(allMessages, model, provider);
      }

      // Inject system prompts
      // Custom system prompt (e.g., architect mode) takes precedence
      if (systemPrompt) {
        const customSystemMsg: Message = {
          id: `custom-system-${crypto.randomUUID()}`,
          conversationId,
          role: "system",
          content: systemPrompt,
          provider,
          model,
          timestamp: new Date(),
        };
        messagesToSend = [customSystemMsg, ...messagesToSend];
      } else if (isCloud) {
        // Default artifact system prompt for cloud providers
        const artifactMsg: Message = {
          id: `artifact-system-${crypto.randomUUID()}`,
          conversationId,
          role: "system",
          content: ARTIFACT_SYSTEM_PROMPT,
          provider,
          model,
          timestamp: new Date(),
        };
        messagesToSend = [artifactMsg, ...messagesToSend];
      }

      // Thread Guardian context injection
      // Prepends context summary to first user message so model understands thread history
      if (shouldInjectContext(conversationId)) {
        const guardianContext = buildContextForModel(conversationId);
        if (guardianContext) {
          // Find first user message and prepend context
          const firstUserIndex = messagesToSend.findIndex(m => m.role === 'user');
          if (firstUserIndex !== -1) {
            messagesToSend[firstUserIndex] = {
              ...messagesToSend[firstUserIndex],
              content: guardianContext + messagesToSend[firstUserIndex].content,
            };
            console.log('[MessageStore] Thread Guardian context injected');
          }
        }
      }

      const response = await callProvider(messagesToSend, provider, model);
      const latencyMs = Date.now() - startTime;

      // Check if fallback was used
      const fallbackInfo = response._fallback ? {
        originalProvider: provider,
        originalModel: model,
        fallbackProvider: response._fallback.fallbackProvider,
        fallbackModel: response._fallback.fallbackModel,
        attempts: response._fallback.attempts,
      } : undefined;

      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        conversationId,
        role: "assistant",
        content: response.content,
        provider: fallbackInfo?.fallbackProvider || provider,
        model: fallbackInfo?.fallbackModel || model,
        timestamp: new Date(),
        tokenCount: response.tokens,
        latencyMs,
        fallback: fallbackInfo,
      };

      // Jury Guardian intervention gate - check if response should be killed before entering conversation
      const juryStore = useJuryGuardianStore.getState();
      if (juryStore.enabled && juryStore.behavior.interventionEnabled) {
        const check = runInterventionCheck(conversationId, assistantMessage.content, assistantMessage.model || model);
        if (check.blocked) {
          // Log the kill in the jury ledger (only if type is echo or contradiction)
          if (check.type === "echo" || check.type === "contradiction") {
            juryStore.logKill(conversationId, {
              content: assistantMessage.content,
              reason: check.reason,
              model: assistantMessage.model || model,
              type: check.type,
            });
          }

          // Add a "killed" message instead of the original response
          const killedMessage: Message = {
            ...assistantMessage,
            content: `🛑 Response Killed\n\n**Reason:** ${check.reason}`,
            isKilled: true,
            killedReason: check.reason,
          };
          await addMessage(killedMessage);

          // Add toast notification
          juryStore.addToast({
            type: "killed",
            title: "🛑 Response Killed",
            message: check.reason,
            sessionId: conversationId,
          });

          return; // DO NOT add original message
        }
      }

      await addMessage(assistantMessage);

      // Track model attribution for Thread Guardian
      try {
        const guardianStore = useThreadGuardianStore.getState();
        if (guardianStore.enabled && guardianStore.ledgers[conversationId]) {
          const effectiveModel = fallbackInfo?.fallbackModel || model;
          const effectiveProvider = fallbackInfo?.fallbackProvider || provider;
          guardianStore.addAttribution(conversationId, {
            messageId: assistantMessageId,
            messageIndex: allMessages.length + 1, // +1 for the assistant message we just added
            model: effectiveModel,
            provider: effectiveProvider,
            tokenCount: response.tokens || countTokens(response.content),
            role: 'assistant',
          });
        }
      } catch (err) {
        // Don't let guardian errors break chat
        console.warn('[MessageStore] Failed to track guardian attribution:', err);
      }
    } catch (err) {
      console.error("[sendMessage] Provider call failed:", err);
      const errorContent = err instanceof Error ? err.message : "Failed to get response";
      // Check if this is a missing API key error
      const isMissingKey = errorContent.includes("No API key configured") ||
                          errorContent.includes("MISSING_API_KEY");
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        conversationId,
        role: "assistant",
        content: errorContent,
        provider,
        model,
        timestamp: new Date(),
        isError: true,
        errorCode: isMissingKey ? "MISSING_API_KEY" : "PROVIDER_ERROR",
      };
      await addMessage(errorMessage);
    } finally {
      set({ sending: false });
    }
  },

  generateImage: async (
    conversationId: string,
    prompt: string,
    provider: Provider,
    model: string
  ) => {
    const { addMessage } = get();

    // Add user message showing the image request
    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversationId,
      role: "user",
      content: `🎨 Generate image: ${prompt}`,
      provider,
      model,
      timestamp: new Date(),
    };
    await addMessage(userMessage);

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

      const imageMessage: Message = {
        id: crypto.randomUUID(),
        conversationId,
        role: "assistant",
        content: prompt,
        provider,
        model,
        timestamp: new Date(),
        latencyMs,
        imageUrl: data.imageUrl,
      };
      await addMessage(imageMessage);
    } catch (err) {
      console.error("[generateImage] Error:", err);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        conversationId,
        role: "assistant",
        content: `Image generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        provider,
        model,
        timestamp: new Date(),
      };
      await addMessage(errorMessage);
    } finally {
      set({ sending: false });
    }
  },

  clearMessages: () => {
    set({ messages: [] });
  }
  }),
    {
      name: "message",
      storage: createDebouncedStorage(),
    }
  )
);
