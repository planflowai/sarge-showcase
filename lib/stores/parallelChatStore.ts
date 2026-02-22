"use client";

import { create } from "zustand";

export interface ChatThread {
  id: string;
  topic: string;
  messages: any[];
  createdAt: Date;
}

interface ParallelChatState {
  threads: ChatThread[];
  activeThreadId: string | null;
  enabled: boolean;
  hydrated: boolean;
  hydrate: () => void;
  toggleParallelMode: () => void;
  addThread: (thread: ChatThread) => void;
  setActiveThread: (id: string | null) => void;
  updateThread: (id: string, updates: Partial<ChatThread>) => void;
  deleteThread: (id: string) => void;
  clearAll: () => void;
}

export const useParallelChatStore = create<ParallelChatState>((set) => ({
  threads: [],
  activeThreadId: null,
  enabled: false,
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  toggleParallelMode: () => {
    set((state) => ({ enabled: !state.enabled }));
  },

  addThread: (thread) => {
    set((state) => ({
      threads: [...state.threads, thread],
    }));
  },

  setActiveThread: (id) => {
    set({ activeThreadId: id });
  },

  updateThread: (id, updates) => {
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },

  deleteThread: (id) => {
    set((state) => ({
      threads: state.threads.filter((t) => t.id !== id),
      activeThreadId: state.activeThreadId === id ? null : state.activeThreadId,
    }));
  },

  clearAll: () => {
    set({
      threads: [],
      activeThreadId: null,
    });
  },
}));
