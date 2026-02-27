"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import BuilderPage from "@sarge/builder/components/BuilderPage";
import ChatDrawer from "../components/ChatDrawer";
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
    <div className="flex h-screen w-full">
      <ErrorBoundary fallbackTitle="Builder Error">
        <BuilderPage />
      </ErrorBoundary>
      <ChatDrawer />
      <Link
        href="/settings"
        className="fixed bottom-4 left-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors shadow-lg"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </Link>
      <JuryToast />
    </div>
  );
}
