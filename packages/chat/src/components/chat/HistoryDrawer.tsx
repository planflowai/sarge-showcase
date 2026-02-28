"use client";

import { useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@sarge/core";
import { ConversationList } from "../conversation/ConversationList";
import { useConversationStore } from "../../stores/conversationStore";
import { useMessageStore } from "../../stores/messageStore";

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const createConversation = useConversationStore((s) => s.createConversation);
  const clearMessages = useMessageStore((s) => s.clearMessages);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleNewChat = async () => {
    clearMessages();
    await createConversation(`Chat ${new Date().toLocaleTimeString()}`);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-80 bg-zinc-950 border-r border-zinc-800/60 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <span className="text-sm font-bold text-zinc-200 tracking-wide">
            History
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat button */}
        <div className="px-3 pb-3 flex-shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-sm font-bold transition-all hover:shadow-[0_0_14px_rgba(249,115,22,0.3)]"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1">
          <ConversationList />
        </div>
      </div>
    </>
  );
}
