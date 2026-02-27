import { create } from "zustand";

export type WorkbenchStatus = "idle" | "building" | "complete";

export interface WorkbenchSlot {
  slot: number;           // 1–5
  monitorNumber: number;  // physical monitor
  provider: string;
  model: string;
  status: WorkbenchStatus;
  previewHtml: string;    // latest HTML from popout (for thumbnail)
  lastCode: string;       // full code for Lock Winner
  selected: boolean;      // included in next Send
}

// Layout (matches physical desk, Mon 4 = this screen):
//   Mon 5 (top-L)  |  Mon 1 (top-C)  |  Mon 3 (top-R)
//   Mon 6 (bot-L)  |  [Mon 4 = here] |  Mon 2 (bot-R)
// Slot → Monitor: 1→5, 2→1, 3→3, 4→6, 5→2
const DEFAULT_SLOTS: WorkbenchSlot[] = [
  { slot: 1, monitorNumber: 5, provider: "anthropic", model: "claude-sonnet-4-5-20250929", status: "idle", previewHtml: "", lastCode: "", selected: true },
  { slot: 2, monitorNumber: 1, provider: "openai",    model: "gpt-4o",                    status: "idle", previewHtml: "", lastCode: "", selected: true },
  { slot: 3, monitorNumber: 3, provider: "google",    model: "gemini-2.5-pro",             status: "idle", previewHtml: "", lastCode: "", selected: true },
  { slot: 4, monitorNumber: 6, provider: "xai",       model: "grok-4",                    status: "idle", previewHtml: "", lastCode: "", selected: true },
  { slot: 5, monitorNumber: 2, provider: "deepseek",  model: "deepseek-chat",              status: "idle", previewHtml: "", lastCode: "", selected: true },
];

interface WorkbenchState {
  active: boolean;
  setActive: (active: boolean) => void;

  // Code to load when exiting workbench via Lock Winner (null = normal exit)
  lockedCode: string | null;
  lockedHtml: string | null;
  clearLocked: () => void;

  slots: WorkbenchSlot[];
  setSlotProvider: (slot: number, provider: string) => void;
  setSlotModel: (slot: number, model: string) => void;
  setSlotStatus: (slot: number, status: WorkbenchStatus) => void;
  setSlotPreview: (slot: number, html: string, code: string) => void;
  toggleSlotSelected: (slot: number) => void;
  resetSlotStatuses: () => void;

  // Lock a winner — stores code + html, then closes dashboard
  lockWinner: (slot: number) => void;
}

export const useWorkbenchStore = create<WorkbenchState>()((set, get) => ({
  active: false,
  setActive: (active) => set({ active }),

  lockedCode: null,
  lockedHtml: null,
  clearLocked: () => set({ lockedCode: null, lockedHtml: null }),

  slots: DEFAULT_SLOTS.map((s) => ({ ...s })),

  setSlotProvider: (slotNum, provider) =>
    set((state) => ({
      slots: state.slots.map((s) => s.slot === slotNum ? { ...s, provider, model: "" } : s),
    })),

  setSlotModel: (slotNum, model) =>
    set((state) => ({
      slots: state.slots.map((s) => s.slot === slotNum ? { ...s, model } : s),
    })),

  setSlotStatus: (slotNum, status) =>
    set((state) => ({
      slots: state.slots.map((s) => s.slot === slotNum ? { ...s, status } : s),
    })),

  setSlotPreview: (slotNum, html, code) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.slot === slotNum ? { ...s, previewHtml: html, lastCode: code, status: "complete" } : s
      ),
    })),

  toggleSlotSelected: (slotNum) =>
    set((state) => ({
      slots: state.slots.map((s) => s.slot === slotNum ? { ...s, selected: !s.selected } : s),
    })),

  resetSlotStatuses: () =>
    set((state) => ({
      slots: state.slots.map((s) => ({ ...s, status: "idle" as WorkbenchStatus })),
    })),

  lockWinner: (slotNum) => {
    const slot = get().slots.find((s) => s.slot === slotNum);
    if (!slot?.lastCode) return;
    set({ lockedCode: slot.lastCode, lockedHtml: slot.previewHtml, active: false });
  },
}));
