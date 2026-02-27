"use client";

import { useEffect, useRef } from "react";
import { ChatView } from "@sarge/chat/index.client";
import { ParallelChatView } from "@sarge/chat/index.client";
import { useConversationStore } from "@sarge/chat/index.client";
import { useParallelChatStore } from "@sarge/chat/index.client";
import { useKnowledgeStore, useRoleStore } from "@sarge/core";
import { ErrorBoundary } from "@/components/ui/error-boundary";

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

  // Auto-load conversations on mount, auto-create if none exist
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    hydrateKnowledge();
    hydrateRoles();
    hydrateParallel();
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

  // Show parallel chat view if enabled
  if (parallelHydrated && parallelEnabled) {
    return (
      <ErrorBoundary fallbackTitle="Parallel Chat Error">
        <ParallelChatView
          onSingleChat={() => { if (parallelEnabled) toggleParallelMode(); }}
        />
      </ErrorBoundary>
    );
  }

  if (!currentConversationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500 text-lg">
          Select or create a conversation
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Chat Error">
      <ChatView
        conversationId={currentConversationId}
        onMultiChat={() => { if (!parallelEnabled) toggleParallelMode(); }}
      />
    </ErrorBoundary>
  );
}
