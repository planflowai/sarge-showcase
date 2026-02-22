"use client";

import { create } from "zustand";
import type { Message } from "@/lib/types";

interface MessageState {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  hydrated: boolean;
  hydrate: () => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, provider: string, model: string, options?: any) => Promise<void>;
  generateImage: (conversationId: string, prompt: string, provider: string, model: string) => Promise<string>;
  clearMessages: () => void;
  clearAll: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],
  loading: false,
  sending: false,
  hydrated: false,

  hydrate: () => {
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

  loadMessages: async (conversationId) => {
    set({ loading: true });
    try {
      // Placeholder for loading messages
      set({ loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  sendMessage: async (conversationId, content, provider, model, options) => {
    set({ sending: true });
    try {
      // Placeholder for sending message
      set({ sending: false });
    } catch (error) {
      set({ sending: false });
    }
  },

  generateImage: async (conversationId, prompt, provider, model) => {
    // Placeholder for image generation
    return "";
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  clearAll: () => {
    set({ messages: [], loading: false, sending: false });
  },
}));
