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
  debate: any;
  showingSetup: boolean;
  debateHidden: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setTopic: (topic: string) => void;
  addArgument: (argument: Argument) => void;
  removeArgument: (id: string) => void;
  openDebate: () => void;
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

  setSourceConversation: (conversationId) => {
    set({ debate: { sourceConversationId: conversationId } });
  },

  clearAll: () => {
    set({
      topic: "",
      arguments: [],
      debate: null,
    });
  },
}));
