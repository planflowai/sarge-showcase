"use client";

import { create } from "zustand";

export interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  tags: string[];
}

interface ModelRegistryState {
  models: ModelEntry[];
  hydrated: boolean;
  hydrate: () => void;
  addModel: (model: ModelEntry) => void;
  updateModel: (id: string, updates: Partial<ModelEntry>) => void;
  removeModel: (id: string) => void;
  clearAll: () => void;
}

export const useModelRegistryStore = create<ModelRegistryState>((set) => ({
  models: [],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addModel: (model) => {
    set((state) => ({
      models: [...state.models, model],
    }));
  },

  updateModel: (id, updates) => {
    set((state) => ({
      models: state.models.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  },

  removeModel: (id) => {
    set((state) => ({
      models: state.models.filter((m) => m.id !== id),
    }));
  },

  clearAll: () => {
    set({ models: [] });
  },
}));
