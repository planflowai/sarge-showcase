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
  hydrated: boolean;
  hydrate: () => void;
  addPin: (pin: Pin) => void;
  updatePin: (id: string, updates: Partial<Pin>) => void;
  removePin: (id: string) => void;
  clearAll: () => void;
}

export const usePinStore = create<PinState>((set) => ({
  pins: [],
  hydrated: false,

  hydrate: () => {
    set({ hydrated: true });
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
