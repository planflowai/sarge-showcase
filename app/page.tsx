"use client";

import { useEffect, useRef } from "react";
import { useConversationStore } from "@/lib/stores/conversationStore";
import { useKnowledgeStore } from "@/lib/stores/knowledgeStore";
import { useRoleStore } from "@/lib/stores/roleStore";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { useParallelChatStore } from "@/lib/stores/parallelChatStore";
import { ChatView } from "@/components/chat/ChatView";
import { ParallelChatView } from "@/components/chat/ParallelChatView";
import { DebateView } from "@/components/debate/DebateView";
import { TestModeView } from "@/components/test/TestModeView";
import { ForensicLogView } from "@/components/forensic/ForensicLogView";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Home() {
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

  // Overlay states
  const debate = useDebateStore((s) => s.debate);
  const showingSetup = useDebateStore((s) => s.showingSetup);
  const debateHidden = useDebateStore((s) => s.debateHidden);
  const showingTestMode = useTestModeStore((s) => s.showingTestMode);
  const testModeHidden = useTestModeStore((s) => s.testModeHidden);
  const showingForensicLog = useForensicLogStore((s) => s.showingForensicLog);

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

  // Show overlay views even when no conversation is loaded
  // This allows navigating from Dashboard to overlays directly
  if (showingForensicLog) {
    return (
      <ErrorBoundary fallbackTitle="Forensic Log Error">
        <ForensicLogView />
      </ErrorBoundary>
    );
  }

  if (showingTestMode && !testModeHidden) {
    return (
      <ErrorBoundary fallbackTitle="Test Mode Error">
        <TestModeView />
      </ErrorBoundary>
    );
  }

  if ((debate || showingSetup) && !debateHidden) {
    return (
      <ErrorBoundary fallbackTitle="Debate Arena Error">
        <DebateView />
      </ErrorBoundary>
    );
  }

  // Show parallel chat view if enabled
  if (parallelHydrated && parallelEnabled) {
    return (
      <ErrorBoundary fallbackTitle="Parallel Chat Error">
        <ParallelChatView />
      </ErrorBoundary>
    );
  }

  if (!currentConversationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-lg">
          Select or create a conversation
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Chat Error">
      <ChatView conversationId={currentConversationId} />
    </ErrorBoundary>
  );
}
