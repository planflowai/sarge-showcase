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
    // Initialize columns with defaults if empty
    const state = get();
    if (state.columns.length === 0) {
      const defaultColumns: ChatThread[] = [
        {
          id: crypto.randomUUID(),
          topic: "Claude",
          messages: [],
          createdAt: new Date(),
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
        {
          id: crypto.randomUUID(),
          topic: "GPT-4",
          messages: [],
          createdAt: new Date(),
          provider: "openai",
          model: "gpt-4o",
        },
        {
          id: crypto.randomUUID(),
          topic: "Gemini",
          messages: [],
          createdAt: new Date(),
          provider: "google",
          model: "gemini-1.5-pro",
        },
        {
          id: crypto.randomUUID(),
          topic: "Ollama",
          messages: [],
          createdAt: new Date(),
          provider: "ollama",
          model: "llama3.2:latest",
        },
      ];
      set({ columns: defaultColumns, hydrated: true });
    } else {
      set({ hydrated: true });
    }
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
    set((state) => ({
      columns: state.columns.map((c) => {
        if (c.id === columnId) {
          return {
            ...c,
            messages: [
              ...c.messages,
              {
                id: crypto.randomUUID(),
                role: "user" as const,
                content,
                timestamp: new Date(),
              },
            ],
          };
        }
        return c;
      }),
    }));
  },

  sendToAll: (content, options, imageUrls) => {
    const { columns, activeColumnCount, sendToColumn } = get();
    // Send message to all visible columns
    columns.slice(0, activeColumnCount).forEach((col) => {
      sendToColumn(col.id, content);
    });
  },

  shareMessage: (sourceColumnId, targetColumnId, message) => {
    const { columns, sendToColumn } = get();
    const fromColumn = columns.find(c => c.id === sourceColumnId);

    if (!fromColumn) return;

    // Get model display name
    const fromModelName = fromColumn.model.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    // Create context message
    const contextContent = `Context from another model (${fromModelName}):\n${message.content}`;

    // Send as a new user message to the target column
    sendToColumn(targetColumnId, contextContent);
  },

  shareMessageToAll: (sourceColumnId, message) => {
    const { columns, sendToColumn, activeColumnCount } = get();
    const fromColumn = columns.find(c => c.id === sourceColumnId);

    if (!fromColumn) return;

    // Get model display name
    const fromModelName = fromColumn.model.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    // Create context message
    const contextContent = `Context from another model (${fromModelName}):\n${message.content}`;

    // Send to all OTHER columns (not the source) that are currently visible
    columns.slice(0, activeColumnCount).forEach(col => {
      if (col.id !== sourceColumnId) {
        sendToColumn(col.id, contextContent);
      }
    });
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
