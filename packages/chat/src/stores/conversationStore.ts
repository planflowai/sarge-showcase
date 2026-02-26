"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, ChatMode } from "@sarge/core";

interface ConversationState {
  conversations: Conversation[];
  currentId: string | null;
  currentConversationId: string | null;
  loading: boolean;
  hydrated: boolean;
  hydrate: () => void;
  loadConversations: () => void;
  createConversation: (title: string, mode?: ChatMode) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, conversation: Partial<Conversation>) => void;
  updateConversationTitle: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  setCurrentId: (id: string | null) => void;
  setCurrent: (id: string | null) => void;
  setCurrentForMode: (id: string | null, mode: ChatMode) => void;
  subscribe: (callback?: (state: ConversationState) => void) => () => void;
  clearAll: () => void;
}

const MESSAGES_PREFIX = "messages_";
const AI_CHAT_MESSAGES_PREFIX = "ai-analysis-chat-messages-";

// Debounced backup to disk — prevents hammering the API on rapid changes
let backupTimeout: NodeJS.Timeout | null = null;
function scheduleBackupToDisk() {
  if (typeof window === "undefined") return;
  if (backupTimeout) clearTimeout(backupTimeout);
  backupTimeout = setTimeout(() => {
    const state = useConversationStore.getState();
    const conversations = state.conversations;
    if (conversations.length === 0) return;

    // Collect all message data for each conversation
    const messages: Record<string, any[]> = {};
    for (const conv of conversations) {
      // Try both prefixes
      const raw = localStorage.getItem(MESSAGES_PREFIX + conv.id)
        || localStorage.getItem(AI_CHAT_MESSAGES_PREFIX + conv.id);
      if (raw) {
        try { messages[conv.id] = JSON.parse(raw); } catch {}
      }
    }

    fetch("/api/chat/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversations, messages }),
    }).catch(() => {}); // silent fail
  }, 3000);
}

export const useConversationStore = create<ConversationState>()(persist(
  (set, get) => ({
  conversations: [],
  currentId: null,
  currentConversationId: null,
  loading: false,
  hydrated: false,

  hydrate: async () => {
    if (typeof window === "undefined") {
      set({ hydrated: true });
      return;
    }
    const existing = new Set(get().conversations.map(c => c.id));
    const orphans: Conversation[] = [];

    // 1. Restore from disk backup if localStorage has no conversations
    if (existing.size === 0) {
      try {
        const res = await fetch("/api/chat/backup");
        if (res.ok) {
          const backup = await res.json();
          if (backup.conversations?.length > 0) {
            for (const conv of backup.conversations) {
              const c: Conversation = {
                id: conv.id,
                title: conv.title || "Restored Chat",
                messages: [],
                contextFiles: [],
                provider: conv.provider || "anthropic",
                model: conv.model || "unknown",
                createdAt: new Date(conv.createdAt || Date.now()),
                updatedAt: new Date(conv.updatedAt || Date.now()),
                mode: conv.mode || "chat",
              };
              orphans.push(c);
              existing.add(c.id);

              // Restore messages to localStorage if we have them
              const msgs = backup.messages?.[conv.id];
              if (msgs && Array.isArray(msgs) && msgs.length > 0) {
                try {
                  localStorage.setItem(MESSAGES_PREFIX + conv.id, JSON.stringify(msgs));
                } catch {}
              }
            }
          }
        }
      } catch {}
    }

    // 2. Recover from ai-analysis-chat-conversations metadata
    try {
      const aiChatRaw = localStorage.getItem("ai-analysis-chat-conversations");
      if (aiChatRaw) {
        const aiChats = JSON.parse(aiChatRaw);
        if (Array.isArray(aiChats)) {
          for (const ac of aiChats) {
            if (ac.id && !existing.has(ac.id)) {
              orphans.push({
                id: ac.id,
                title: ac.title || "AI Analysis Chat",
                messages: [],
                contextFiles: [],
                provider: ac.provider || "anthropic",
                model: ac.model || "unknown",
                createdAt: new Date(ac.createdAt || Date.now()),
                updatedAt: new Date(ac.updatedAt || ac.createdAt || Date.now()),
                mode: "chat",
              });
              existing.add(ac.id);
            }
          }
        }
      }
    } catch {}

    // 3. Scan localStorage for orphaned message keys
    const prefixes = [MESSAGES_PREFIX, AI_CHAT_MESSAGES_PREFIX];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      let convId: string | null = null;
      for (const prefix of prefixes) {
        if (key.startsWith(prefix)) {
          convId = key.slice(prefix.length);
          break;
        }
      }
      if (!convId || existing.has(convId)) continue;

      try {
        const msgs = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(msgs) || msgs.length === 0) continue;
        const firstMsg = msgs[0];
        const lastMsg = msgs[msgs.length - 1];
        const userMsg = msgs.find((m: any) => m.role === "user");
        const rawTitle = userMsg?.content?.slice(0, 50) || "Recovered Chat";
        const title = rawTitle.length >= 50 ? rawTitle + "..." : rawTitle;

        orphans.push({
          id: convId,
          title,
          messages: [],
          contextFiles: [],
          provider: firstMsg?.provider || "anthropic",
          model: firstMsg?.model || "unknown",
          createdAt: new Date(firstMsg?.timestamp || Date.now()),
          updatedAt: new Date(lastMsg?.timestamp || Date.now()),
          mode: "chat",
        });
        existing.add(convId);
      } catch {}
    }

    if (orphans.length > 0) {
      set((state) => ({
        conversations: [...state.conversations, ...orphans],
        hydrated: true,
      }));
    } else {
      set({ hydrated: true });
    }

    // Schedule backup after hydration
    scheduleBackupToDisk();
  },

  loadConversations: () => {
    get().hydrate();
  },

  createConversation: (title: string, mode: ChatMode = "chat") => {
    const conversation: Conversation = {
      id: `conv_${Date.now()}`,
      title,
      messages: [],
      mode,
      contextFiles: [],
      provider: "anthropic",
      model: "claude-opus-4-6",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((state) => ({
      conversations: [...state.conversations, conversation],
      currentId: conversation.id,
      currentConversationId: conversation.id,
    }));
    scheduleBackupToDisk();
  },

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [...state.conversations, conversation],
    }));
    scheduleBackupToDisk();
  },

  updateConversation: (id, updates) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
      ),
    }));
    scheduleBackupToDisk();
  },

  updateConversationTitle: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: new Date() } : c
      ),
    }));
    scheduleBackupToDisk();
  },

  deleteConversation: (id) => {
    if (typeof window !== "undefined") {
      try { localStorage.removeItem(MESSAGES_PREFIX + id); } catch {}
    }
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
    }));
    scheduleBackupToDisk();
  },

  setCurrentId: (id) => {
    set({ currentId: id, currentConversationId: id });
  },

  setCurrent: (id) => {
    set({ currentId: id, currentConversationId: id });
  },

  setCurrentForMode: (id, mode) => {
    set({ currentId: id, currentConversationId: id });
  },

  subscribe: (callback) => {
    return () => {};
  },

  clearAll: () => {
    set({
      conversations: [],
      currentId: null,
      currentConversationId: null,
      loading: false,
    });
  },
}), {
  name: "sarge-conversations",
  partialize: (state) => ({
    conversations: state.conversations,
    currentConversationId: state.currentConversationId,
  }),
  onRehydrateStorage: () => (state) => {
    if (state?.conversations) {
      state.conversations = state.conversations.map(c => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }));
    }
  },
}));
