"use client";

import { create } from "zustand";

export interface Prompt {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: Date;
}

interface PromptState {
  prompts: Prompt[];
  hydrated: boolean;
  hydrate: () => void;
  addPrompt: (name: string, content: string) => void;
  updatePrompt: (id: string, name: string, content: string) => void;
  deletePrompt: (id: string) => void;
  clearAll: () => void;
}

export const usePromptStore = create<PromptState>((set) => ({
  prompts: [],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addPrompt: (name, content) => {
    const newPrompt: Prompt = {
      id: `prompt_${Date.now()}`,
      name,
      content,
      category: "general",
      createdAt: new Date(),
    };
    set((state) => ({
      prompts: [...state.prompts, newPrompt],
    }));
  },

  updatePrompt: (id, name, content) => {
    set((state) => ({
      prompts: state.prompts.map((p) =>
        p.id === id ? { ...p, name, content } : p
      ),
    }));
  },

  deletePrompt: (id) => {
    set((state) => ({
      prompts: state.prompts.filter((p) => p.id !== id),
    }));
  },

  clearAll: () => {
    set({ prompts: [] });
  },
}));
