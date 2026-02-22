"use client";

import { create } from "zustand";

export interface Pin {
  id: string;
  label: string;
  content: string;
  createdAt: Date;
}

interface PinState {
  pins: Pin[];
  pinEnabled: boolean;
  pinHash: string | null;
  isLocked: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setPin: (pin: string) => void;
  addPin: (pin: Pin) => void;
  updatePin: (id: string, updates: Partial<Pin>) => void;
  removePin: () => void;
  verifyPin: (pin: string) => boolean;
  unlock: () => void;
  checkTimeout: () => void;
  touchActivity: () => void;
  clearAll: () => void;
}

export const usePinStore = create<PinState>((set, get) => ({
  pins: [],
  pinEnabled: false,
  pinHash: null,
  isLocked: false,
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  setPin: (pin) => {
    set({ pinEnabled: pin.length > 0, pinHash: pin.length > 0 ? pin : null });
  },

  addPin: (pin) => {
    set((state) => ({
      pins: [...state.pins, pin],
    }));
  },

  updatePin: (id, updates) => {
    set((state) => ({
      pins: state.pins.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  },

  removePin: () => {
    set({ pinEnabled: false, pinHash: null });
  },

  verifyPin: (pin) => {
    const state = get();
    return state.pinHash === pin;
  },

  unlock: () => {
    set({ isLocked: false });
  },

  checkTimeout: () => {
    // Placeholder for timeout check logic
  },

  touchActivity: () => {
    // Placeholder for activity tracking logic
  },

  clearAll: () => {
    set({ pins: [], pinHash: null, isLocked: false });
  },
}));
