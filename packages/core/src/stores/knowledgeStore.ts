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
  error: string | null;
  activeDocumentIds: string[];
  hydrate: () => void;
  addItem: (item: KnowledgeItem) => void;
  updateItem: (id: string, updates: Partial<KnowledgeItem>) => void;
  deleteItem: (id: string) => void;
  addDocument: (name: string, content: string, tags?: string[]) => void;
  addFromFiles: (files: FileList | File[]) => Promise<void>;
  removeDocument: (id: string) => void;
  deleteDocument: (id: string) => void;
  getActiveDocuments: () => KnowledgeDocument[];
  setActiveDocuments: (ids: string[]) => void;
  clearError: () => void;
  clearAll: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  items: [],
  documents: [],
  hydrated: false,
  error: null,
  activeDocumentIds: [],

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

  addFromFiles: async (files: FileList | File[]) => {
    try {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        const content = await file.text();
        const id = crypto.randomUUID();
        set((state) => ({
          documents: [
            ...state.documents,
            {
              id,
              name: file.name,
              content,
              size: file.size,
              type: file.type,
              createdAt: new Date(),
            },
          ],
        }));
      }
      set({ error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load files' });
    }
  },

  removeDocument: (id: string) => {
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      activeDocumentIds: state.activeDocumentIds.filter(aid => aid !== id),
    }));
  },

  deleteDocument: (id) => {
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      activeDocumentIds: state.activeDocumentIds.filter(aid => aid !== id),
    }));
  },

  getActiveDocuments: () => {
    const state = get();
    return state.documents.filter(d => state.activeDocumentIds.includes(d.id));
  },

  setActiveDocuments: (ids: string[]) => {
    set({ activeDocumentIds: ids });
  },

  clearError: () => {
    set({ error: null });
  },

  clearAll: () => {
    set({ items: [], documents: [], activeDocumentIds: [], error: null });
  },
}));
