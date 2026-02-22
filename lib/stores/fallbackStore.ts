/**
 * Fallback Configuration Store
 *
 * Zustand store for user configuration of fallback behavior with localStorage persistence.
 * Allows customization of fallback chains, retry strategies, and circuit breaker settings.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";
import { DEFAULT_FALLBACK_CONFIG, DEFAULT_FALLBACK_CHAINS } from '@/lib/fallback/config';
import type { FallbackConfig, FallbackChain } from '@/lib/fallback/config';
import type { Provider } from '@/lib/types';

interface FallbackState {
  // Configuration
  config: FallbackConfig;
  enabled: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
  updateConfig: (updates: Partial<FallbackConfig>) => void;
  setModelChain: (model: string, chain: FallbackChain) => void;
  removeModelChain: (model: string) => void;
  resetToDefaults: () => void;

  // Circuit breaker controls
  setCircuitBreakerEnabled: (enabled: boolean) => void;
  setFailureThreshold: (threshold: number) => void;
  setResetTimeout: (timeoutMs: number) => void;

  // Retry controls
  setMaxRetries: (maxRetries: number) => void;
  setRetryDelayMs: (delayMs: number) => void;
  setMaxFallbackDepth: (depth: number) => void;

  // Query methods
  getFallbackChain: (model: string, provider: Provider) => FallbackChain | null;
  isEnabled: () => boolean;
}

export const useFallbackStore = create<FallbackState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_FALLBACK_CONFIG,
      enabled: true,

      setEnabled: (enabled) => {
        set({ enabled });
      },

      updateConfig: (updates) => {
        set((state) => ({
          config: { ...state.config, ...updates }
        }));
      },

      setModelChain: (model, chain) => {
        set((state) => ({
          config: {
            ...state.config,
            modelChains: {
              ...state.config.modelChains,
              [model]: chain
            }
          }
        }));
      },

      removeModelChain: (model) => {
        set((state) => {
          const newChains = { ...state.config.modelChains };
          delete newChains[model];
          return {
            config: {
              ...state.config,
              modelChains: newChains
            }
          };
        });
      },

      resetToDefaults: () => {
        set({
          config: DEFAULT_FALLBACK_CONFIG,
          enabled: true
        });
      },

      setCircuitBreakerEnabled: (enabled) => {
        set((state) => ({
          config: {
            ...state.config,
            circuitBreaker: {
              ...state.config.circuitBreaker,
              enabled
            }
          }
        }));
      },

      setFailureThreshold: (threshold) => {
        set((state) => ({
          config: {
            ...state.config,
            circuitBreaker: {
              ...state.config.circuitBreaker,
              failureThreshold: threshold
            }
          }
        }));
      },

      setResetTimeout: (timeoutMs) => {
        set((state) => ({
          config: {
            ...state.config,
            circuitBreaker: {
              ...state.config.circuitBreaker,
              resetTimeoutMs: timeoutMs
            }
          }
        }));
      },

      setMaxRetries: (maxRetries) => {
        set((state) => ({
          config: {
            ...state.config,
            maxRetries
          }
        }));
      },

      setRetryDelayMs: (delayMs) => {
        set((state) => ({
          config: {
            ...state.config,
            retryDelayMs: delayMs
          }
        }));
      },

      setMaxFallbackDepth: (depth) => {
        set((state) => ({
          config: {
            ...state.config,
            maxFallbackDepth: depth
          }
        }));
      },

      getFallbackChain: (model, provider) => {
        const state = get();
        const chains = state.config.modelChains;

        // Exact match first
        if (chains[model]) {
          return chains[model];
        }

        // Ollama wildcard match
        if (provider === 'ollama' && chains['ollama:*']) {
          const chain = chains['ollama:*'];
          return {
            ...chain,
            primary: { ...chain.primary, model }
          };
        }

        return null;
      },

      isEnabled: () => get().enabled
    }),
    {
      name: 'sarge-fallback-config',
      version: 1
    }
  )
);
