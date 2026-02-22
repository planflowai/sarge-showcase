/**
 * Builder Helpers Store - AI Assistants for Building
 *
 * Manages AI helpers that assist during the build process:
 * - Code Reviewer: Reviews code for bugs and best practices
 * - Quality Judge: Compares approaches and picks the best
 * - UI Designer: Suggests visual and UX improvements
 * - Devil's Advocate: Argues alternative approaches
 * - Custom: User-defined helpers with custom prompts
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";

// Helper types with user-friendly names
export type HelperType = 'reviewer' | 'judge' | 'designer' | 'debater' | 'custom';

// When the helper should run
export type TriggerMode = 'after_build' | 'on_demand' | 'continuous';

// Helper configuration
export interface BuilderHelper {
  id: string;
  type: HelperType;
  name: string;
  icon: string;
  provider: string;
  model: string;
  systemPrompt: string;
  triggerMode: TriggerMode;
  isActive: boolean;
  isPaused: boolean;
}

// Router decision tracking for transparency
export interface RouterDecision {
  tier: 1 | 2 | 3;
  model: string;
  provider: string;
  reason: string;
  taskType: string;
  timestamp: number;
}

// Helper response in chat
export interface HelperResponse {
  id: string;
  helperId: string;
  helperName: string;
  helperIcon: string;
  helperModel: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'streaming' | 'complete' | 'error';
}

interface BuilderHelpersState {
  // Helpers list
  helpers: BuilderHelper[];

  // Helper responses (shown in chat)
  responses: HelperResponse[];

  // Currently running helper
  activeHelperId: string | null;

  // Router visibility
  showRouterDecisions: boolean;
  lastRouterDecision: RouterDecision | null;

  // Hydration
  hydrated: boolean;
}

interface BuilderHelpersActions {
  // Hydration
  hydrate: () => void;

  // Helper management
  addHelper: (helper: Omit<BuilderHelper, 'id'>) => void;
  removeHelper: (id: string) => void;
  updateHelper: (id: string, updates: Partial<BuilderHelper>) => void;
  toggleHelperPause: (id: string) => void;

  // Helper execution
  setActiveHelper: (id: string | null) => void;
  addResponse: (response: Omit<HelperResponse, 'id' | 'timestamp'>) => string;
  updateResponse: (id: string, updates: Partial<HelperResponse>) => void;
  clearResponses: () => void;

  // Router
  setShowRouterDecisions: (show: boolean) => void;
  setLastRouterDecision: (decision: RouterDecision | null) => void;

  // Get helpers by trigger mode
  getActiveHelpers: (triggerMode?: TriggerMode) => BuilderHelper[];
}

type BuilderHelpersStore = BuilderHelpersState & BuilderHelpersActions;

// Default helpers that come pre-configured
const DEFAULT_HELPERS: BuilderHelper[] = [];

export const useBuilderHelpersStore = create<BuilderHelpersStore>()(
  persist(
    (set, get) => ({
      // Initial state
      helpers: DEFAULT_HELPERS,
      responses: [],
      activeHelperId: null,
      showRouterDecisions: true,
      lastRouterDecision: null,
      hydrated: false,

      // Hydration
      hydrate: () => {
        set({ hydrated: true });
      },

      // Helper management
      addHelper: (helper) => {
        const newHelper: BuilderHelper = {
          ...helper,
          id: crypto.randomUUID(),
        };
        set((state) => ({
          helpers: [...state.helpers, newHelper],
        }));
        console.log('[BuilderHelpers] Added helper:', newHelper.name);
      },

      removeHelper: (id) => {
        set((state) => ({
          helpers: state.helpers.filter((h) => h.id !== id),
          responses: state.responses.filter((r) => r.helperId !== id),
        }));
        console.log('[BuilderHelpers] Removed helper:', id);
      },

      updateHelper: (id, updates) => {
        set((state) => ({
          helpers: state.helpers.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        }));
      },

      toggleHelperPause: (id) => {
        set((state) => ({
          helpers: state.helpers.map((h) =>
            h.id === id ? { ...h, isPaused: !h.isPaused } : h
          ),
        }));
      },

      // Helper execution
      setActiveHelper: (id) => {
        set({ activeHelperId: id });
      },

      addResponse: (response): string => {
        const newResponse: HelperResponse = {
          ...response,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        };
        set((state) => ({
          responses: [...state.responses, newResponse],
        }));
        return newResponse.id;
      },

      updateResponse: (id, updates) => {
        set((state) => ({
          responses: state.responses.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      clearResponses: () => {
        set({ responses: [] });
      },

      // Router
      setShowRouterDecisions: (show) => {
        set({ showRouterDecisions: show });
      },

      setLastRouterDecision: (decision) => {
        set({ lastRouterDecision: decision });
      },

      // Get active helpers filtered by trigger mode
      getActiveHelpers: (triggerMode) => {
        const { helpers } = get();
        return helpers.filter((h) => {
          if (!h.isActive || h.isPaused) return false;
          if (triggerMode && h.triggerMode !== triggerMode) return false;
          return true;
        });
      },
    }),
    {
      name: 'builder-helpers',
      version: 1,
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        helpers: state.helpers,
        showRouterDecisions: state.showRouterDecisions,
        // Don't persist responses or active helper (transient)
      }),
    }
  )
);

// Helper type metadata for UI
export const HELPER_TYPES: Record<HelperType, {
  name: string;
  icon: string;
  description: string;
  color: string;
}> = {
  reviewer: {
    name: 'Code Reviewer',
    icon: '👀',
    description: 'Reviews your code for bugs, security issues, and best practices',
    color: 'emerald',
  },
  judge: {
    name: 'Quality Judge',
    icon: '⚖️',
    description: 'Compares different approaches and helps pick the best one',
    color: 'purple',
  },
  designer: {
    name: 'UI Designer',
    icon: '🎨',
    description: 'Suggests visual improvements and better UX patterns',
    color: 'pink',
  },
  debater: {
    name: "Devil's Advocate",
    icon: '💬',
    description: 'Argues alternative approaches to challenge your thinking',
    color: 'orange',
  },
  custom: {
    name: 'Custom Helper',
    icon: '✨',
    description: 'Create your own helper with a custom prompt',
    color: 'blue',
  },
};

// Trigger mode labels
export const TRIGGER_MODE_LABELS: Record<TriggerMode, {
  label: string;
  description: string;
}> = {
  after_build: {
    label: 'After each build',
    description: 'Runs automatically after the Builder generates code',
  },
  on_demand: {
    label: 'Only when I ask',
    description: 'Only runs when you click the "Run" button',
  },
  continuous: {
    label: 'Continuously',
    description: 'Monitors every change and provides real-time feedback',
  },
};
