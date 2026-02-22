"use client";

import { create } from "zustand";
import type { SavedQuestion, SavedPoison } from "@/lib/types";

export interface TestCase {
  id: string;
  name: string;
  input: string;
  expected: string;
  createdAt: Date;
}

interface TestModeState {
  testCases: TestCase[];
  questions: SavedQuestion[];
  poisons: SavedPoison[];
  isRunning: boolean;
  slots: Array<{ provider: string; model: string }>;
  hydrated: boolean;
  hydrate: () => void;
  hydrateBatchHistory: () => void;
  streamLLM: (model: string, prompt: string, system: string, onChunk: (chunk: string) => void, source: "local" | "cloud") => Promise<void>;
  addTestCase: (testCase: TestCase) => void;
  updateTestCase: (id: string, updates: Partial<TestCase>) => void;
  deleteTestCase: (id: string) => void;
  setIsRunning: (running: boolean) => void;
  openTestMode: () => void;
  openBatchMode: () => void;
  addQuestion: (question: SavedQuestion) => void;
  updateQuestion: (id: string, question: Partial<SavedQuestion>) => void;
  removeQuestion: (id: string) => void;
  addPoison: (poison: SavedPoison) => void;
  updatePoison: (id: string, poison: Partial<SavedPoison>) => void;
  removePoison: (id: string) => void;
  clearAll: () => void;
}

export const useTestModeStore = create<TestModeState>((set) => ({
  testCases: [],
  questions: [],
  poisons: [],
  isRunning: false,
  slots: [
    { provider: "ollama", model: "" },
    { provider: "ollama", model: "" },
    { provider: "ollama", model: "" },
  ],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  hydrateBatchHistory: () => {
    set({ hydrated: true });
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
    set({ hydrated: true });
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

  clearAll: () => {
    set({
      testCases: [],
      isRunning: false,
    });
  },
}));
