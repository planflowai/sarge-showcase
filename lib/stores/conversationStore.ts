"use client";

import { create } from "zustand";

export interface Conversation {
  id: string;
  title: string;
  messages: any[];
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationState {
  conversations: Conversation[];
  currentId: string | null;
  hydrated: boolean;
  hydrate: () => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, conversation: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  setCurrentId: (id: string | null) => void;
  clearAll: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  currentId: null,
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [...state.conversations, conversation],
    }));
  },

  updateConversation: (id, updates) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
      ),
    }));
  },

  deleteConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
    }));
  },

  setCurrentId: (id) => {
    set({ currentId: id });
  },

  clearAll: () => {
    set({
      conversations: [],
      currentId: null,
    });
  },
}));
