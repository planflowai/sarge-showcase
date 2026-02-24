"use client";

import { create } from "zustand";

export type SargePool = 'd1' | 'd2' | 'd3' | 'judge';
export type ModelCategory = 'general' | 'vision' | 'code' | 'image_gen' | 'video_gen' | 'audio' | 'embedding' | 'toy' | 'unknown';

export interface ModelRegistryEntry {
  id: string;
  name: string;
  provider: string;
  category: ModelCategory;
  enabled: boolean;
  excluded?: boolean;
  strength: 'weak' | 'medium' | 'strong';
  pools: SargePool[];
  sizeMB?: number;
}

export interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  tags: string[];
}

interface ModelRegistryState {
  models: ModelEntry[];
  registry: Record<string, ModelRegistryEntry>;
  hydrated: boolean;
  classifying: boolean;
  hydrate: () => void;
  addModel: (model: ModelEntry) => void;
  updateModel: (id: string, updates: Partial<ModelEntry>) => void;
  removeModel: (id: string) => void;
  registerModels: (models: ModelRegistryEntry[]) => void;
  toggleExcluded: (modelId: string, excluded?: boolean) => void;
  setPools: (modelId: string, pools: SargePool[]) => void;
  classifyWithAI: (modelIds: string[], classifierModel: string) => Promise<void>;
  getUnclassifiedModels: () => ModelRegistryEntry[];
  getModelsForPool: (pool: SargePool) => ModelRegistryEntry[];
  clearRegistry: () => void;
  clearAll: () => void;
}

export const useModelRegistryStore = create<ModelRegistryState>((set, get) => ({
  models: [],
  registry: {},
  hydrated: false,
  classifying: false,

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

  registerModels: (models) => {
    set((state) => {
      const newRegistry = { ...state.registry };
      models.forEach(m => {
        newRegistry[m.id] = m;
      });
      return { registry: newRegistry };
    });
  },

  toggleExcluded: (modelId, excluded) => {
    set((state) => {
      const entry = state.registry[modelId];
      const newExcluded = excluded !== undefined ? excluded : !entry?.excluded;
      return {
        registry: {
          ...state.registry,
          [modelId]: {
            ...entry,
            excluded: newExcluded,
          } as ModelRegistryEntry,
        },
      };
    });
  },

  setPools: (modelId, pools) => {
    set((state) => ({
      registry: {
        ...state.registry,
        [modelId]: {
          ...state.registry[modelId],
          pools,
        },
      },
    }));
  },

  classifyWithAI: async (modelIds, classifierModel) => {
    set({ classifying: true });
    try {
      // Placeholder - would call API to classify models
      set({ classifying: false });
    } catch {
      set({ classifying: false });
    }
  },

  getUnclassifiedModels: () => {
    const state = get();
    return Object.values(state.registry).filter(m => m.category === 'unknown');
  },

  getModelsForPool: (pool) => {
    const state = get();
    return Object.values(state.registry).filter(m => m.pools.includes(pool));
  },

  clearRegistry: () => {
    set({ registry: {} });
  },

  clearAll: () => {
    set({ models: [], registry: {} });
  },
}));
