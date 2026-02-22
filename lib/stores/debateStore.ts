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
}

interface DebateState {
  topic: string;
  arguments: Argument[];
  debate: Debate | null;
  showingSetup: boolean;
  debateHidden: boolean;
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
    // Placeholder - triggers debate opening
    set({ hydrated: true });
  },

  endDebate: () => {
    set({ debate: null, showingSetup: false });
  },

  setSourceConversation: (conversationId) => {
    set({ debate: { sourceConversationId: conversationId, participants: [], topic: "", messages: [], rounds: 0, critiques: [], roundSummaries: [] }, sourceConversationId: conversationId });
  },

  startDebate: (topic, participants, judge, rounds) => {
    set({ isRunning: true, showingSetup: false, topic, currentPhase: "round-1" });
  },

  startQuickDebate: (topic, useLocal, modelIds) => {
    set({ isRunning: true, showingSetup: false, topic });
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
