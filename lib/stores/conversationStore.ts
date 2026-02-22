"use client";

import { create } from "zustand";
import type { Conversation } from "@/lib/types";

interface ConversationState {
  conversations: Conversation[];
  currentId: string | null;
  currentConversationId: string | null;
  loading: boolean;
  hydrated: boolean;
  hydrate: () => void;
  loadConversations: () => void;
  createConversation: (title: string, mode?: string) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, conversation: Partial<Conversation>) => void;
  updateConversationTitle: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  setCurrentId: (id: string | null) => void;
  setCurrent: (id: string | null) => void;
  setCurrentForMode: (id: string | null, mode: string) => void;
  subscribe: (callback?: (state: ConversationState) => void) => () => void;
  clearAll: () => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  currentId: null,
  currentConversationId: null,
  loading: false,
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  loadConversations: () => {
    // Placeholder - loads conversations from storage/API
    set({ hydrated: true });
  },

  createConversation: (title, mode = "chat") => {
    const conversation: Conversation = {
      id: `conv_${Date.now()}`,
      title,
      messages: [],
      mode,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((state) => ({
      conversations: [...state.conversations, conversation],
      currentId: conversation.id,
      currentConversationId: conversation.id,
    }));
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

  updateConversationTitle: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: new Date() } : c
      ),
    }));
  },

  deleteConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
    }));
  },

  setCurrentId: (id) => {
    set({ currentId: id, currentConversationId: id });
  },

  setCurrent: (id) => {
    set({ currentId: id, currentConversationId: id });
  },

  setCurrentForMode: (id, mode) => {
    set({ currentId: id, currentConversationId: id });
  },

  subscribe: (callback) => {
    // Placeholder for subscription
    return () => {};
  },

  clearAll: () => {
    set({
      conversations: [],
      currentId: null,
      currentConversationId: null,
      loading: false,
    });
  },
}));
