"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CustomProviderModel {
  id: string;
  name: string;
}

export interface CustomProvider {
  id: string;          // e.g. "mistral"
  name: string;        // e.g. "Mistral"
  baseUrl: string;     // e.g. "https://api.mistral.ai/v1"
  envKeyName: string;  // e.g. "MISTRAL_API_KEY"
  color: string;       // hex color for UI dot
  models: CustomProviderModel[];
}

/** Well-known OpenAI-compatible providers with pre-filled config */
export const KNOWN_PROVIDERS: Omit<CustomProvider, "models">[] = [
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    envKeyName: "MISTRAL_API_KEY",
    color: "#FF7000",
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    baseUrl: "https://router.huggingface.co/v1",
    envKeyName: "HUGGINGFACE_API_KEY",
    color: "#FFD21E",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    envKeyName: "PERPLEXITY_API_KEY",
    color: "#20B2AA",
  },
  {
    id: "together",
    name: "Together",
    baseUrl: "https://api.together.xyz/v1",
    envKeyName: "TOGETHER_API_KEY",
    color: "#6366F1",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKeyName: "GROQ_API_KEY",
    color: "#F55036",
  },
];

/** Default models to pre-populate when adding a known provider */
export const DEFAULT_MODELS: Record<string, CustomProviderModel[]> = {
  mistral: [
    { id: "devstral-2512", name: "Devstral 2" },
    { id: "devstral-small-2512", name: "Devstral Small 2" },
    { id: "mistral-medium-3", name: "Mistral Medium 3" },
  ],
  huggingface: [
    { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B" },
    { id: "Qwen/Qwen3-235B-A22B", name: "Qwen 3 235B" },
    { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" },
  ],
};

interface CustomProviderState {
  providers: CustomProvider[];
  addProvider: (provider: CustomProvider) => void;
  removeProvider: (id: string) => void;
  updateProvider: (id: string, updates: Partial<Omit<CustomProvider, "id">>) => void;
  addModelToProvider: (providerId: string, model: CustomProviderModel) => void;
  removeModelFromProvider: (providerId: string, modelId: string) => void;
  getProvider: (id: string) => CustomProvider | undefined;
}

export const useCustomProviderStore = create<CustomProviderState>()(
  persist(
    (set, get) => ({
      providers: [],

      addProvider: (provider) => {
        const existing = get().providers.find((p) => p.id === provider.id);
        if (existing) return;
        set((state) => ({ providers: [...state.providers, provider] }));
      },

      removeProvider: (id) => {
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== id),
        }));
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      addModelToProvider: (providerId, model) => {
        set((state) => ({
          providers: state.providers.map((p) => {
            if (p.id !== providerId) return p;
            if (p.models.some((m) => m.id === model.id)) return p;
            return { ...p, models: [...p.models, model] };
          }),
        }));
      },

      removeModelFromProvider: (providerId, modelId) => {
        set((state) => ({
          providers: state.providers.map((p) => {
            if (p.id !== providerId) return p;
            return { ...p, models: p.models.filter((m) => m.id !== modelId) };
          }),
        }));
      },

      getProvider: (id) => get().providers.find((p) => p.id === id),
    }),
    {
      name: "custom-provider-store",
    }
  )
);
