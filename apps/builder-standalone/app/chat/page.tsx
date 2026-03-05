"use client";

import { useEffect, useRef, useCallback } from "react";
import { ChatView } from "@sarge/chat/index.client";
import { ParallelChatView } from "@sarge/chat/index.client";
import { useConversationStore } from "@sarge/chat/index.client";
import { useParallelChatStore } from "@sarge/chat/index.client";
import { useMessageStore } from "@sarge/chat/index.client";
import { InputArea } from "@sarge/chat/index.client";
import type { Attachment } from "@sarge/chat/index.client";
import { useKnowledgeStore, useRoleStore, useProviderStore } from "@sarge/core";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useWarRoomStore } from "@/lib/stores/warRoomStore";
import { WarRoomDashboard } from "@/components/chat/WarRoomDashboard";

export default function ChatPage() {
  const {
    currentConversationId,
    loadConversations,
    createConversation,
    setCurrent,
  } = useConversationStore();

  const hydrateKnowledge = useKnowledgeStore((s) => s.hydrate);
  const hydrateRoles = useRoleStore((s) => s.hydrate);

  // Parallel chat mode
  const parallelEnabled = useParallelChatStore((s) => s.enabled);
  const parallelHydrated = useParallelChatStore((s) => s.hydrated);
  const hydrateParallel = useParallelChatStore((s) => s.hydrate);
  const toggleParallelMode = useParallelChatStore((s) => s.toggleParallelMode);
  const sendToAll = useParallelChatStore((s) => s.sendToAll);
  const parallelColumns = useParallelChatStore((s) => s.columns);

  // War Room mode
  const warRoomEnabled = useWarRoomStore((s) => s.enabled);
  const setWarRoomEnabled = useWarRoomStore((s) => s.setEnabled);

  // Message + provider stores for page-level send
  const { messages, sending, sendMessage, generateImage } = useMessageStore();
  const { currentProvider, currentModel, summarizeForCloud, sanitizeForCloud } = useProviderStore();

  // Auto-load conversations on mount
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    hydrateKnowledge();
    hydrateRoles();
    hydrateParallel();
    const existing = useConversationStore.getState();
    if (existing.currentConversationId && existing.conversations.length > 0) return;
    (async () => {
      await loadConversations();
      const state = useConversationStore.getState();
      if (state.conversations.length === 0) {
        await createConversation("New Conversation");
      } else if (!state.currentConversationId) {
        setCurrent(state.conversations[0].id);
      }
    })();
  }, [loadConversations, createConversation, setCurrent, hydrateKnowledge, hydrateRoles, hydrateParallel]);

  // Page-level send handler — routes to single or parallel
  const handleSend = useCallback(async (content: string, attachments?: Attachment[], vaultIds?: string[]) => {
    if (parallelEnabled) {
      let c = content;
      if (attachments?.length) {
        const fileParts = attachments
          .filter((a) => !a.isImage)
          .map((a) => `[File: ${a.name}]\n\`\`\`\n${a.content}\n\`\`\``);
        if (fileParts.length) c = c ? `${c}\n\n${fileParts.join("\n\n")}` : fileParts.join("\n\n");
      }
      if (!c && attachments?.some((a) => a.isImage)) c = "Please analyze this image.";
      sendToAll(c);
    } else {
      if (!currentConversationId) return;
      let finalContent = content;
      if (vaultIds?.length) {
        const vaultDocs = useKnowledgeStore.getState().documents;
        const vaultBlocks = vaultDocs
          .filter((d) => vaultIds.includes(d.id))
          .map((d) => `--- Knowledge Vault: ${d.name} ---\n${d.content}\n--- End of ${d.name} ---`);
        if (vaultBlocks.length > 0) finalContent = vaultBlocks.join("\n\n") + "\n\n" + finalContent;
      }
      if (attachments?.length) {
        const parts = attachments.map((a) =>
          a.isImage
            ? `[Attached image: ${a.name}]`
            : `--- File: ${a.name} ---\n${a.content}\n--- End of ${a.name} ---`
        );
        finalContent = parts.join("\n\n") + (content ? "\n\n" + content : "");
      }
      await sendMessage(currentConversationId, finalContent, currentProvider, currentModel, {
        summarizeForCloud,
        sanitizeForCloud,
      });
    }
  }, [parallelEnabled, sendToAll, currentConversationId, currentProvider, currentModel, summarizeForCloud, sanitizeForCloud, sendMessage]);

  const handleImageGen = useCallback(async (prompt: string) => {
    if (!currentConversationId) return;
    await generateImage(currentConversationId, prompt, currentProvider, currentModel);
  }, [currentConversationId, currentProvider, currentModel, generateImage]);

  // Bottom bar status
  const parallelAnySending = parallelColumns.some((c) => c.sending);
  const hasMessages = parallelEnabled
    ? parallelColumns.some((c) => c.messages.length > 0)
    : messages.length > 0;
  const inputDisabled = parallelEnabled ? parallelAnySending : sending;
  const supportsImageGen = ["openai", "xai", "google"].includes(currentProvider) && !parallelEnabled;

  // War Room
  if (warRoomEnabled) {
    return (
      <ErrorBoundary fallbackTitle="Workbench Error">
        <WarRoomDashboard />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Chat Error">
      <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
        {/* Chat area — full width, no sidebar */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {parallelHydrated && parallelEnabled ? (
            <ParallelChatView
              hideInput={true}
              onSingleChat={() => { if (parallelEnabled) toggleParallelMode(); }}
              onWarRoom={() => { if (parallelEnabled) toggleParallelMode(); setWarRoomEnabled(true); }}
            />
          ) : currentConversationId ? (
            <ChatView
              hideInput={true}
              conversationId={currentConversationId}
              onMultiChat={() => { if (!parallelEnabled) toggleParallelMode(); }}
              onWarRoom={() => setWarRoomEnabled(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-zinc-300 text-lg">Select or create a conversation</p>
            </div>
          )}
        </main>

        {/* Bottom strip — full viewport width, persistent */}
        <div className="w-full flex-shrink-0 bg-gray-50 dark:bg-zinc-950">
          <InputArea
            conversationId={currentConversationId ?? ""}
            onSend={handleSend}
            onImageGen={handleImageGen}
            hasMessages={hasMessages}
            disabled={inputDisabled}
            supportsImageGen={supportsImageGen}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
