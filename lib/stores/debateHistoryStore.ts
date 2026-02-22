"use client";

import { create } from "zustand";

export interface DebateRecord {
  id: string;
  title: string;
  topic: string;
  createdAt: Date;
}

interface DebateHistoryState {
  records: DebateRecord[];
  hydrated: boolean;
  hydrate: () => void;
  addRecord: (record: DebateRecord) => void;
  deleteRecord: (id: string) => void;
  clearAll: () => void;
}

export const useDebateHistoryStore = create<DebateHistoryState>((set) => ({
  records: [],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addRecord: (record) => {
    set((state) => ({
      records: [...state.records, record],
    }));
  },

  deleteRecord: (id) => {
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
    }));
  },

  clearAll: () => {
    set({ records: [] });
  },
}));
