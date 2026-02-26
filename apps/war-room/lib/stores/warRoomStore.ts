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

// All 5 usable monitors (Mon 4 = War Room itself, never a popout target)
// Order: 4-way uses first 4, 3-way uses [mon6, mon1, mon2], 2-way uses [mon6, mon2]
const ALL_SLOTS: MonitorSlot[] = [
  { id: "mon5", label: "Monitor 5", monitorNumber: 5, enabled: true, provider: "anthropic", model: "claude-sonnet-4-5-20250929", status: "idle" },
  { id: "mon6", label: "Monitor 6", monitorNumber: 6, enabled: true, provider: "xai", model: "grok-4", status: "idle" },
  { id: "mon3", label: "Monitor 3", monitorNumber: 3, enabled: true, provider: "openai", model: "gpt-4o", status: "idle" },
  { id: "mon2", label: "Monitor 2", monitorNumber: 2, enabled: true, provider: "google", model: "gemini-2.5-pro", status: "idle" },
  { id: "mon1", label: "Monitor 1", monitorNumber: 1, enabled: true, provider: "deepseek", model: "deepseek-chat", status: "idle" },
];

// Which slots are used per mode (Mon 4 = War Room, never a popout):
//   5  1  3
//   6  4  2
// 4-way: Mon 5, 1, 3, 2  (top row + bottom-right)
// 3-way: Mon 6, 1, 2      (bottom-left, top-center, bottom-right)
// 2-way: Mon 6, 2          (left and right of Mon 4)
// single: Mon 6             (adjacent to Mon 4)
export const MODE_SLOT_IDS: Record<WarRoomMode, string[]> = {
  "4-way": ["mon5", "mon3", "mon6", "mon2"],
  "3-way": ["mon6", "mon1", "mon2"],
  "2-way": ["mon6", "mon2"],
  "single": ["mon6"],
};

export const useWarRoomStore = create<WarRoomState>()((set) => ({
  mode: "4-way",
  setMode: (mode) => set({ mode }),

  sendMode: "broadcast",
  setSendMode: (sendMode) => set({ sendMode }),

  directTarget: null,
  setDirectTarget: (directTarget) => set({ directTarget }),

  slots: ALL_SLOTS,

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
