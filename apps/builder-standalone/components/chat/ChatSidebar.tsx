"use client";

import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { useConversationStore, useMessageStore, ConversationList } from "@sarge/chat/index.client";
import { cn } from "@/lib/utils";

export function ChatSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const createConversation = useConversationStore((s) => s.createConversation);
  const clearMessages      = useMessageStore((s) => s.clearMessages);

  const handleNewChat = async () => {
    clearMessages();
    await createConversation(`Chat ${new Date().toLocaleTimeString()}`);
  };

  // ── Collapsed: slim icon strip ──────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="flex-shrink-0 w-12 flex flex-col border-r border-zinc-800 bg-zinc-900 items-center pt-3 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          className="p-2 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={handleNewChat}
          title="New Chat"
          className="p-2 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="h-px w-6 bg-zinc-800 my-1" />
        <button
          title="Conversations"
          className="p-2 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────────
  return (
    <aside className="flex-shrink-0 w-[280px] flex flex-col border-r border-zinc-800 bg-zinc-900">

      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800/60 flex-shrink-0">
        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">
          Conversations
        </span>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat button */}
      <div className="px-3 py-3 border-b border-zinc-800/40 flex-shrink-0">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold transition-all hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Conversation list — scrollable */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        <ConversationList />
      </div>

    </aside>
  );
}
