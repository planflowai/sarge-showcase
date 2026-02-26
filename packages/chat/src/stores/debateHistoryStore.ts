"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedDebate {
  id: string;
  topic: string;
  createdAt: Date;
  updatedAt: Date;
  agentSlots: Array<{ provider: string | null; model: string | null; role?: string }>;
  judgeSlot: { provider: string | null; model: string | null };
  passMode: "blind" | "sequential";
  totalRounds: number;
  currentRound: number;
  rounds: any[];
  debateComplete: boolean;
  finalJudgeSummary: string;
}

interface DebateHistoryState {
  debates: SavedDebate[];
  currentDebateId: string | null;

  saveDebate: (debate: SavedDebate) => void;
  updateDebate: (id: string, debate: Partial<SavedDebate>) => void;
  deleteDebate: (id: string) => void;
  getDebate: (id: string) => SavedDebate | undefined;
  setCurrent: (id: string | null) => void;
  loadDebates: () => void;
}

export const useDebateHistoryStore = create<DebateHistoryState>()(
  persist(
    (set, get) => ({
      debates: [],
      currentDebateId: null,

      saveDebate: (debate: SavedDebate) => {
        set((state) => {
          const existing = state.debates.find(d => d.id === debate.id);
          let updatedDebates;

          if (existing) {
            updatedDebates = state.debates.map(d =>
              d.id === debate.id ? { ...debate, updatedAt: new Date() } : d
            );
          } else {
            updatedDebates = [{ ...debate, createdAt: new Date(), updatedAt: new Date() }, ...state.debates];
          }

          // Keep only the 10 most recent debates to prevent localStorage quota issues
          updatedDebates = updatedDebates.slice(0, 10);

          return { debates: updatedDebates };
        });
      },

      updateDebate: (id: string, updates: Partial<SavedDebate>) => {
        set((state) => ({
          debates: state.debates.map(d =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date() } : d
          ),
        }));
      },

      deleteDebate: (id: string) => {
        set((state) => ({
          debates: state.debates.filter(d => d.id !== id),
          currentDebateId: state.currentDebateId === id ? null : state.currentDebateId,
        }));
      },

      getDebate: (id: string) => {
        return get().debates.find(d => d.id === id);
      },

      setCurrent: (id: string | null) => {
        set({ currentDebateId: id });
      },

      loadDebates: () => {
        // Hydration happens automatically with persist middleware
      },
    }),
    {
      name: "debate-history",
      version: 1,
    }
  )
);
