"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import BuilderPage from "@sarge/builder/components/BuilderPage";
import { ErrorBoundary } from "../components/ui/error-boundary";
import { JuryToast } from "@sarge/core";
import { useConversationStore } from "@sarge/chat/index.client";
import { WarRoomPopout } from "@/components/chat/WarRoomPopout";

export default function Home() {
  const searchParams = useSearchParams();
  const {
    loadConversations,
    createConversation,
    setCurrent,
  } = useConversationStore();

  // War Room popout detection — ?warroom=1&slot=mon5&provider=anthropic&model=...
  const isPopout = searchParams.get("warroom") === "1";
  const popoutSlotId = searchParams.get("slot") ?? "";
  const popoutProvider = searchParams.get("provider") ?? "";
  const popoutModel = searchParams.get("model") ?? "";

  // Auto-create a conversation so ChatView has a valid conversationId
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    if (isPopout) return; // Popouts don't need conversations
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
  }, [loadConversations, createConversation, setCurrent, isPopout]);

  // War Room popout window — renders full-viewport overlay
  if (isPopout && popoutSlotId && popoutProvider) {
    return <WarRoomPopout slotId={popoutSlotId} provider={popoutProvider} model={popoutModel} />;
  }

  return (
    <div className="flex h-full w-full">
      <ErrorBoundary fallbackTitle="Builder Error">
        <BuilderPage />
      </ErrorBoundary>
      <JuryToast />
    </div>
  );
}
