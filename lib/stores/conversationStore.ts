"use client";

import { create } from "zustand";

export interface Conversation {
  id: string;
  title: string;
  messages: any[];
  createdAt: Date;
  updatedAt: Date;
  mode?: string;
}

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
  deleteConversation: (id: string) => void;
  setCurrent: (id: string | null) => void;
  setCurrentId: (id: string | null) => void;
  setCurrentForMode: (id: string | null, mode: string) => void;
  subscribe: () => () => void;
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
    set({ hydrated: true, loading: false });
  },

  createConversation: (title, mode = "chat") => {
    const newConversation: Conversation = {
      id: `conv_${Date.now()}`,
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      mode,
    };
    set((state) => ({
      conversations: [...state.conversations, newConversation],
      currentId: newConversation.id,
      currentConversationId: newConversation.id,
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

  deleteConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
    }));
  },

  setCurrent: (id) => {
    set({ currentId: id, currentConversationId: id });
  },

  setCurrentId: (id) => {
    set({ currentId: id, currentConversationId: id });
  },

  setCurrentForMode: (id, mode) => {
    set({ currentId: id, currentConversationId: id });
  },

  subscribe: () => {
    // Returns an unsubscribe function
    // This is a placeholder - actual implementation would use Zustand's subscribe
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
