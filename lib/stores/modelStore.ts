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
  hydrated: boolean;
  nicknames: Record<string, string>;
  voicePersona: string;
  builderFlags: Record<string, boolean>;
  hydrate: () => void;
  setModels: (models: Model[]) => void;
  setCurrentModel: (model: Model | null) => void;
  updateModel: (id: string, updates: Partial<Model>) => void;
  addModel: (providerId: string, modelId: string, modelName: string) => void;
  removeModel: (providerId: string, modelId: string) => void;
  getEffectiveModels: (providerId?: string) => Model[];
  getDisplayName: (modelId: string, fallbackName?: string) => string;
  getBuilderModels: () => Model[];
  setNickname: (modelId: string, nickname: string) => void;
  removeNickname: (modelId: string) => void;
  setVoicePersona: (persona: string) => void;
  setBuilderFlag: (modelId: string, isBuilder: boolean, providerId?: string) => void;
  isBuilderModel: (modelId: string, providerId?: string) => boolean;
  removeModel: (providerId: string, modelId: string) => void;
  clearAll: () => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  currentModel: null,
  hydrated: false,
  nicknames: {},
  voicePersona: "none",
  builderFlags: {},

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

  addModel: (providerId, modelId, modelName) => {
    set((state) => ({
      models: [
        ...state.models,
        {
          id: modelId,
          name: modelName,
          provider: providerId,
          contextWindow: 4096,
        },
      ],
    }));
  },

  removeModel: (providerId, modelId) => {
    set((state) => ({
      models: state.models.filter((m) => m.id !== modelId),
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

  getBuilderModels: () => {
    const state = get();
    return state.models.filter((m) => state.builderFlags[m.id]);
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

  setBuilderFlag: (modelId, isBuilder, providerId) => {
    set((state) => ({
      builderFlags: { ...state.builderFlags, [modelId]: isBuilder },
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
      nicknames: {},
      voicePersona: "none",
      builderFlags: {},
    });
  },
}));
