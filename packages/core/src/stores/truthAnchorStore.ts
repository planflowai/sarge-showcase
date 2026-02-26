"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";

export type AnchorConfidence = "high" | "medium" | "low";
export type AnchorType = "TRUE" | "FALSE" | "UNCERTAIN";
export type AnchorScope = "per-debate" | "global";

export interface TruthAnchor {
  id: string;
  fact: string;
  type: AnchorType;
  confidence: number; // 0-100
  scope: AnchorScope;
  validatedBy: string; // which judge model
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // for facts that change (stock prices, current events)
  dismissed: boolean;
}

interface TruthAnchorState {
  anchors: TruthAnchor[];
  debateId: string | null;

  // Actions
  addAnchor: (anchor: Omit<TruthAnchor, "id" | "createdAt" | "updatedAt">) => string;
  updateAnchor: (id: string, updates: Partial<TruthAnchor>) => void;
  dismissAnchor: (id: string) => void;
  overrideAnchor: (id: string, newType: AnchorType, newConfidence: number) => void;
  removeAnchor: (id: string) => void;
  clearAnchorsForDebate: (debateId: string) => void;
  setDebateId: (id: string | null) => void;
  getActiveAnchors: () => TruthAnchor[];
  getAnchorsByType: (type: AnchorType) => TruthAnchor[];
  hasAnchorFor: (fact: string) => boolean;
}

export const useTruthAnchorStore = create<TruthAnchorState>()(
  persist(
    (set, get) => ({
      anchors: [],
      debateId: null,

      setDebateId: (id) => set({ debateId: id }),

      addAnchor: (anchor) => {
        const id = crypto.randomUUID();
        const now = new Date();
        const newAnchor: TruthAnchor = {
          ...anchor,
          id,
          createdAt: now,
          updatedAt: now,
          dismissed: false,
        };

        set((state) => ({
          anchors: [...state.anchors, newAnchor],
        }));

        return id;
      },

      updateAnchor: (id, updates) => {
        set((state) => ({
          anchors: state.anchors.map((a) =>
            a.id === id
              ? { ...a, ...updates, updatedAt: new Date() }
              : a
          ),
        }));
      },

      dismissAnchor: (id) => {
        get().updateAnchor(id, { dismissed: true });
      },

      overrideAnchor: (id, newType, newConfidence) => {
        get().updateAnchor(id, {
          type: newType,
          confidence: newConfidence,
          dismissed: false,
        });
      },

      removeAnchor: (id) => {
        set((state) => ({
          anchors: state.anchors.filter((a) => a.id !== id),
        }));
      },

      clearAnchorsForDebate: (debateId) => {
        set((state) => ({
          anchors: state.anchors.filter((a) => a.scope === "global"),
        }));
      },

      getActiveAnchors: () => {
        return get().anchors.filter((a) => !a.dismissed);
      },

      getAnchorsByType: (type) => {
        return get()
          .getActiveAnchors()
          .filter((a) => a.type === type);
      },

      hasAnchorFor: (fact) => {
        return get()
          .getActiveAnchors()
          .some((a) => a.fact.toLowerCase().includes(fact.toLowerCase()));
      },
    }),
    {
      name: "truth-anchor-store",
    }
  )
);
