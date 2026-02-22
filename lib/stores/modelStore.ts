"use client";

import { create } from "zustand";

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
}

export type EffectiveModel = Model;

interface ModelState {
  models: Model[];
  currentModel: Model | null;
  hydrated: boolean;
  hydrate: () => void;
  setModels: (models: Model[]) => void;
  setCurrentModel: (model: Model | null) => void;
  updateModel: (id: string, updates: Partial<Model>) => void;
  getEffectiveModels: (providerId?: string) => Model[];
  getDisplayName: (modelId: string, fallbackName?: string) => string;
  clearAll: () => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  currentModel: null,
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  setModels: (models) => {
    set({ models });
  },

  setCurrentModel: (model) => {
    set({ currentModel: model });
  },

  updateModel: (id, updates) => {
    set((state) => ({
      models: state.models.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  },

  getEffectiveModels: (providerId) => {
    const state = get();
    const allModels = state.models && state.models.length > 0 ? state.models : [];
    if (providerId) {
      return allModels.filter((m) => m.provider === providerId);
    }
    return allModels;
  },

  getDisplayName: (modelId, fallbackName) => {
    const state = get();
    const model = state.models.find((m) => m.id === modelId);
    return model ? model.name : (fallbackName || modelId);
  },

  clearAll: () => {
    set({
      models: [],
      currentModel: null,
    });
  },
}));
