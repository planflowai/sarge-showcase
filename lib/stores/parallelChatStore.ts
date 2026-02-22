"use client";

import { create } from "zustand";

export interface ChatThread {
  id: string;
  topic: string;
  messages: any[];
  createdAt: Date;
  roleId?: string;
  provider: string;
  model: string;
  sending?: boolean;
}

export type ChatColumn = ChatThread;

export interface SavedSession {
  id: string;
  name: string;
  columns: ChatThread[];
  activeColumnCount?: number;
  savedAt: number;
}

interface ParallelChatState {
  threads: ChatThread[];
  columns: ChatThread[];
  activeThreadId: string | null;
  activeColumnCount: number;
  enabled: boolean;
  hydrated: boolean;
  savedSessions: SavedSession[];
  hydrate: () => void;
  toggleParallelMode: () => void;
  addThread: (thread: ChatThread) => void;
  setActiveThread: (id: string | null) => void;
  updateThread: (id: string, updates: Partial<ChatThread>) => void;
  deleteThread: (id: string) => void;
  setColumnCount: (count: number) => void;
  setColumnModel: (columnId: string, model: string, provider: string) => void;
  setColumnRole: (columnId: string, roleId: string | undefined) => void;
  sendToColumn: (columnId: string, content: string) => void;
  sendToAll: (content: string, options?: any, imageUrls?: string[]) => void;
  shareMessage: (sourceColumnId: string, targetColumnId: string, message: any) => void;
  shareMessageToAll: (sourceColumnId: string, message: any) => void;
  clearColumn: (columnId: string) => void;
  clearAllColumns: () => void;
  getOtherColumns: (columnId: string) => ChatThread[];
  saveCurrentSession: (name?: string) => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearAll: () => void;
}

export const useParallelChatStore = create<ParallelChatState>((set, get) => ({
  threads: [],
  columns: [],
  activeThreadId: null,
  activeColumnCount: 3,
  enabled: false,
  hydrated: false,
  savedSessions: [],

  hydrate: () => {
    set({ hydrated: true });
  },

  toggleParallelMode: () => {
    set((state) => ({ enabled: !state.enabled }));
  },

  addThread: (thread) => {
    set((state) => ({
      threads: [...state.threads, thread],
      columns: [...state.columns, thread],
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
      columns: state.columns.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },

  deleteThread: (id) => {
    set((state) => ({
      threads: state.threads.filter((t) => t.id !== id),
      columns: state.columns.filter((t) => t.id !== id),
      activeThreadId: state.activeThreadId === id ? null : state.activeThreadId,
    }));
  },

  setColumnCount: (count) => {
    set({ activeColumnCount: count });
  },

  setColumnModel: (columnId, model, provider) => {
    set((state) => ({
      columns: state.columns.map((c) =>
        c.id === columnId ? { ...c, model, provider } : c
      ),
    }));
  },

  setColumnRole: (columnId, roleId) => {
    set((state) => ({
      columns: state.columns.map((c) =>
        c.id === columnId ? { ...c, roleId } : c
      ),
    }));
  },

  sendToColumn: (columnId, content) => {
    // Placeholder for sending message to specific column
  },

  sendToAll: (content, options, imageUrls) => {
    // Placeholder for sending message to all columns
  },

  shareMessage: (sourceColumnId, targetColumnId, message) => {
    // Placeholder for sharing message between columns
  },

  shareMessageToAll: (sourceColumnId, message) => {
    // Placeholder for sharing message to all columns
  },

  clearColumn: (columnId) => {
    set((state) => ({
      columns: state.columns.map((c) =>
        c.id === columnId ? { ...c, messages: [] } : c
      ),
    }));
  },

  clearAllColumns: () => {
    set((state) => ({
      columns: state.columns.map((c) => ({ ...c, messages: [] })),
    }));
  },

  getOtherColumns: (columnId) => {
    const state = get();
    return state.columns.filter((c) => c.id !== columnId);
  },

  saveCurrentSession: (name) => {
    set((state) => ({
      savedSessions: [
        ...state.savedSessions,
        {
          id: crypto.randomUUID(),
          name: name || `Session ${new Date().toLocaleString()}`,
          columns: state.columns,
          activeColumnCount: state.activeColumnCount,
          savedAt: Date.now(),
        },
      ],
    }));
  },

  loadSession: (sessionId) => {
    const state = get();
    const session = state.savedSessions.find((s) => s.id === sessionId);
    if (session) {
      set({ columns: session.columns, threads: session.columns });
    }
  },

  deleteSession: (sessionId) => {
    set((state) => ({
      savedSessions: state.savedSessions.filter((s) => s.id !== sessionId),
    }));
  },

  clearAll: () => {
    set({
      threads: [],
      columns: [],
      activeThreadId: null,
      savedSessions: [],
    });
  },
}));
