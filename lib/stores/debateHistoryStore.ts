"use client";

import { create } from "zustand";

export interface DebateRecord {
  id: string;
  title: string;
  topic: string;
  participants: Array<{ provider: string; model?: string }>;
  rounds: number;
  messages: any[];
  critiques: any[];
  roundSummaries: any[];
  judge: { provider: string; model?: string };
  agreements: string[];
  createdAt: Date;
}

interface DebateHistoryState {
  records: DebateRecord[];
  debates: DebateRecord[];
  hydrated: boolean;
  hydrate: () => void;
  addRecord: (record: DebateRecord) => void;
  deleteRecord: (id: string) => void;
  loadDebates: () => Promise<void>;
  deleteDebate: (id: string) => void;
  loadDebateById: (id: string) => DebateRecord | undefined;
  clearAll: () => void;
}

export const useDebateHistoryStore = create<DebateHistoryState>((set, get) => ({
  records: [],
  debates: [],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addRecord: (record) => {
    set((state) => ({
      records: [...state.records, record],
      debates: [...state.records, record],
    }));
  },

  deleteRecord: (id) => {
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
      debates: state.records.filter((r) => r.id !== id),
    }));
  },

  loadDebates: async () => {
    // Placeholder for loading debates
    set({ hydrated: true });
  },

  deleteDebate: (id) => {
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
      debates: state.debates.filter((d) => d.id !== id),
    }));
  },

  loadDebateById: (id) => {
    const state = get();
    return state.debates.find((d) => d.id === id);
  },

  clearAll: () => {
    set({ records: [], debates: [] });
  },
}));
