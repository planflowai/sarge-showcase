"use client";

import { create } from "zustand";

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
}

interface KnowledgeState {
  items: KnowledgeItem[];
  hydrated: boolean;
  hydrate: () => void;
  addItem: (item: KnowledgeItem) => void;
  updateItem: (id: string, updates: Partial<KnowledgeItem>) => void;
  deleteItem: (id: string) => void;
  clearAll: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  items: [],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addItem: (item) => {
    set((state) => ({
      items: [...state.items, item],
    }));
  },

  updateItem: (id, updates) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, ...updates } : i
      ),
    }));
  },

  deleteItem: (id) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }));
  },

  clearAll: () => {
    set({ items: [] });
  },
}));
