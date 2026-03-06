"use client";

import { create } from "zustand";
import { syncUserSettings } from "../lib/supabase/forgeSync";

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
  defaultProvider: "anthropic",
  defaultModel: "claude-sonnet-4-5-20250929",
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
    syncUserSettings({ setting_key: "theme", setting_value: theme }).catch(() => {});
  },

  setDefaultProvider: (provider) => {
    set({ defaultProvider: provider });
    syncUserSettings({ setting_key: "defaultProvider", setting_value: provider }).catch(() => {});
  },

  setDefaultModel: (model) => {
    set({ defaultModel: model });
    syncUserSettings({ setting_key: "defaultModel", setting_value: model }).catch(() => {});
  },

  setLocalEndpoint: (endpoint) => {
    set({ localEndpoint: endpoint });
    syncUserSettings({ setting_key: "localEndpoint", setting_value: endpoint }).catch(() => {});
  },

  setBuildDocsAutoInject: (inject) => {
    set({ buildDocsAutoInject: inject });
    syncUserSettings({ setting_key: "buildDocsAutoInject", setting_value: inject }).catch(() => {});
  },

  setAirGapMode: (enabled) => {
    set({ airGapMode: enabled });
    syncUserSettings({ setting_key: "airGapMode", setting_value: enabled }).catch(() => {});
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
