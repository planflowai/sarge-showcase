"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { providers } from "../lib/providers";

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

export type ModelRole = "Builder" | "Trials" | "Chat" | "Image" | "Guardian" | "Code";
export const ALL_MODEL_ROLES: ModelRole[] = ["Builder", "Trials", "Chat", "Image", "Guardian", "Code"];

interface ModelState {
  models: Model[];
  currentModel: Model | null;
  hydrated: boolean;
  nicknames: Record<string, string>;
  voicePersona: string;
  builderFlags: Record<string, boolean>;
  modelRoles: Record<string, ModelRole[]>;
  hydrate: () => void;
  setModels: (models: Model[]) => void;
  setCurrentModel: (model: Model | null) => void;
  updateModel: (id: string, updates: Partial<Model>) => void;
  addModel: (providerId: string, modelId: string, modelName: string) => void;
  removeModel: (providerId: string, modelId: string) => void;
  getEffectiveModels: (providerId?: string) => Model[];
  getDisplayName: (modelId: string, fallbackName?: string) => string;
  getBuilderModels: () => Model[];
  getModelsByRole: (role: ModelRole) => Model[];
  hasModelRole: (modelId: string, role: ModelRole) => boolean;
  setModelRole: (modelId: string, role: ModelRole, enabled: boolean) => void;
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

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      models: getInitialModels(),
      currentModel: null,
      hydrated: false,
      nicknames: {},
      voicePersona: "none",
      builderFlags: {},
      modelRoles: {},

      hydrate: () => {
        // Auto-tag cloud models as builders if they don't have a flag yet
        const state = get();
        const newFlags: Record<string, boolean> = { ...state.builderFlags };
        let changed = false;
        state.models.forEach(m => {
          if (m.provider !== 'ollama' && m.provider !== 'lmstudio' && newFlags[m.id] === undefined) {
            newFlags[m.id] = true;
            changed = true;
          }
        });
        if (changed) {
          set({ builderFlags: newFlags });
        }

        // Auto-tag model roles if not set yet
        const roles: Record<string, ModelRole[]> = { ...state.modelRoles };
        let rolesChanged = false;
        state.models.forEach(m => {
          if (!roles[m.id]) {
            rolesChanged = true;
            if (m.provider === 'ollama' || m.provider === 'lmstudio') {
              roles[m.id] = ["Builder", "Trials"];
            } else {
              roles[m.id] = ["Builder", "Trials", "Chat"];
            }
          }
        });
        if (rolesChanged) {
          set({ modelRoles: roles });
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
                  const flags = { ...state.builderFlags };
                  newModels.forEach((m: any) => {
                    if (m.provider === 'ollama') {
                      flags[m.id] = true;
                    }
                  });
                  return {
                    models: [...state.models, ...newModels],
                    builderFlags: flags,
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
        if (existing) return; // Already exists

        // Known built-in providers — verify via ping
        const builtInProviders = ['ollama', 'lmstudio', 'anthropic', 'openai', 'google', 'xai', 'deepseek'];
        const isBuiltIn = builtInProviders.includes(providerId);

        set((state) => ({
          models: [
            ...state.models,
            {
              id: modelId,
              name: modelName,
              provider: providerId,
              contextWindow: 4096,
              // Custom providers start as "active" (can't verify without base URL context)
              status: isBuiltIn ? "unchecked" as const : "active" as const,
            },
          ],
          // Auto-tag new cloud models as builders
          builderFlags: {
            ...state.builderFlags,
            [modelId]: providerId !== 'ollama' && providerId !== 'lmstudio',
          },
          // Auto-tag roles
          modelRoles: {
            ...state.modelRoles,
            [modelId]: providerId !== 'ollama' && providerId !== 'lmstudio'
              ? ["Builder", "Trials", "Chat"] as ModelRole[]
              : ["Builder", "Trials"] as ModelRole[],
          },
        }));

        // Only verify built-in providers (custom providers need base URL which isn't available here)
        if (isBuiltIn) {
          verifyModelPing(modelId, providerId).then(ok => {
            set((state) => ({
              models: state.models.map(m =>
                m.id === modelId && m.provider === providerId
                  ? { ...m, status: ok ? "active" as const : "error" as const }
                  : m
              ),
            }));
            if (ok) {
              console.log(`[modelStore] Model verified: ${modelId}`);
            } else {
              console.warn(`[modelStore] Model failed verification: ${modelId}`);
            }
          });
        }
      },

      removeModel: (providerId, modelId) => {
        set((state) => ({
          models: state.models.filter((m) => !(m.id === modelId && m.provider === providerId)),
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

      getModelsByRole: (role) => {
        const state = get();
        return state.models.filter((m) => {
          const roles = state.modelRoles[m.id];
          return roles ? roles.includes(role) : false;
        });
      },

      hasModelRole: (modelId, role) => {
        const state = get();
        const roles = state.modelRoles[modelId];
        return roles ? roles.includes(role) : false;
      },

      setModelRole: (modelId, role, enabled) => {
        set((state) => {
          const current = state.modelRoles[modelId] || [];
          let updated: ModelRole[];
          if (enabled && !current.includes(role)) {
            updated = [...current, role];
          } else if (!enabled && current.includes(role)) {
            updated = current.filter(r => r !== role);
          } else {
            return state; // no change
          }
          // Keep builderFlags in sync
          const builderFlags = { ...state.builderFlags };
          if (role === "Builder") {
            builderFlags[modelId] = enabled;
          }
          return {
            modelRoles: { ...state.modelRoles, [modelId]: updated },
            builderFlags,
          };
        });
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
        // Mark as unchecked while verifying
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
        // Mark all cloud models as unchecked
        set((s) => ({
          models: s.models.map(m =>
            m.provider !== "ollama" && m.provider !== "lmstudio"
              ? { ...m, status: "unchecked" as const }
              : m
          ),
        }));
        // Verify in parallel (max 3 concurrent)
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
          models: getInitialModels(),
          currentModel: null,
          nicknames: {},
          voicePersona: "none",
          builderFlags: {},
          modelRoles: {},
        });
      },
    }),
    {
      name: "model-store",
      partialize: (state) => ({
        // Only persist custom (non-built-in) models, flags, nicknames
        models: state.models.filter(m => !m.isBuiltIn),
        builderFlags: state.builderFlags,
        modelRoles: state.modelRoles,
        nicknames: state.nicknames,
        voicePersona: state.voicePersona,
      }),
      merge: (persisted: any, current) => {
        const customModels: Model[] = persisted?.models || [];
        // Merge built-in models with persisted custom models (no duplicates)
        const builtInIds = new Set(current.models.map(m => m.id));
        const merged = [
          ...current.models,
          ...customModels.filter(m => !builtInIds.has(m.id)),
        ];
        return {
          ...current,
          models: merged,
          builderFlags: { ...current.builderFlags, ...(persisted?.builderFlags || {}) },
          modelRoles: { ...current.modelRoles, ...(persisted?.modelRoles || {}) },
          nicknames: { ...current.nicknames, ...(persisted?.nicknames || {}) },
          voicePersona: persisted?.voicePersona || current.voicePersona,
        };
      },
    }
  )
);

/** Quick check if a model responds. Returns true if the provider accepts it. */
async function verifyModelPing(modelId: string, provider: string, customBaseUrl?: string, customEnvKey?: string): Promise<boolean> {
  try {
    const body: Record<string, string> = {
      model: modelId,
      provider,
      prompt: "Hi",
      systemPrompt: "Reply with OK",
      source: provider === "ollama" || provider === "lmstudio" ? "local" : "cloud",
    };
    if (customBaseUrl) body.customBaseUrl = customBaseUrl;
    if (customEnvKey) body.customEnvKey = customEnvKey;

    const res = await fetch("/api/test/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    // Read just enough to confirm it streams
    const reader = res.body?.getReader();
    if (!reader) return false;
    const { done, value } = await reader.read();
    reader.cancel();
    return !done && value && value.length > 0;
  } catch {
    return false;
  }
}
