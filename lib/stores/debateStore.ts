"use client";

import { create } from "zustand";

export interface Argument {
  id: string;
  side: "pro" | "con";
  text: string;
  createdAt: Date;
}

interface DebateState {
  topic: string;
  arguments: Argument[];
  hydrated: boolean;
  hydrate: () => void;
  setTopic: (topic: string) => void;
  addArgument: (argument: Argument) => void;
  removeArgument: (id: string) => void;
  openDebate: () => void;
  clearAll: () => void;
}

export const useDebateStore = create<DebateState>((set) => ({
  topic: "",
  arguments: [],
  hydrated: false,

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

  clearAll: () => {
    set({
      topic: "",
      arguments: [],
    });
  },
}));
