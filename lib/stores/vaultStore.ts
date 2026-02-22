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
  sortBy: "name" | "date" | "size";
  sortOrder: "asc" | "desc";
  isUploading: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setSearchQuery: (query: string) => void;
  setFilterCategory: (category: FileCategory) => void;
  setSortBy: (sortBy: "name" | "date" | "size") => void;
  setSortOrder: (order: "asc" | "desc") => void;
  addItem: (item: VaultItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<VaultItem>) => void;
  deleteItem: (id: string) => void;
  getFilteredItems: () => VaultItem[];
  getItemContent: (id: string) => string | undefined;
  clearVault: () => void;
  clearAll: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  items: [],
  searchQuery: "",
  filterCategory: "all",
  sortBy: "date",
  sortOrder: "desc",
  isUploading: false,
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

  setSortBy: (sortBy) => {
    set({ sortBy });
  },

  setSortOrder: (order) => {
    set({ sortOrder: order });
  },

  addItem: (item) => {
    set((state) => ({
      items: [...state.items, item],
    }));
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
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

  getFilteredItems: () => {
    // Returns filtered items based on current search and category settings
    // This is a placeholder - actual implementation would be in a selector
    return [];
  },

  getItemContent: (id) => {
    // Returns content of a specific item by ID
    // This is a placeholder - actual implementation would use get()
    return undefined;
  },

  clearVault: () => {
    set({ items: [] });
  },

  clearAll: () => {
    set({ items: [] });
  },
}));
