"use client";

import { create } from "zustand";

export interface Settings {
  theme: "light" | "dark";
  language: string;
  notifications: boolean;
  autoSave: boolean;
}

interface SettingsState {
  settings: Settings;
  theme: "light" | "dark";
  defaultProvider: string;
  defaultModel: string;
  localEndpoint: string;
  buildDocsAutoInject: boolean;
  airGapMode: boolean;
  hydrated: boolean;
  hydrate: () => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setTheme: (theme: "light" | "dark") => void;
  setDefaultProvider: (provider: string) => void;
  setDefaultModel: (model: string) => void;
  setLocalEndpoint: (endpoint: string) => void;
  setBuildDocsAutoInject: (inject: boolean) => void;
  setAirGapMode: (enabled: boolean) => void;
  resetSettings: () => void;
  clearAll: () => void;
}

const defaultSettings: Settings = {
  theme: "dark",
  language: "en",
  notifications: true,
  autoSave: true,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,
  theme: defaultSettings.theme,
  defaultProvider: "",
  defaultModel: "",
  localEndpoint: "",
  buildDocsAutoInject: false,
  airGapMode: false,
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
      theme: updates.theme || state.theme,
    }));
  },

  setTheme: (theme) => {
    set({ theme });
  },

  setDefaultProvider: (provider) => {
    set({ defaultProvider: provider });
  },

  setDefaultModel: (model) => {
    set({ defaultModel: model });
  },

  setLocalEndpoint: (endpoint) => {
    set({ localEndpoint: endpoint });
  },

  setBuildDocsAutoInject: (inject) => {
    set({ buildDocsAutoInject: inject });
  },

  setAirGapMode: (enabled) => {
    set({ airGapMode: enabled });
  },

  resetSettings: () => {
    set({ settings: defaultSettings });
  },

  clearAll: () => {
    set({
      settings: defaultSettings,
    });
  },
}));
