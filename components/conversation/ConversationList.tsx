"use client";

import { useEffect, useState } from "react";
import { useConversationStore } from "@/lib/stores/conversationStore";
import { useMessageStore } from "@/lib/stores/messageStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { MessageSquare, Compass, Trash2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { providers } from "@/lib/providers";
import type { Message, Conversation } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Last Month", "Older"];
const STORAGE_PREFIX = "ai-workbench-messages-";

function getProviderDisplayName(provider?: string): string {
  if (!provider) return "Assistant";
  const p = providers.find((pr) => pr.id === provider);
  return p ? p.name : "Assistant";
}

function formatTranscript(messages: Message[]): string {
  return messages
    .map((msg) => {
      if (msg.role === "user") {
        return `**User:** ${msg.content}`;
      }
      const name = getProviderDisplayName(msg.provider);
      return `**${name}:** ${msg.content}`;
    })
    .join("\n\n");
}

function loadMessagesForConversation(conversationId: string): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + conversationId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((m: Record<string, unknown>) => ({
      ...m,
      timestamp: new Date(m.timestamp as string),
    }));
  } catch {
    return [];
  }
}

export function ConversationList() {
  const allConversations = useConversationStore((s) => s.conversations);
  const currentConversationId = useConversationStore((s) => s.currentConversationId);
  const loading = useConversationStore((s) => s.loading);
  const loadConversations = useConversationStore((s) => s.loadConversations);
  const setCurrentForMode = useConversationStore((s) => s.setCurrentForMode);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const subscribe = useConversationStore((s) => s.subscribe);
  const chatMode = useUIStore((s) => s.chatMode);

  const loadMessages = useMessageStore((s) => s.loadMessages);
  const clearMessages = useMessageStore((s) => s.clearMessages);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);

  // Filter conversations by current mode
  const conversations = allConversations.filter((c) => {
    // Default to "chat" mode for conversations without a mode set
    const convMode = c.mode || "chat";
    return convMode === chatMode;
  });

  useEffect(() => {
    loadConversations();
    const unsubscribe = subscribe();
    return unsubscribe;
  }, [loadConversations, subscribe]);

  const handleSelect = (id: string) => {
    setCurrentForMode(id, chatMode);
    loadMessages(id);
  };

  const handleDeleteClick = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setConversationToDelete(conv);
  };

  const handleDeleteConfirm = async () => {
    if (!conversationToDelete) return;
    await deleteConversation(conversationToDelete.id);
    if (currentConversationId === conversationToDelete.id) {
      clearMessages();
    }
    setConversationToDelete(null);
  };

  const handleCopy = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const messages = loadMessagesForConversation(id);
    if (messages.length === 0) {
      await navigator.clipboard.writeText("(No messages)");
    } else {
      const text = formatTranscript(messages);
      await navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading && conversations.length === 0) {
    return <p className="px-1 text-xs text-zinc-500">Loading...</p>;
  }

  if (conversations.length === 0) {
    return (
      <p className="px-1 text-xs text-zinc-500">No conversations yet</p>
    );
  }

  // Group by relative date
  const grouped: Record<string, typeof conversations> = {};
  for (const conv of conversations) {
    const label = formatRelativeDate(conv.updatedAt);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(conv);
  }

  // Sort each group newest-first
  for (const label of Object.keys(grouped)) {
    grouped[label].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // Only include groups that have conversations, in order
  const activeGroups = GROUP_ORDER.filter((g) => grouped[g]?.length);

  return (
    <>
      <Accordion
        type="multiple"
        defaultValue={[]}
        className="space-y-0"
      >
        {activeGroups.map((label) => {
          const convs = grouped[label];
          return (
            <AccordionItem key={label} value={label} className="border-none">
              <AccordionTrigger className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400 hover:no-underline">
                {label} ({convs.length})
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <div className="space-y-0.5">
                  {convs.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => handleSelect(conv.id)}
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        currentConversationId === conv.id
                          ? "bg-zinc-700 text-white"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                      )}
                    >
                      {conv.mode === "architect" ? (
                        <Compass className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="flex-1 truncate">
                        {conv.title || "Untitled"}
                      </span>
                      {copiedId === conv.id ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <Copy
                          className="h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
                          onClick={(e) => handleCopy(e, conv.id)}
                        />
                      )}
                      <Trash2
                        className="h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        onClick={(e) => handleDeleteClick(e, conv)}
                      />
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Toast notification */}
      {copiedId && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-zinc-800 px-4 py-2 text-sm text-emerald-400 shadow-lg border border-zinc-700">
          Conversation copied to clipboard
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!conversationToDelete}
        onClose={() => setConversationToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Conversation"
        description={`Are you sure you want to delete "${conversationToDelete?.title || 'Untitled'}"? This will permanently remove the conversation and all its messages.`}
        variant="destructive"
        confirmText="Delete"
      />
    </>
  );
}
