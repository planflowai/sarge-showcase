"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "../lib/utils/debouncedStorage";
import { useAirGapStore } from "./airGapStore";

// Sync status types
export type SyncStatus = "synced" | "pending" | "error" | "airgap";

export interface QueuedSync {
  id: string;
  type: "session" | "response" | "conversation" | "builderLog";
  operation: "create" | "update" | "delete";
  data: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

interface SyncStatusState {
  // Overall status
  status: SyncStatus;

  // Queued items for retry
  queue: QueuedSync[];

  // Last sync timestamps
  lastForensicSync: string | null;
  lastConversationSync: string | null;
  lastBuilderLogSync: string | null;

  // Error tracking
  lastError: string | null;
  errorCount: number;

  // Actions
  setStatus: (status: SyncStatus) => void;
  addToQueue: (item: Omit<QueuedSync, "id" | "createdAt" | "retryCount">) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<QueuedSync>) => void;
  clearQueue: () => void;
  setLastSync: (type: "forensic" | "conversation" | "builderLog") => void;
  setError: (error: string | null) => void;
  incrementErrorCount: () => void;
  resetErrorCount: () => void;

  // Computed
  getQueueByType: (type: QueuedSync["type"]) => QueuedSync[];
  hasQueuedItems: () => boolean;

  // Process queue (called periodically)
  processQueue: () => Promise<void>;
}

// Max retries before giving up on an item
const MAX_RETRIES = 5;
// Retry delay multiplier (exponential backoff)
const RETRY_BASE_DELAY = 2000;

export const useSyncStatusStore = create<SyncStatusState>()(
  persist(
    (set, get) => ({
      status: "synced",
      queue: [],
      lastForensicSync: null,
      lastConversationSync: null,
      lastBuilderLogSync: null,
      lastError: null,
      errorCount: 0,

      setStatus: (status) => set({ status }),

      addToQueue: (item) => {
        const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const queuedItem: QueuedSync = {
          ...item,
          id,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };
        set((s) => ({
          queue: [...s.queue, queuedItem],
          status: "pending",
        }));
      },

      removeFromQueue: (id) => {
        set((s) => {
          const newQueue = s.queue.filter((item) => item.id !== id);
          return {
            queue: newQueue,
            status: newQueue.length === 0 ? "synced" : s.status,
          };
        });
      },

      updateQueueItem: (id, updates) => {
        set((s) => ({
          queue: s.queue.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      clearQueue: () => set({ queue: [], status: "synced" }),

      setLastSync: (type) => {
        const now = new Date().toISOString();
        switch (type) {
          case "forensic":
            set({ lastForensicSync: now });
            break;
          case "conversation":
            set({ lastConversationSync: now });
            break;
          case "builderLog":
            set({ lastBuilderLogSync: now });
            break;
        }
      },

      setError: (error) => {
        set({ lastError: error, status: error ? "error" : "synced" });
      },

      incrementErrorCount: () => {
        set((s) => ({ errorCount: s.errorCount + 1 }));
      },

      resetErrorCount: () => set({ errorCount: 0 }),

      getQueueByType: (type) => {
        return get().queue.filter((item) => item.type === type);
      },

      hasQueuedItems: () => get().queue.length > 0,

      processQueue: async () => {
        const state = get();

        // Don't process if air-gap is active
        if (useAirGapStore.getState().airGapEnabled) {
          set({ status: "airgap" });
          return;
        }

        // No items to process
        if (state.queue.length === 0) {
          set({ status: "synced" });
          return;
        }

        set({ status: "pending" });

        // Process each item
        for (const item of state.queue) {
          // Skip items that have exceeded max retries
          if (item.retryCount >= MAX_RETRIES) {
            console.warn(`[Sync] Giving up on item ${item.id} after ${MAX_RETRIES} retries`);
            get().removeFromQueue(item.id);
            continue;
          }

          try {
            // Import sync functions dynamically to avoid circular dependencies
            const { processQueuedItem } = await import("../lib/supabase/syncQueue");
            const success = await processQueuedItem(item);

            if (success) {
              get().removeFromQueue(item.id);
              get().resetErrorCount();
            } else {
              // Increment retry count
              get().updateQueueItem(item.id, {
                retryCount: item.retryCount + 1,
                lastError: "Sync returned false",
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Sync] Failed to process item ${item.id}:`, errorMessage);

            get().updateQueueItem(item.id, {
              retryCount: item.retryCount + 1,
              lastError: errorMessage,
            });
            get().incrementErrorCount();
            get().setError(errorMessage);
          }
        }

        // Update final status
        const newState = get();
        if (newState.queue.length === 0) {
          set({ status: "synced", lastError: null });
        } else if (newState.errorCount > 0) {
          set({ status: "error" });
        }
      },
    }),
    {
      name: "sarge-sync-status",
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        queue: state.queue,
        lastForensicSync: state.lastForensicSync,
        lastConversationSync: state.lastConversationSync,
        lastBuilderLogSync: state.lastBuilderLogSync,
      }),
    }
  )
);

// Helper to check if sync should proceed
export function shouldSync(): boolean {
  return !useAirGapStore.getState().airGapEnabled;
}

// Debounce helper for conversation sync
let conversationSyncTimeout: ReturnType<typeof setTimeout> | null = null;
export function debouncedConversationSync(callback: () => void, delay = 2000) {
  if (conversationSyncTimeout) {
    clearTimeout(conversationSyncTimeout);
  }
  conversationSyncTimeout = setTimeout(callback, delay);
}
