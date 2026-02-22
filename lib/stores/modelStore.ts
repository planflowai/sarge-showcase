"use client";

import { create } from "zustand";

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  isBuiltIn?: boolean;
}

export type EffectiveModel = Model;

interface ModelState {
  models: Model[];
  currentModel: Model | null;
  nicknames: Record<string, string>;
  voicePersona: string;
  builderFlags: Record<string, boolean>;
  hydrated: boolean;
  hydrate: () => void;
  addModel: (model: Model) => void;
  removeModel: (id: string) => void;
  setModels: (models: Model[]) => void;
  setCurrentModel: (model: Model | null) => void;
  updateModel: (id: string, updates: Partial<Model>) => void;
  getEffectiveModels: (providerId?: string) => Model[];
  getDisplayName: (modelId: string, fallbackName?: string) => string;
  setNickname: (modelId: string, nickname: string) => void;
  removeNickname: (modelId: string) => void;
  setVoicePersona: (persona: string) => void;
  setBuilderFlag: (modelId: string, enabled: boolean) => void;
  isBuilderModel: (modelId: string, providerId: string) => boolean;
  clearAll: () => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  currentModel: null,
  nicknames: {},
  voicePersona: "default",
  builderFlags: {},
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addModel: (model) => {
    set((state) => ({
      models: [...state.models, model],
    }));
  },

  removeModel: (id) => {
    set((state) => ({
      models: state.models.filter((m) => m.id !== id),
    }));
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

  setNickname: (modelId, nickname) => {
    set((state) => ({
      nicknames: { ...state.nicknames, [modelId]: nickname },
    }));
  },

  removeNickname: (modelId) => {
    set((state) => {
      const newNicknames = { ...state.nicknames };
      delete newNicknames[modelId];
      return { nicknames: newNicknames };
    });
  },

  setVoicePersona: (persona) => {
    set({ voicePersona: persona });
  },

  setBuilderFlag: (modelId, enabled) => {
    set((state) => ({
      builderFlags: { ...state.builderFlags, [modelId]: enabled },
    }));
  },

  isBuilderModel: (modelId, providerId) => {
    const state = get();
    return state.builderFlags[modelId] || false;
  },

  clearAll: () => {
    set({
      models: [],
      currentModel: null,
    });
  },
}));
