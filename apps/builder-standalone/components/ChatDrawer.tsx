"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatView } from "@sarge/chat/index.client";
import { ParallelChatView } from "@sarge/chat/index.client";
import { ConversationList } from "@sarge/chat/index.client";

type Tab = "chat" | "multi" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "multi", label: "Multi-Chat" },
  { key: "history", label: "Conversations" },
];

export default function ChatDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Ctrl+Shift+C to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return (
    <>
      {/* Toggle button — always visible on right edge */}
      <button
        onClick={toggle}
        className={`fixed top-1/2 -translate-y-1/2 z-[60] flex items-center justify-center
          w-6 h-16 rounded-l-md bg-zinc-800 border border-r-0 border-zinc-700
          text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-all
          ${open ? "right-[420px]" : "right-0"}`}
        title="Toggle Chat (Ctrl+Shift+C)"
      >
        {open ? "\u203A" : "\u2039"}
      </button>

      {/* Drawer overlay */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[420px] bg-zinc-900 border-l border-zinc-700
          shadow-2xl flex flex-col transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Tab bar */}
        <div className="flex border-b border-zinc-700 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors
                ${
                  tab === t.key
                    ? "text-emerald-400 border-b-2 border-emerald-400 bg-zinc-800/50"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {tab === "chat" && <ChatView />}
          {tab === "multi" && <ParallelChatView />}
          {tab === "history" && (
            <div className="h-full overflow-y-auto p-3">
              <ConversationList />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
