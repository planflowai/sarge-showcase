"use client";

import { create } from "zustand";

export interface JournalEntry {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface JournalState {
  entries: JournalEntry[];
  hydrated: boolean;
  hydrate: () => void;
  addEntry: (entry: JournalEntry) => void;
  updateEntry: (id: string, content: string) => void;
  deleteEntry: (id: string) => void;
  clearAll: () => void;
}

export const useJournalStore = create<JournalState>((set) => ({
  entries: [],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addEntry: (entry) => {
    set((state) => ({
      entries: [...state.entries, entry],
    }));
  },

  updateEntry: (id, content) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, content, updatedAt: new Date() } : e
      ),
    }));
  },

  deleteEntry: (id) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }));
  },

  clearAll: () => {
    set({ entries: [] });
  },
}));
