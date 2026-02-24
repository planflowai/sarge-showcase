"use client";

import { create } from "zustand";

export interface Argument {
  id: string;
  side: "pro" | "con";
  text: string;
  createdAt: Date;
}

export interface Participant {
  provider: string;
  model?: string;
}

export interface Debate {
  id?: string;
  sourceConversationId?: string;
  participants: Participant[];
  topic: string;
  currentRound?: number;
  rounds: number;
  status?: "pending" | "ongoing" | "completed";
  executiveSummary?: string;
  messages: any[];
  critiques: any[];
  roundSummaries: any[];
  judge: Participant;
  agreements: string[];
}

interface DebateState {
  topic: string;
  arguments: Argument[];
  debate: Debate | null;
  showingSetup: boolean;
  debateHidden: boolean;
  debateComplete: boolean;
  hydrated: boolean;
  isRunning: boolean;
  isPaused: boolean;
  autoAdvance: boolean;
  currentPhase: string;
  activeAgentIndex: number;
  sourceConversationId: string | null;
  hydrate: () => void;
  setTopic: (topic: string) => void;
  addArgument: (argument: Argument) => void;
  removeArgument: (id: string) => void;
  openDebate: () => void;
  endDebate: () => void;
  clearDebate: () => void;
  startDebate: (topic: string, participants: any[], judge: any, rounds: number) => void;
  startQuickDebate: (topic: string, useLocal: boolean, modelIds: string[]) => void;
  runRound: () => void;
  pauseDebate: () => void;
  resumeDebate: () => void;
  redirectDebate: (input: string) => void;
  swapJudge: (judgeData: any) => void;
  setAutoAdvance: (enabled: boolean) => void;
  saveToKnowledge: () => void;
  closeSetup: () => void;
  hideDebate: () => void;
  showDebate: () => void;
  endDebateToThread: () => void;
  setSourceConversation: (conversationId: string) => void;
  clearAll: () => void;
}

export const useDebateStore = create<DebateState>((set) => ({
  topic: "",
  arguments: [],
  debate: null,
  showingSetup: false,
  debateHidden: false,
  debateComplete: false,
  hydrated: false,
  isRunning: false,
  isPaused: false,
  autoAdvance: false,
  currentPhase: "",
  activeAgentIndex: 0,
  sourceConversationId: null,

  hydrate: () => {
    set({ hydrated: true });
  },

  setTopic: (topic) => {
    set({ topic });
  },

  addArgument: (argument) => {
    set((state) => ({
      arguments: [...state.arguments, argument],
    }));
  },

  removeArgument: (id) => {
    set((state) => ({
      arguments: state.arguments.filter((a) => a.id !== id),
    }));
  },

  openDebate: () => {
    set({ showingSetup: true, debateHidden: false, hydrated: true });
  },

  endDebate: () => {
    set({ isRunning: false, isPaused: false, debateComplete: true });
  },

  clearDebate: () => {
    set({ debate: null, debateComplete: false, isRunning: false, isPaused: false, showingSetup: false });
  },

  setSourceConversation: (conversationId) => {
    set({ debate: { sourceConversationId: conversationId, participants: [], topic: "", messages: [], rounds: 0, critiques: [], roundSummaries: [], judge: { provider: "", model: "" }, agreements: [] }, sourceConversationId: conversationId });
  },

  startDebate: (topic, participants, judge, rounds) => {
    const debate: Debate = {
      id: `debate-${Date.now()}`,
      participants,
      topic,
      rounds,
      currentRound: 1,
      status: "ongoing",
      messages: [],
      critiques: [],
      roundSummaries: [],
      judge,
      agreements: [],
    };
    set({ debate, isRunning: true, showingSetup: false, topic, currentPhase: "round-1", debateHidden: false });
  },

  startQuickDebate: (topic, useLocal, modelIds) => {
    // Build participants based on useLocal flag
    let participants: Participant[];
    let judge: Participant;
    const rounds = 3; // Default from spec

    if (useLocal) {
      // Local Ollama quick debate: use provided modelIds
      const agent1Model = modelIds[0] || "llama2";
      const agent2Model = modelIds[1] || modelIds[0] || "llama2";
      const judgeModel = modelIds[2] || modelIds[0] || "llama2";

      participants = [
        { provider: "ollama", model: agent1Model },
        { provider: "ollama", model: agent2Model },
      ];
      judge = { provider: "ollama", model: judgeModel };
    } else {
      // Cloud quick debate: use default strong models
      participants = [
        { provider: "anthropic", model: "claude-opus-4-6" }, // Agent 1: Opus (strongest)
        { provider: "openai", model: "gpt-4o" }, // Agent 2: GPT-4o (diversity)
      ];
      judge = { provider: "anthropic", model: "claude-sonnet-4-5-20250929" }; // Judge: Sonnet (balanced)
    }

    // Create full Debate object matching startDebate structure
    const debate: Debate = {
      id: `debate-${Date.now()}`,
      participants,
      topic,
      rounds,
      currentRound: 1,
      status: "ongoing",
      messages: [],
      critiques: [],
      roundSummaries: [],
      judge,
      agreements: [],
    };

    set({ debate, isRunning: true, showingSetup: false, topic, currentPhase: "round-1", debateHidden: false });
  },

  runRound: () => {
    // Placeholder for running a debate round
  },

  pauseDebate: () => {
    set({ isPaused: true });
  },

  resumeDebate: () => {
    set({ isPaused: false });
  },

  redirectDebate: (input) => {
    // Placeholder for redirecting debate input
  },

  swapJudge: (judgeData) => {
    // Placeholder for swapping judge
  },

  setAutoAdvance: (enabled) => {
    set({ autoAdvance: enabled });
  },

  saveToKnowledge: () => {
    // Placeholder
  },

  closeSetup: () => {
    set({ showingSetup: false });
  },

  hideDebate: () => {
    set({ debateHidden: true });
  },

  showDebate: () => {
    set({ debateHidden: false });
  },

  endDebateToThread: () => {
    set({ debate: null, isRunning: false, showingSetup: false });
  },

  clearAll: () => {
    set({
      topic: "",
      arguments: [],
      debate: null,
      isRunning: false,
      isPaused: false,
      autoAdvance: false,
      sourceConversationId: null,
    });
  },
}));
