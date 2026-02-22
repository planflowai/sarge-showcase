"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";
import { providers } from "@/lib/providers";
import type { Provider } from "@/lib/types";

interface ProviderState {
  currentProvider: Provider;
  currentModel: string;
  summarizeForCloud: boolean;
  sanitizeForCloud: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setProvider: (id: Provider) => void;
  setModel: (name: string) => void;
  setSummarizeForCloud: (enabled: boolean) => void;
  setSanitizeForCloud: (enabled: boolean) => void;
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set) => ({
      currentProvider: "anthropic",
      currentModel: "claude-sonnet-4-20250514",
      summarizeForCloud: false,
      sanitizeForCloud: false,
      hydrated: false,
      hydrate: () => {
        set({ hydrated: true });
      },
      setProvider: (id: Provider) => {
        set((state) => {
          const provider = providers.find((p) => p.id === id);
          const model = provider?.models[0]?.id ?? "";
          // Preserve summarize/sanitize settings when switching providers
          return { currentProvider: id, currentModel: model };
        });
      },
      setModel: (name: string) => {
        set({ currentModel: name });
      },
      setSummarizeForCloud: (enabled: boolean) => {
        set({ summarizeForCloud: enabled });
      },
      setSanitizeForCloud: (enabled: boolean) => {
        set({ sanitizeForCloud: enabled });
      },
    }),
    {
      name: "provider",
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        currentProvider: state.currentProvider,
        currentModel: state.currentModel,
        summarizeForCloud: state.summarizeForCloud,
        sanitizeForCloud: state.sanitizeForCloud,
      }),
    }
  )
);
