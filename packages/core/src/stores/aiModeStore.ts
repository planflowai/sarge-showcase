"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";

/**
 * AI Mode Configuration Store
 *
 * Controls how AI agents are orchestrated across the app:
 * - Single agent (default)
 * - Multi-agent with sequential or parallel execution
 * - Judge mode for quality control
 * - Fallback chains for reliability
 */

export type ExecutionMode = "local" | "cloud" | "hybrid";
export type FlowType = "sequential" | "parallel";

export interface AgentConfig {
  id: string;
  name: string;
  role: "primary" | "secondary" | "critic" | "synthesizer" | "judge";
  provider: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  enabled: boolean;
}

export interface JudgeConfig {
  enabled: boolean;
  provider: string;
  model: string;
  criteria: string[];
  autoSelect: boolean; // Auto-select best response
}

export interface AIModePreset {
  id: string;
  name: string;
  description: string;
  executionMode: ExecutionMode;
  agentCount: 1 | 2 | 3 | 4;
  agents: AgentConfig[];
  flowType: FlowType;
  hasJudge: boolean;
  judgeConfig?: JudgeConfig;
  fallbackEnabled: boolean;
  fallbackChain: string[];
}

// Default presets
const DEFAULT_PRESETS: AIModePreset[] = [
  {
    id: "single-local",
    name: "Single Local",
    description: "One local model, fast and free",
    executionMode: "local",
    agentCount: 1,
    agents: [
      {
        id: "primary-local",
        name: "Local Model",
        role: "primary",
        provider: "ollama",
        model: "qwen2.5-coder:7b",
        enabled: true,
      },
    ],
    flowType: "sequential",
    hasJudge: false,
    fallbackEnabled: false,
    fallbackChain: [],
  },
  {
    id: "single-cloud",
    name: "Single Cloud",
    description: "One cloud model for complex tasks",
    executionMode: "cloud",
    agentCount: 1,
    agents: [
      {
        id: "primary-cloud",
        name: "Cloud Model",
        role: "primary",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        enabled: true,
      },
    ],
    flowType: "sequential",
    hasJudge: false,
    fallbackEnabled: false,
    fallbackChain: [],
  },
  {
    id: "hybrid-fallback",
    name: "Hybrid with Fallback",
    description: "Try local first, fall back to cloud",
    executionMode: "hybrid",
    agentCount: 1,
    agents: [
      {
        id: "primary-local",
        name: "Local Model",
        role: "primary",
        provider: "ollama",
        model: "qwen2.5-coder:7b",
        enabled: true,
      },
    ],
    flowType: "sequential",
    hasJudge: false,
    fallbackEnabled: true,
    fallbackChain: ["anthropic:claude-sonnet-4-20250514", "openai:gpt-4o"],
  },
  {
    id: "dual-debate",
    name: "Dual Agent Debate",
    description: "Two models debate, you pick the best",
    executionMode: "cloud",
    agentCount: 2,
    agents: [
      {
        id: "agent-a",
        name: "Agent A",
        role: "primary",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        enabled: true,
      },
      {
        id: "agent-b",
        name: "Agent B",
        role: "critic",
        provider: "openai",
        model: "gpt-4o",
        enabled: true,
      },
    ],
    flowType: "parallel",
    hasJudge: false,
    fallbackEnabled: false,
    fallbackChain: [],
  },
  {
    id: "trio-judge",
    name: "Trio with Judge",
    description: "Three agents + judge picks best",
    executionMode: "cloud",
    agentCount: 3,
    agents: [
      {
        id: "agent-1",
        name: "Claude",
        role: "primary",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        enabled: true,
      },
      {
        id: "agent-2",
        name: "GPT",
        role: "secondary",
        provider: "openai",
        model: "gpt-4o",
        enabled: true,
      },
      {
        id: "agent-3",
        name: "Gemini",
        role: "secondary",
        provider: "google",
        model: "gemini-2.0-flash",
        enabled: true,
      },
    ],
    flowType: "parallel",
    hasJudge: true,
    judgeConfig: {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      criteria: ["accuracy", "completeness", "code quality", "clarity"],
      autoSelect: true,
    },
    fallbackEnabled: false,
    fallbackChain: [],
  },
  {
    id: "code-review",
    name: "Code Review Pipeline",
    description: "Generate → Review → Synthesize",
    executionMode: "hybrid",
    agentCount: 3,
    agents: [
      {
        id: "generator",
        name: "Generator",
        role: "primary",
        provider: "ollama",
        model: "qwen2.5-coder:7b",
        systemPrompt: "You are a code generator. Write clean, efficient code.",
        enabled: true,
      },
      {
        id: "reviewer",
        name: "Reviewer",
        role: "critic",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        systemPrompt: "You are a code reviewer. Find bugs, suggest improvements.",
        enabled: true,
      },
      {
        id: "synthesizer",
        name: "Synthesizer",
        role: "synthesizer",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        systemPrompt: "Combine the code and review feedback into a final, improved version.",
        enabled: true,
      },
    ],
    flowType: "sequential",
    hasJudge: false,
    fallbackEnabled: true,
    fallbackChain: ["anthropic:claude-sonnet-4-20250514"],
  },
];

interface AIModeState {
  // Current configuration
  executionMode: ExecutionMode;
  agentCount: 1 | 2 | 3 | 4;
  agents: AgentConfig[];
  flowType: FlowType;
  hasJudge: boolean;
  judgeConfig: JudgeConfig;
  fallbackEnabled: boolean;
  fallbackChain: string[];

  // Presets
  presets: AIModePreset[];
  activePresetId: string | null;

  // UI state
  isConfiguring: boolean;

  // Actions
  setExecutionMode: (mode: ExecutionMode) => void;
  setAgentCount: (count: 1 | 2 | 3 | 4) => void;
  setFlowType: (type: FlowType) => void;
  setHasJudge: (hasJudge: boolean) => void;
  setFallbackEnabled: (enabled: boolean) => void;
  setFallbackChain: (chain: string[]) => void;

  updateAgent: (id: string, updates: Partial<AgentConfig>) => void;
  addAgent: (agent: AgentConfig) => void;
  removeAgent: (id: string) => void;
  reorderAgents: (fromIndex: number, toIndex: number) => void;

  updateJudgeConfig: (updates: Partial<JudgeConfig>) => void;

  applyPreset: (presetId: string) => void;
  saveAsPreset: (name: string, description: string) => void;
  deletePreset: (presetId: string) => void;

  setIsConfiguring: (configuring: boolean) => void;

  // Computed
  getActiveConfig: () => AIModePreset;
  getDisplayName: () => string;
}

export const useAIModeStore = create<AIModeState>()(
  persist(
    (set, get) => ({
      // Default to single local model
      executionMode: "local",
      agentCount: 1,
      agents: [
        {
          id: "primary-local",
          name: "Local Model",
          role: "primary",
          provider: "ollama",
          model: "qwen2.5-coder:7b",
          enabled: true,
        },
      ],
      flowType: "sequential",
      hasJudge: false,
      judgeConfig: {
        enabled: false,
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        criteria: ["accuracy", "completeness", "code quality"],
        autoSelect: true,
      },
      fallbackEnabled: false,
      fallbackChain: [],

      presets: DEFAULT_PRESETS,
      activePresetId: "single-local",

      isConfiguring: false,

      setExecutionMode: (mode) => {
        set({ executionMode: mode, activePresetId: null });
      },

      setAgentCount: (count) => {
        const { agents } = get();
        let newAgents = [...agents];

        // Add agents if needed
        while (newAgents.length < count) {
          newAgents.push({
            id: `agent-${Date.now()}-${newAgents.length}`,
            name: `Agent ${newAgents.length + 1}`,
            role: "secondary",
            provider: "ollama",
            model: "qwen2.5-coder:7b",
            enabled: true,
          });
        }

        // Remove agents if needed (keep first N)
        if (newAgents.length > count) {
          newAgents = newAgents.slice(0, count);
        }

        set({ agentCount: count, agents: newAgents, activePresetId: null });
      },

      setFlowType: (type) => {
        set({ flowType: type, activePresetId: null });
      },

      setHasJudge: (hasJudge) => {
        set({ hasJudge, activePresetId: null });
      },

      setFallbackEnabled: (enabled) => {
        set({ fallbackEnabled: enabled, activePresetId: null });
      },

      setFallbackChain: (chain) => {
        set({ fallbackChain: chain, activePresetId: null });
      },

      updateAgent: (id, updates) => {
        set({
          agents: get().agents.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
          activePresetId: null,
        });
      },

      addAgent: (agent) => {
        const { agents, agentCount } = get();
        if (agents.length >= 4) return;
        set({
          agents: [...agents, agent],
          agentCount: Math.min(4, agentCount + 1) as 1 | 2 | 3 | 4,
          activePresetId: null,
        });
      },

      removeAgent: (id) => {
        const { agents, agentCount } = get();
        if (agents.length <= 1) return;
        set({
          agents: agents.filter((a) => a.id !== id),
          agentCount: Math.max(1, agentCount - 1) as 1 | 2 | 3 | 4,
          activePresetId: null,
        });
      },

      reorderAgents: (fromIndex, toIndex) => {
        const agents = [...get().agents];
        const [removed] = agents.splice(fromIndex, 1);
        agents.splice(toIndex, 0, removed);
        set({ agents, activePresetId: null });
      },

      updateJudgeConfig: (updates) => {
        set({
          judgeConfig: { ...get().judgeConfig, ...updates },
          activePresetId: null,
        });
      },

      applyPreset: (presetId) => {
        const preset = get().presets.find((p) => p.id === presetId);
        if (!preset) return;

        set({
          executionMode: preset.executionMode,
          agentCount: preset.agentCount,
          agents: preset.agents.map((a) => ({ ...a })),
          flowType: preset.flowType,
          hasJudge: preset.hasJudge,
          judgeConfig: preset.judgeConfig || get().judgeConfig,
          fallbackEnabled: preset.fallbackEnabled,
          fallbackChain: [...preset.fallbackChain],
          activePresetId: presetId,
        });
      },

      saveAsPreset: (name, description) => {
        const state = get();
        const newPreset: AIModePreset = {
          id: `custom-${Date.now()}`,
          name,
          description,
          executionMode: state.executionMode,
          agentCount: state.agentCount,
          agents: state.agents.map((a) => ({ ...a })),
          flowType: state.flowType,
          hasJudge: state.hasJudge,
          judgeConfig: state.hasJudge ? { ...state.judgeConfig } : undefined,
          fallbackEnabled: state.fallbackEnabled,
          fallbackChain: [...state.fallbackChain],
        };

        set({
          presets: [...state.presets, newPreset],
          activePresetId: newPreset.id,
        });
      },

      deletePreset: (presetId) => {
        // Don't delete default presets
        if (!presetId.startsWith("custom-")) return;

        set({
          presets: get().presets.filter((p) => p.id !== presetId),
          activePresetId:
            get().activePresetId === presetId ? null : get().activePresetId,
        });
      },

      setIsConfiguring: (configuring) => {
        set({ isConfiguring: configuring });
      },

      getActiveConfig: () => {
        const state = get();
        return {
          id: state.activePresetId || "custom",
          name: state.activePresetId
            ? state.presets.find((p) => p.id === state.activePresetId)?.name ||
              "Custom"
            : "Custom",
          description: "",
          executionMode: state.executionMode,
          agentCount: state.agentCount,
          agents: state.agents,
          flowType: state.flowType,
          hasJudge: state.hasJudge,
          judgeConfig: state.judgeConfig,
          fallbackEnabled: state.fallbackEnabled,
          fallbackChain: state.fallbackChain,
        };
      },

      getDisplayName: () => {
        const state = get();
        if (state.activePresetId) {
          const preset = state.presets.find((p) => p.id === state.activePresetId);
          return preset?.name || "Custom";
        }

        // Generate a descriptive name
        const parts: string[] = [];

        if (state.agentCount === 1) {
          parts.push(state.executionMode === "local" ? "Local" : "Cloud");
        } else {
          parts.push(`${state.agentCount} Agents`);
          parts.push(state.flowType === "parallel" ? "∥" : "→");
        }

        if (state.hasJudge) {
          parts.push("+ Judge");
        }

        if (state.fallbackEnabled) {
          parts.push("+ Fallback");
        }

        return parts.join(" ");
      },
    }),
    {
      name: "ai-mode-config",
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        executionMode: state.executionMode,
        agentCount: state.agentCount,
        agents: state.agents,
        flowType: state.flowType,
        hasJudge: state.hasJudge,
        judgeConfig: state.judgeConfig,
        fallbackEnabled: state.fallbackEnabled,
        fallbackChain: state.fallbackChain,
        presets: state.presets,
        activePresetId: state.activePresetId,
      }),
    }
  )
);
