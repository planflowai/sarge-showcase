import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";

interface AirGapState {
  // Air-gap mode enabled (network isolation)
  airGapEnabled: boolean;

  // Secure mode enabled (cybersecurity: input/output sanitization, threat blocking)
  secureMode: boolean;

  // Last blocked cloud attempt (for showing alert)
  lastBlockedAttempt: {
    provider: string;
    timestamp: number;
    operation: string;
  } | null;

  // Threats blocked count
  threatsBlocked: number;

  // Show the block alert modal
  showBlockAlert: boolean;

  // Actions
  enableAirGap: () => void;
  disableAirGap: () => void;
  toggleAirGap: () => void;

  // Secure mode actions
  enableSecureMode: () => void;
  disableSecureMode: () => void;
  toggleSecureMode: () => void;
  incrementThreatsBlocked: () => void;

  // Block a cloud attempt and show alert
  blockCloudAttempt: (provider: string, operation: string) => void;
  dismissBlockAlert: () => void;
}

export const useAirGapStore = create<AirGapState>()(
  persist(
    (set, get) => ({
      airGapEnabled: false,
      secureMode: false,
      lastBlockedAttempt: null,
      threatsBlocked: 0,
      showBlockAlert: false,

      enableAirGap: () => {
        set({ airGapEnabled: true });
        console.log('[SARGE] AIR-GAP MODE ACTIVATED: All cloud API calls blocked. Running fully isolated.');
      },

      disableAirGap: () => {
        set({ airGapEnabled: false });
        console.log('[SARGE] AIR-GAP MODE DISABLED: Cloud API calls allowed.');
      },

      toggleAirGap: () => {
        const current = get().airGapEnabled;
        if (current) {
          get().disableAirGap();
        } else {
          get().enableAirGap();
        }
      },

      // SECURE MODE: Cybersecurity features
      enableSecureMode: () => {
        set({ secureMode: true });
        console.log('[SARGE] 🔴 SECURE MODE ACTIVATED: Input/output sanitization, threat blocking enabled.');
      },

      disableSecureMode: () => {
        set({ secureMode: false });
        console.log('[SARGE] SECURE MODE DISABLED: Standard operation.');
      },

      toggleSecureMode: () => {
        const current = get().secureMode;
        if (current) {
          get().disableSecureMode();
        } else {
          get().enableSecureMode();
        }
      },

      incrementThreatsBlocked: () => {
        set((s) => ({ threatsBlocked: s.threatsBlocked + 1 }));
      },

      blockCloudAttempt: (provider: string, operation: string) => {
        set({
          lastBlockedAttempt: {
            provider,
            timestamp: Date.now(),
            operation,
          },
          showBlockAlert: true,
        });
        console.warn(`[SARGE] BLOCKED: Cloud access attempt to ${provider} for ${operation} - Air-gap mode active`);
      },

      dismissBlockAlert: () => {
        set({ showBlockAlert: false });
      },
    }),
    {
      name: 'sarge-airgap',
      storage: createDebouncedStorage(),
      partialize: (state) => ({ airGapEnabled: state.airGapEnabled, secureMode: state.secureMode }),
    }
  )
);

// Helper function to check if a provider is cloud-based
export function isCloudProvider(provider: string): boolean {
  const cloudProviders = [
    'openai',
    'anthropic',
    'google',
    'gemini',
    'xai',
    'grok',
    'azure',
    'cohere',
    'mistral',
    'claude',
    'gpt',
  ];
  const lower = provider.toLowerCase();
  return cloudProviders.some(cp => lower.includes(cp));
}

// Helper to check air-gap and block if needed
export function checkAirGapBlock(provider: string, operation: string): boolean {
  const store = useAirGapStore.getState();
  if (store.airGapEnabled && isCloudProvider(provider)) {
    store.blockCloudAttempt(provider, operation);
    return true; // Blocked
  }
  return false; // Allowed
}
