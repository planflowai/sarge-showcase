"use client";

import { create } from "zustand";
import { queueResponse, runInterventionCheck } from "@/lib/juryGuardian/engine";
import { useJuryGuardianStore } from "@/lib/stores/juryGuardianStore";

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
  sendToColumn: (columnId: string, content: string) => Promise<void>;
  sendToAll: (content: string, options?: any, imageUrls?: string[]) => Promise<void>;
  shareMessage: (sourceColumnId: string, targetColumnId: string, message: any) => Promise<void>;
  shareMessageToAll: (sourceColumnId: string, message: any) => Promise<void>;
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
    // Initialize blank columns - user selects provider/model
    const state = get();
    if (state.columns.length === 0) {
      const defaultColumns: ChatThread[] = [
        {
          id: crypto.randomUUID(),
          topic: "Column 1",
          messages: [],
          createdAt: new Date(),
          provider: "" as any,
          model: "",
        },
        {
          id: crypto.randomUUID(),
          topic: "Column 2",
          messages: [],
          createdAt: new Date(),
          provider: "" as any,
          model: "",
        },
        {
          id: crypto.randomUUID(),
          topic: "Column 3",
          messages: [],
          createdAt: new Date(),
          provider: "" as any,
          model: "",
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

  sendToColumn: async (columnId, content) => {
    const state = get();
    const column = state.columns.find((c) => c.id === columnId);
    if (!column) return;

    // Check if provider/model are selected
    if (!column.provider || !column.model) {
      // Add error message instead
      set((s) => ({
        columns: s.columns.map((c) =>
          c.id === columnId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant" as const,
                    content: "⚠️ Please select a provider and model for this column first.",
                    timestamp: new Date(),
                    isError: true,
                  },
                ],
              }
            : c
        ),
      }));
      return;
    }

    // Add user message to column
    set((s) => ({
      columns: s.columns.map((c) =>
        c.id === columnId
          ? {
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
            }
          : c
      ),
    }));

    // Set sending state
    set((s) => ({
      columns: s.columns.map((c) =>
        c.id === columnId ? { ...c, sending: true } : c
      ),
    }));

    const startTime = Date.now();
    try {
      // Get current messages from the updated state
      const updatedState = get();
      const updatedColumn = updatedState.columns.find((c) => c.id === columnId);
      if (!updatedColumn) return;

      const messagesToSend = updatedColumn.messages;

      // Call API
      const requestBody = {
        messages: messagesToSend,
        provider: column.provider,
        model: column.model,
        roleId: column.roleId,
      };

      console.log("[ParallelChat] Sending to /api/chat:", {
        provider: column.provider,
        model: column.model,
        messageCount: messagesToSend.length,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[ParallelChat] API error response:", errorData);
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      const assistantMessageId = crypto.randomUUID();
      const assistantMessage = {
        id: assistantMessageId,
        role: "assistant" as const,
        content: data.content || "",
        timestamp: new Date(),
        provider: column.provider,
        model: column.model,
        tokenCount: data.tokens,
        latencyMs,
      };

      // Queue response for Jury Guardian monitoring
      queueResponse(columnId, {
        pane: 0, // Placeholder - could track which pane this is
        model: column.model,
        provider: column.provider,
        content: assistantMessage.content,
        timestamp: new Date(),
      });

      // Check if response should be intercepted by Jury Guardian
      const juryStore = useJuryGuardianStore.getState();
      let messageToAdd = assistantMessage;
      let isKilled = false;

      if (juryStore.enabled && juryStore.behavior.interventionEnabled) {
        const check = runInterventionCheck(columnId, assistantMessage.content, column.model);
        if (check.blocked) {
          isKilled = true;
          // Log the kill if it's a valid type
          if (check.type === "echo" || check.type === "contradiction") {
            juryStore.logKill(columnId, {
              content: assistantMessage.content,
              reason: check.reason,
              model: column.model,
              type: check.type,
            });
          }

          // Create killed message instead
          messageToAdd = {
            ...assistantMessage,
            content: `🛑 Response Killed\n\n**Reason:** ${check.reason}`,
            isKilled: true,
            killedReason: check.reason,
          };

          // Add toast notification
          juryStore.addToast({
            type: "killed",
            title: "🛑 Response Killed",
            message: check.reason,
            sessionId: columnId,
          });
        }
      }

      // Add message to column
      set((s) => ({
        columns: s.columns.map((c) =>
          c.id === columnId
            ? {
                ...c,
                messages: [...c.messages, messageToAdd],
                sending: false,
              }
            : c
        ),
      }));
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to get response";

      // Add error message
      set((s) => ({
        columns: s.columns.map((c) =>
          c.id === columnId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant" as const,
                    content: `🔴 Error: ${errorMsg}`,
                    timestamp: new Date(),
                    isError: true,
                  },
                ],
                sending: false,
              }
            : c
        ),
      }));

      console.error(`[ParallelChat] Column ${columnId} error:`, err);
    }
  },

  sendToAll: async (content, options, imageUrls) => {
    const { columns, activeColumnCount } = get();
    const visibleColumns = columns.slice(0, activeColumnCount);

    // Send to all visible columns in parallel
    await Promise.all(
      visibleColumns.map((col) => get().sendToColumn(col.id, content))
    );
  },

  shareMessage: async (sourceColumnId, targetColumnId, message) => {
    const { columns } = get();
    const fromColumn = columns.find(c => c.id === sourceColumnId);

    if (!fromColumn) return;

    // Get model display name
    const fromModelName = fromColumn.model.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    // Create context message
    const contextContent = `Context from another model (${fromModelName}):\n${message.content}`;

    // Send as a new user message to the target column
    await get().sendToColumn(targetColumnId, contextContent);
  },

  shareMessageToAll: async (sourceColumnId, message) => {
    const { columns, activeColumnCount } = get();
    const fromColumn = columns.find(c => c.id === sourceColumnId);

    if (!fromColumn) return;

    // Get model display name
    const fromModelName = fromColumn.model.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    // Create context message
    const contextContent = `Context from another model (${fromModelName}):\n${message.content}`;

    // Send to all OTHER columns (not the source) that are currently visible in parallel
    const otherColumns = columns
      .slice(0, activeColumnCount)
      .filter(col => col.id !== sourceColumnId);

    await Promise.all(
      otherColumns.map(col => get().sendToColumn(col.id, contextContent))
    );
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
