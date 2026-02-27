"use client";

import { useEffect, useRef } from "react";
import BuilderPage from "@sarge/builder/components/BuilderPage";
import { ErrorBoundary } from "../components/ui/error-boundary";
import { JuryToast } from "@sarge/core";
import { useConversationStore } from "@sarge/chat/index.client";

export default function Home() {
  const {
    loadConversations,
    createConversation,
    setCurrent,
  } = useConversationStore();

  // Auto-create a conversation so ChatView has a valid conversationId
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      await loadConversations();
      const state = useConversationStore.getState();
      if (state.conversations.length === 0) {
        await createConversation("Builder Chat");
      } else if (!state.currentConversationId) {
        setCurrent(state.conversations[0].id);
      }
    })();
  }, [loadConversations, createConversation, setCurrent]);

  return (
    <div className="flex h-full w-full">
      <ErrorBoundary fallbackTitle="Builder Error">
        <BuilderPage />
      </ErrorBoundary>
      <JuryToast />
    </div>
  );
}
