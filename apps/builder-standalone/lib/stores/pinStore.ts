"use client";

import { create } from "zustand";

interface PinState {
  pinEnabled: boolean;
  pinHash: string | null;
  isLocked: boolean;
  hydrated: boolean;
  lastActivity: number;
  hydrate: () => void;
  setPin: (pin: string) => void;
  verifyPin: (pin: string) => boolean;
  unlock: () => void;
  lock: () => void;
  removePin: () => void;
  checkTimeout: () => void;
  touchActivity: () => void;
}

const STORAGE_KEY = "foundry-pin-store";
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return "ph_" + Math.abs(h).toString(36);
}

export const usePinStore = create<PinState>((set, get) => ({
  pinEnabled: false,
  pinHash: null,
  isLocked: false,
  hydrated: false,
  lastActivity: Date.now(),

  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          pinEnabled: data.pinEnabled ?? false,
          pinHash: data.pinHash ?? null,
          isLocked: data.pinEnabled ? true : false,
          hydrated: true,
          lastActivity: Date.now(),
        });
        return;
      }
    } catch {}
    set({ hydrated: true });
  },

  setPin: (pin: string) => {
    const hash = simpleHash(pin);
    set({ pinEnabled: true, pinHash: hash, isLocked: false });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ pinEnabled: true, pinHash: hash })
    );
  },

  verifyPin: (pin: string) => {
    const { pinHash } = get();
    return pinHash === simpleHash(pin);
  },

  unlock: () => {
    set({ isLocked: false, lastActivity: Date.now() });
  },

  lock: () => {
    set({ isLocked: true });
  },

  removePin: () => {
    set({ pinEnabled: false, pinHash: null, isLocked: false });
    localStorage.removeItem(STORAGE_KEY);
  },

  checkTimeout: () => {
    const { pinEnabled, isLocked, lastActivity } = get();
    if (pinEnabled && !isLocked && Date.now() - lastActivity > TIMEOUT_MS) {
      set({ isLocked: true });
    }
  },

  touchActivity: () => {
    set({ lastActivity: Date.now() });
  },
}));
