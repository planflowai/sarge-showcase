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
  hydrated: boolean;
  hydrate: () => void;
  setPin: (pin: string) => void;
  addPin: (pin: Pin) => void;
  updatePin: (id: string, updates: Partial<Pin>) => void;
  removePin: (id: string) => void;
  clearAll: () => void;
}

export const usePinStore = create<PinState>((set) => ({
  pins: [],
  pinEnabled: false,
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
  },

  setPin: (pin) => {
    set({ pinEnabled: pin.length > 0 });
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

  removePin: (id) => {
    set((state) => ({
      pins: state.pins.filter((p) => p.id !== id),
    }));
  },

  clearAll: () => {
    set({ pins: [] });
  },
}));
