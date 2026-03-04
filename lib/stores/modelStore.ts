"use client";

import { create } from "zustand";
import { providers } from "@/lib/providers";

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  isBuiltIn?: boolean;
  status?: "active" | "error" | "unchecked";
}

export type EffectiveModel = Model;

export type VoicePersona = "default" | "friendly" | "professional" | "casual" | "formal" | "none" | "jarvis" | "friday";

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
  verifyModel: (modelId: string, provider: string) => Promise<void>;
  verifyAllCloudModels: () => Promise<void>;
  clearAll: () => void;
}

// Build initial models from provider registry
const getInitialModels = (): Model[] => {
  const models: Model[] = [];
  providers.forEach(provider => {
    if (provider.models && provider.models.length > 0) {
      provider.models.forEach(m => {
        models.push({
          id: m.id,
          name: m.name,
          provider: provider.id,
          contextWindow: m.contextWindow,
          isBuiltIn: true,
        });
      });
    }
  });
  return models;
};

export const useModelStore = create<ModelState>((set, get) => ({
  models: getInitialModels(),
  currentModel: null,
  hydrated: false,
  nicknames: {},
  voicePersona: "none",
  builderFlags: {},

  hydrate: () => {
    // Auto-tag all cloud models as builders — always ensure new models are tagged
    const state = get();
    const newFlags: Record<string, boolean> = { ...state.builderFlags };
    let changed = false;
    state.models.forEach(m => {
      if (m.provider !== 'ollama' && m.provider !== 'lmstudio' && newFlags[m.id] === undefined) {
        newFlags[m.id] = true;
        changed = true;
      }
    });
    if (changed || Object.keys(state.builderFlags).length === 0) {
      set({ builderFlags: newFlags });
    }

    // Start async scan but don't block on it
    set({ hydrated: true });

    // Fetch Ollama models in the background
    fetch('/api/models/scan')
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to fetch models');
      })
      .then(data => {
        if (data.models && Array.isArray(data.models)) {
          // Merge scan results with existing models
          const existingIds = new Set(get().models.map(m => m.id));
          const newModels = data.models.filter((m: any) => !existingIds.has(m.id));
          if (newModels.length > 0) {
            set((state) => {
              // Auto-tag newly added Ollama models as builders
              const newFlags = { ...state.builderFlags };
              newModels.forEach((m: any) => {
                if (m.provider === 'ollama') {
                  newFlags[m.id] = true;
                }
              });
              return {
                models: [...state.models, ...newModels],
                builderFlags: newFlags,
              };
            });
            console.log('[modelStore] Loaded', newModels.length, 'models from API scan');
          }
        }
      })
      .catch(err => {
        console.warn('[modelStore] Failed to scan models, using hardcoded defaults:', err);
      });
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
    const existing = get().models.find(m => m.id === modelId && m.provider === providerId);
    if (existing) return;

    set((state) => ({
      models: [
        ...state.models,
        {
          id: modelId,
          name: modelName,
          provider: providerId,
          contextWindow: 4096,
          status: "unchecked" as const,
        },
      ],
      builderFlags: {
        ...state.builderFlags,
        [modelId]: providerId !== 'ollama' && providerId !== 'lmstudio',
      },
    }));

    // Verify the model works — fire and forget
    verifyModelPing(modelId, providerId).then(ok => {
      set((state) => ({
        models: state.models.map(m =>
          m.id === modelId && m.provider === providerId
            ? { ...m, status: ok ? "active" as const : "error" as const }
            : m
        ),
      }));
    });
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

  verifyModel: async (modelId, provider) => {
    set((state) => ({
      models: state.models.map(m =>
        m.id === modelId && m.provider === provider
          ? { ...m, status: "unchecked" as const }
          : m
      ),
    }));
    const ok = await verifyModelPing(modelId, provider);
    set((state) => ({
      models: state.models.map(m =>
        m.id === modelId && m.provider === provider
          ? { ...m, status: ok ? "active" as const : "error" as const }
          : m
      ),
    }));
  },

  verifyAllCloudModels: async () => {
    const state = get();
    const cloudModels = state.models.filter(
      m => m.provider !== "ollama" && m.provider !== "lmstudio"
    );
    set((s) => ({
      models: s.models.map(m =>
        m.provider !== "ollama" && m.provider !== "lmstudio"
          ? { ...m, status: "unchecked" as const }
          : m
      ),
    }));
    const queue = [...cloudModels];
    const runBatch = async () => {
      while (queue.length > 0) {
        const model = queue.shift()!;
        const ok = await verifyModelPing(model.id, model.provider);
        set((s) => ({
          models: s.models.map(m =>
            m.id === model.id && m.provider === model.provider
              ? { ...m, status: ok ? "active" as const : "error" as const }
              : m
          ),
        }));
      }
    };
    await Promise.all([runBatch(), runBatch(), runBatch()]);
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

/** Quick check if a model responds. Returns true if the provider accepts it. */
async function verifyModelPing(modelId: string, provider: string): Promise<boolean> {
  try {
    const res = await fetch("/api/test/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        provider,
        prompt: "Hi",
        systemPrompt: "Reply with OK",
        source: provider === "ollama" || provider === "lmstudio" ? "local" : "cloud",
      }),
    });
    if (!res.ok) return false;
    const reader = res.body?.getReader();
    if (!reader) return false;
    const { done, value } = await reader.read();
    reader.cancel();
    return !done && value && value.length > 0;
  } catch {
    return false;
  }
}
