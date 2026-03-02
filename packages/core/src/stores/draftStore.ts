/**
 * Draft Store - Input Persistence
 *
 * Persists draft input text per conversation so users don't lose
 * what they were typing when navigating away.
 *
 * Keys:
 * - chat-{conversationId} - Regular chat drafts
 * - builder - Builder chat draft (single workspace)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "../lib/utils/debouncedStorage";

interface DraftState {
  // Drafts keyed by conversation ID or 'builder'
  drafts: Record<string, string>;

  // Hydration
  hydrated: boolean;

  // Actions
  hydrate: () => void;
  setDraft: (key: string, text: string) => void;
  getDraft: (key: string) => string;
  clearDraft: (key: string) => void;
  clearAllDrafts: () => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      hydrated: false,

      hydrate: () => {
        set({ hydrated: true });
      },

      setDraft: (key, text) => {
        set((state) => ({
          drafts: {
            ...state.drafts,
            [key]: text,
          },
        }));
      },

      getDraft: (key) => {
        return get().drafts[key] || '';
      },

      clearDraft: (key) => {
        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[key];
          return { drafts: newDrafts };
        });
      },

      clearAllDrafts: () => {
        set({ drafts: {} });
      },
    }),
    {
      name: 'chat-drafts',
      version: 1,
      storage: createDebouncedStorage(),
    }
  )
);

// Helper to generate draft key for a conversation
export function getChatDraftKey(conversationId: string): string {
  return `chat-${conversationId}`;
}

// Builder uses a fixed key
export const BUILDER_DRAFT_KEY = 'builder';
