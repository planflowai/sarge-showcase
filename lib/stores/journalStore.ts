"use client";

import { create } from "zustand";

export interface JournalEntry {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisRecord {
  id: string;
  timestamp: Date;
  analysis: string;
  provider: string;
  context?: any;
}

export interface JournalChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  provider?: string;
}

export interface JournalConversation {
  id: string;
  title: string;
  messages: JournalChatMessage[];
  createdAt: Date;
}

interface JournalState {
  entries: JournalEntry[];
  currentDraft: string;
  currentAnalysis: any;
  currentPrompts: any;
  analysisHistory: any[];
  conversations: any[];
  activeConversationId: string | null;
  sharedContext: any;
  hydrated: boolean;
  hydrate: () => void;
  addEntry: (entry: JournalEntry) => void;
  updateEntry: (id: string, content: string) => void;
  deleteEntry: (id: string) => void;
  getEntriesToday: () => JournalEntry[];
  getEntriesForDate: (date: Date) => JournalEntry[];
  getAvailableDates: () => Date[];
  saveAnalysis: (analysis: string, provider: string, metadata: any) => void;
  deleteAnalysis: (id: string) => void;
  appendToJournal: (text: string) => void;
  updateDraft: (draft: string) => void;
  saveDraft: () => void;
  exportToday: () => string;
  exportForDate: (date: Date) => string;
  setCurrentAnalysis: (analysis: string, provider?: string) => void;
  setCurrentPrompts: (prompts: any) => void;
  createConversation: (title?: string) => void;
  addMessageToConversation: (conversationId: string, message: JournalChatMessage) => void;
  setActiveConversation: (conversationId: string | null) => void;
  deleteConversation: (conversationId: string) => void;
  getConversation: (conversationId: string) => any;
  setLastSuggestion: (suggestion: any) => void;
  clearAll: () => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  currentDraft: "",
  currentAnalysis: null,
  currentPrompts: null,
  analysisHistory: [],
  conversations: [],
  activeConversationId: null,
  sharedContext: null,
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  addEntry: (entry) => {
    set((state) => ({
      entries: [...state.entries, entry],
    }));
  },

  updateEntry: (id, content) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, content, updatedAt: new Date() } : e
      ),
    }));
  },

  deleteEntry: (id) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }));
  },

  getEntriesToday: () => {
    const state = get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return state.entries.filter((e) => {
      const entryDate = new Date(e.createdAt);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });
  },

  getEntriesForDate: (date) => {
    const state = get();
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    return state.entries.filter((e) => {
      const entryDate = new Date(e.createdAt);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === targetDate.getTime();
    });
  },

  getAvailableDates: () => {
    const state = get();
    const dates = new Set<string>();
    state.entries.forEach(e => {
      const date = new Date(e.createdAt);
      dates.add(date.toISOString().split('T')[0]);
    });
    return Array.from(dates).map(d => new Date(d));
  },

  saveAnalysis: (analysis, provider, metadata) => {
    set((state) => ({
      analysisHistory: [...state.analysisHistory, { id: Date.now().toString(), analysis, provider, metadata, timestamp: new Date() }],
    }));
  },

  deleteAnalysis: (id) => {
    set((state) => ({
      analysisHistory: state.analysisHistory.filter((a: any) => a.id !== id),
    }));
  },

  appendToJournal: (text) => {
    set((state) => ({
      currentDraft: state.currentDraft + text,
    }));
  },

  updateDraft: (draft) => {
    set({ currentDraft: draft });
  },

  saveDraft: () => {
    const state = get();
    if (state.currentDraft.trim()) {
      const now = new Date();
      set((st) => ({
        entries: [...st.entries, {
          id: Date.now().toString(),
          content: st.currentDraft,
          createdAt: now,
          updatedAt: now,
        }],
        currentDraft: "",
      }));
    }
  },

  exportToday: () => {
    const state = get();
    const todayEntries = state.getEntriesToday();
    return todayEntries.map(e => e.content).join("\n\n");
  },

  exportForDate: (date) => {
    const state = get();
    const entries = state.getEntriesForDate(date);
    return entries.map(e => e.content).join("\n\n");
  },

  setCurrentAnalysis: (analysis, provider) => {
    set({ currentAnalysis: { analysis, provider } });
  },

  setCurrentPrompts: (prompts) => {
    set({ currentPrompts: prompts });
  },

  createConversation: (title) => {
    set((state) => ({
      conversations: [...state.conversations, { id: Date.now().toString(), title: title || `Conversation ${state.conversations.length + 1}`, messages: [], createdAt: new Date() }],
    }));
  },

  addMessageToConversation: (conversationId, message) => {
    set((state) => ({
      conversations: state.conversations.map((c: any) =>
        c.id === conversationId ? { ...c, messages: [...(c.messages || []), { ...message, id: message.id || Date.now().toString(), timestamp: message.timestamp || new Date() }] } : c
      ),
    }));
  },

  setActiveConversation: (conversationId) => {
    set({ activeConversationId: conversationId });
  },

  deleteConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter((c: any) => c.id !== conversationId),
      activeConversationId: state.activeConversationId === conversationId ? null : state.activeConversationId,
    }));
  },

  getConversation: (conversationId) => {
    const state = get();
    return state.conversations.find((c: any) => c.id === conversationId);
  },

  setLastSuggestion: (suggestion) => {
    set({ sharedContext: suggestion });
  },

  clearAll: () => {
    set({ entries: [], currentDraft: "", currentAnalysis: null, currentPrompts: null, analysisHistory: [], conversations: [], activeConversationId: null, sharedContext: null });
  },
}));
