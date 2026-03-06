"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { syncModelRegistry } from "../lib/supabase/forgeSync";

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
  lastScanTimestamp: number | null;
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

export const useModelRegistryStore = create<ModelRegistryState>()(
  persist(
    (set, get) => ({
      models: [],
      registry: {},
      hydrated: false,
      classifying: false,
      lastScanTimestamp: null,

      hydrate: () => {
        set({ hydrated: true });
      },

      addModel: (model) => {
        set((state) => ({
          models: [...state.models, model],
        }));
      },

      updateModel: (id, updates) => {
        set((state) => {
          const updated = state.models.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          );
          // Sync to Supabase when tags change — fire and forget
          if (updates.tags) {
            const model = updated.find((m) => m.id === id);
            if (model) {
              syncModelRegistry({
                model_id: model.id,
                name: model.name,
                provider: model.provider,
                tags: model.tags,
                enabled: model.enabled,
              }).catch(() => {});
            }
          }
          return { models: updated };
        });
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
          return { registry: newRegistry, lastScanTimestamp: Date.now() };
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

      classifyWithAI: async (modelIds, _classifierModel) => {
        set({ classifying: true });
        try {
          const res = await fetch('/api/models/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelIds }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Classification failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          const classifications = data.classifications || {};
          set((state) => {
            const updated = { ...state.registry };
            for (const [id, info] of Object.entries(classifications) as [string, { category?: string; strength?: string }][]) {
              if (updated[id]) {
                updated[id] = {
                  ...updated[id],
                  category: (info.category as any) || updated[id].category,
                  strength: (info.strength as any) || updated[id].strength,
                };
              }
            }
            return { registry: updated, classifying: false };
          });
        } catch (e) {
          set({ classifying: false });
          throw e;
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
        set({ registry: {}, lastScanTimestamp: null });
      },

      clearAll: () => {
        set({ models: [], registry: {}, lastScanTimestamp: null });
      },
    }),
    {
      name: "sarge-model-registry",
      partialize: (state) => ({
        models: state.models,
        registry: state.registry,
        lastScanTimestamp: state.lastScanTimestamp,
      }),
    }
  )
);
