import { create } from "zustand";

export type WarRoomMode = "single" | "2-way" | "3-way" | "4-way";
export type SendMode = "broadcast" | "direct";
export type SlotStatus = "idle" | "streaming" | "error" | "offline";

export interface MonitorSlot {
  id: string;
  label: string;
  monitorNumber: number;
  enabled: boolean;
  provider: string;
  model: string;
  status: SlotStatus;
}

interface WarRoomState {
  mode: WarRoomMode;
  setMode: (mode: WarRoomMode) => void;

  sendMode: SendMode;
  setSendMode: (mode: SendMode) => void;

  directTarget: string | null;
  setDirectTarget: (id: string | null) => void;

  slots: MonitorSlot[];
  toggleSlot: (id: string) => void;
  setSlotProvider: (id: string, provider: string) => void;
  setSlotModel: (id: string, model: string) => void;

  guardianActive: boolean;
}

const DEFAULT_SLOTS: MonitorSlot[] = [
  { id: "mon5", label: "Monitor 5", monitorNumber: 5, enabled: true, provider: "anthropic", model: "claude-sonnet-4-5-20250929", status: "idle" },
  { id: "mon3", label: "Monitor 3", monitorNumber: 3, enabled: true, provider: "openai", model: "gpt-4o", status: "idle" },
  { id: "mon6", label: "Monitor 6", monitorNumber: 6, enabled: true, provider: "xai", model: "grok-4", status: "idle" },
  { id: "mon2", label: "Monitor 2", monitorNumber: 2, enabled: true, provider: "google", model: "gemini-2.5-pro", status: "idle" },
];

export const useWarRoomStore = create<WarRoomState>()((set) => ({
  mode: "4-way",
  setMode: (mode) => set({ mode }),

  sendMode: "broadcast",
  setSendMode: (sendMode) => set({ sendMode }),

  directTarget: null,
  setDirectTarget: (directTarget) => set({ directTarget }),

  slots: DEFAULT_SLOTS,

  toggleSlot: (id) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled, status: !s.enabled ? "idle" : "offline" } : s
      ),
    })),

  setSlotProvider: (id, provider) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.id === id ? { ...s, provider, model: "" } : s
      ),
    })),

  setSlotModel: (id, model) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.id === id ? { ...s, model } : s
      ),
    })),

  guardianActive: true,
}));
