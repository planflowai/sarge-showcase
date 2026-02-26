/**
 * Changes Store - Tracks all changes made in the current Builder session
 *
 * Each change entry tracks:
 * - What file was changed
 * - What action was taken (create, modify, reject)
 * - When it happened
 * - Which model was used
 * - The associated message ID for scrolling to it
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@sarge/core";

export interface ChangeEntry {
  id: string;
  timestamp: Date;
  filePath: string;
  action: 'created' | 'modified' | 'rejected';
  summary: string;
  model: string;
  provider: string;
  messageId: string;  // For scrolling to the message in chat
  status: 'applied' | 'rejected' | 'pending';
}

interface ChangesState {
  changes: ChangeEntry[];

  // Actions
  addChange: (change: Omit<ChangeEntry, 'id' | 'timestamp'>) => string;
  updateChangeStatus: (id: string, status: ChangeEntry['status']) => void;
  clearChanges: () => void;
  getRecentChanges: (count?: number) => ChangeEntry[];
}

export const useChangesStore = create<ChangesState>()(
  persist(
    (set, get) => ({
      changes: [],

      addChange: (change) => {
        const id = `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const entry: ChangeEntry = {
          ...change,
          id,
          timestamp: new Date(),
        };

        set(state => ({
          changes: [entry, ...state.changes], // Most recent first
        }));

        return id;
      },

      updateChangeStatus: (id, status) => {
        set(state => ({
          changes: state.changes.map(c =>
            c.id === id ? { ...c, status } : c
          ),
        }));
      },

      clearChanges: () => {
        set({ changes: [] });
      },

      getRecentChanges: (count = 10) => {
        return get().changes.slice(0, count);
      },
    }),
    {
      name: "changes",
      storage: createDebouncedStorage(),
    }
  )
);
