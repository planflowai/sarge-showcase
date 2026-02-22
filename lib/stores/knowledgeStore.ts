"use client";

import { create } from "zustand";

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  content: string;
  tags?: string[];
  size: number;
  type?: string;
  createdAt: Date;
}

interface KnowledgeState {
  items: KnowledgeItem[];
  documents: KnowledgeDocument[];
  hydrated: boolean;
  hydrate: () => void;
  addItem: (item: KnowledgeItem) => void;
  updateItem: (id: string, updates: Partial<KnowledgeItem>) => void;
  deleteItem: (id: string) => void;
  addDocument: (name: string, content: string, tags?: string[]) => void;
  deleteDocument: (id: string) => void;
  clearAll: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  items: [],
  documents: [],
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

  addDocument: (name, content, tags) => {
    set((state) => ({
      documents: [
        ...state.documents,
        {
          id: crypto.randomUUID(),
          name,
          content,
          tags: tags || [],
          size: content.length,
          createdAt: new Date(),
        },
      ],
    }));
  },

  deleteDocument: (id) => {
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
    }));
  },

  clearAll: () => {
    set({ items: [], documents: [] });
  },
}));
