"use client";

import { create } from "zustand";

export type FileCategory = 'all' | 'image' | 'document' | 'spreadsheet' | 'text' | 'code' | 'archive' | 'other';

export interface VaultItem {
  id: string;
  name: string;
  data: string;
  category: FileCategory;
  createdAt: Date;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

interface VaultState {
  items: VaultItem[];
  searchQuery: string;
  filterCategory: FileCategory;
  hydrated: boolean;
  hydrate: () => void;
  setSearchQuery: (query: string) => void;
  setFilterCategory: (category: FileCategory) => void;
  addItem: (item: VaultItem) => void;
  updateItem: (id: string, updates: Partial<VaultItem>) => void;
  deleteItem: (id: string) => void;
  clearAll: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  items: [],
  searchQuery: "",
  filterCategory: "all",
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setFilterCategory: (category) => {
    set({ filterCategory: category });
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
