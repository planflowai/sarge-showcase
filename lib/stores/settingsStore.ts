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
  hydrated: boolean;
  hydrate: () => void;
  updateSettings: (updates: Partial<Settings>) => void;
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

  resetSettings: () => {
    set({ settings: defaultSettings });
  },

  clearAll: () => {
    set({
      settings: defaultSettings,
    });
  },
}));
