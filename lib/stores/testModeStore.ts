"use client";

import { create } from "zustand";
import type { SavedQuestion, SavedPoison, BatchPassLog } from "@/lib/types";

export interface TestCase {
  id: string;
  name: string;
  input: string;
  expected: string;
  createdAt: Date;
}

export interface BatchHistoryEntry {
  batchId: string; // Unique batch identifier
  source: "local" | "cloud";
  testCount: number; // Total tests in batch
  savedAt: number; // Timestamp when saved
  passLogs: BatchPassLog[]; // Array of pass results (pass1, pass2, pass3, etc.)
}

interface TestModeState {
  testCases: TestCase[];
  questions: SavedQuestion[];
  poisons: SavedPoison[];
  isRunning: boolean;
  showingTestMode: boolean;
  testModeHidden: boolean;
  batchModeActive: boolean;
  batchRunning: boolean;
  batchPaused: boolean;
  batchCurrentPass: number;
  batchCurrentTest: number;
  batchProgress: number;
  currentView: 'batch' | 'test' | 'review' | 'config' | null;
  slots: Array<{ provider: string; model: string }>;
  batchHistory: BatchHistoryEntry[];
  testHistory: Array<{ testId: string; source: "local" | "cloud"; savedAt: number; question: string; passLogs?: Array<{ model: string }> }>;
  promptPools: Record<string, Array<{ id: string; name: string }>>;
  debateLogic: {
    d1Prompt: string;
    d1PromptWithContext: string;
    d2Prompt: string;
    d3Prompt: string;
    poisonInjection: string;
    challengeKeywords: string;
    flagKeywords: string;
    caughtKeywords: string;
  };
  hydrated: boolean;
  hydrate: () => void;
  hydrateBatchHistory: () => void;
  hydrateTestHistory: () => void;
  updateSlot: (index: number, updates: Partial<{ provider: string; model: string }>) => void;
  streamLLM: (model: string, prompt: string, system: string, onChunk: (chunk: string) => void, source: "local" | "cloud") => Promise<void>;
  addTestCase: (testCase: TestCase) => void;
  updateTestCase: (id: string, updates: Partial<TestCase>) => void;
  deleteTestCase: (id: string) => void;
  setIsRunning: (running: boolean) => void;
  openTestMode: () => void;
  showTestMode: () => void;
  hideTestMode: () => void;
  openBatchMode: () => void;
  addQuestion: (question: SavedQuestion) => void;
  updateQuestion: (id: string, question: Partial<SavedQuestion>) => void;
  removeQuestion: (id: string) => void;
  addPoison: (poison: SavedPoison) => void;
  updatePoison: (id: string, poison: Partial<SavedPoison>) => void;
  removePoison: (id: string) => void;
  updateDebateLogic: (updates: Partial<{
    d1Prompt: string;
    d1PromptWithContext: string;
    d2Prompt: string;
    d3Prompt: string;
    poisonInjection: string;
    challengeKeywords: string;
    flagKeywords: string;
    caughtKeywords: string;
  }>) => void;
  setCurrentView: (view: 'batch' | 'test' | 'review' | 'config' | null) => void;
  clearAll: () => void;
}

export const useTestModeStore = create<TestModeState>((set) => ({
  testCases: [],
  questions: [],
  poisons: [],
  isRunning: false,
  showingTestMode: false,
  testModeHidden: false,
  batchModeActive: false,
  batchRunning: false,
  batchPaused: false,
  batchCurrentPass: 0,
  batchCurrentTest: 0,
  batchProgress: 0,
  currentView: null,
  slots: [
    { provider: "ollama", model: "" },
    { provider: "ollama", model: "" },
    { provider: "ollama", model: "" },
  ],
  batchHistory: [],
  testHistory: [],
  promptPools: { D1: [], D2: [], D3: [], Judge: [] },
  debateLogic: {
    d1Prompt: "",
    d1PromptWithContext: "",
    d2Prompt: "",
    d3Prompt: "",
    poisonInjection: "",
    challengeKeywords: "",
    flagKeywords: "",
    caughtKeywords: "",
  },
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  hydrateBatchHistory: () => {
    set({ hydrated: true });
  },

  hydrateTestHistory: () => {
    set({ hydrated: true });
  },

  updateSlot: (index, updates) => {
    set((state) => ({
      slots: state.slots.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    }));
  },

  streamLLM: async (model, prompt, system, onChunk, source) => {
    // Placeholder implementation for streaming LLM calls
    try {
      const response = await fetch(
        source === "local" ? "/api/ollama/generate" : "/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt, system, stream: true }),
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (chunk) onChunk(chunk);
      }
    } catch (error) {
      console.error("[streamLLM] Error:", error);
      onChunk("\n[ERROR: Failed to stream response]\n");
    }
  },

  addTestCase: (testCase) => {
    set((state) => ({
      testCases: [...state.testCases, testCase],
    }));
  },

  updateTestCase: (id, updates) => {
    set((state) => ({
      testCases: state.testCases.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },

  deleteTestCase: (id) => {
    set((state) => ({
      testCases: state.testCases.filter((t) => t.id !== id),
    }));
  },

  setIsRunning: (running) => {
    set({ isRunning: running });
  },

  openTestMode: () => {
    // Placeholder - triggers test mode opening
    set({ hydrated: true });
  },

  openBatchMode: () => {
    // Placeholder - triggers batch mode opening
    set({ hydrated: true, batchModeActive: true });
  },

  showTestMode: () => {
    set({ showingTestMode: true, testModeHidden: false });
  },

  hideTestMode: () => {
    set({ testModeHidden: true });
  },

  addQuestion: (question) => {
    set((state) => ({
      questions: [...state.questions, question],
    }));
  },

  updateQuestion: (id, updates) => {
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    }));
  },

  removeQuestion: (id) => {
    set((state) => ({
      questions: state.questions.filter((q) => q.id !== id),
    }));
  },

  addPoison: (poison) => {
    set((state) => ({
      poisons: [...state.poisons, poison],
    }));
  },

  updatePoison: (id, updates) => {
    set((state) => ({
      poisons: state.poisons.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  },

  removePoison: (id) => {
    set((state) => ({
      poisons: state.poisons.filter((p) => p.id !== id),
    }));
  },

  updateDebateLogic: (updates) => {
    set((state) => ({
      debateLogic: { ...state.debateLogic, ...updates },
    }));
  },

  setCurrentView: (view) => {
    set({ currentView: view });
  },

  clearAll: () => {
    set({
      testCases: [],
      isRunning: false,
      currentView: null,
    });
  },
}));
