"use client";

import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface MessageState {
  messages: Message[];
  hydrated: boolean;
  hydrate: () => void;
  loadMessages: (conversationId?: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  clearAll: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  loadMessages: (conversationId) => {
    // Placeholder - loads messages for a conversation
    set({ hydrated: true });
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  updateMessage: (id, content) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    }));
  },

  deleteMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }));
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  clearAll: () => {
    set({ messages: [] });
  },
}));
