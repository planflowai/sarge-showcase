"use client";

import { create } from "zustand";
import type { ChatMode } from "@/lib/types";

export interface ToastNotification {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  duration?: number; // ms, default 5000
}

interface UIState {
  mainSidebarCollapsed: boolean;
  debateSidebarCollapsed: boolean;
  llmSectionCollapsed: boolean;
  testModeSidebarCollapsed: boolean;
  testModeLLMSectionCollapsed: boolean;
  // Chat mode (Chat vs Architect)
  chatMode: ChatMode;
  // Toast notifications
  toasts: ToastNotification[];
  toggleMainSidebar: () => void;
  toggleDebateSidebar: () => void;
  setDebateSidebarCollapsed: (collapsed: boolean) => void;
  setLlmSectionCollapsed: (collapsed: boolean) => void;
  toggleTestModeSidebar: () => void;
  setTestModeSidebarCollapsed: (collapsed: boolean) => void;
  setTestModeLLMSectionCollapsed: (collapsed: boolean) => void;
  // Chat mode actions
  setChatMode: (mode: ChatMode) => void;
  // Toast actions
  showToast: (toast: Omit<ToastNotification, "id">) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  mainSidebarCollapsed: false,
  debateSidebarCollapsed: false,
  llmSectionCollapsed: false,
  testModeSidebarCollapsed: false,
  testModeLLMSectionCollapsed: false,
  chatMode: "chat",
  toasts: [],
  toggleMainSidebar: () => set((s) => ({ mainSidebarCollapsed: !s.mainSidebarCollapsed })),
  toggleDebateSidebar: () => set((s) => ({ debateSidebarCollapsed: !s.debateSidebarCollapsed })),
  setDebateSidebarCollapsed: (collapsed: boolean) => set({ debateSidebarCollapsed: collapsed }),
  setLlmSectionCollapsed: (collapsed: boolean) => set({ llmSectionCollapsed: collapsed }),
  toggleTestModeSidebar: () => set((s) => ({ testModeSidebarCollapsed: !s.testModeSidebarCollapsed })),
  setTestModeSidebarCollapsed: (collapsed: boolean) => set({ testModeSidebarCollapsed: collapsed }),
  setTestModeLLMSectionCollapsed: (collapsed: boolean) => set({ testModeLLMSectionCollapsed: collapsed }),
  setChatMode: (mode) => set({ chatMode: mode }),

  showToast: (toast) => {
    const id = crypto.randomUUID();
    const newToast: ToastNotification = { ...toast, id };
    set((s) => ({ toasts: [...s.toasts, newToast] }));

    // Auto-dismiss after duration (default 5s)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));
