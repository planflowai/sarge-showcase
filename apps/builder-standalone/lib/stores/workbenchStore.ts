import { create } from "zustand";

export type WorkbenchStatus = "idle" | "building" | "complete" | "error";

export interface WorkbenchSlot {
  slot: number;           // 1–5
  monitorNumber: number;  // physical monitor
  provider: string;
  model: string;
  status: WorkbenchStatus;
  previewHtml: string;    // latest HTML from popout (for thumbnail)
  lastCode: string;       // full code for Lock Winner
  selected: boolean;      // included in next Send

  // ── Metrics ──
  tokenCount: number;     // tokens received so far
  tokensPerSec: number;   // generation speed
  startedAt: number;      // Date.now() when build started
  completedAt: number;    // Date.now() when build finished
  errorMsg: string;       // error message if status === "error"
}

// Layout (matches physical desk, Mon 4 = this screen):
//   Mon 5 (top-L)  |  Mon 1 (top-C)  |  Mon 3 (top-R)
//   Mon 6 (bot-L)  |  [Mon 4 = here] |  Mon 2 (bot-R)
// Slot → Monitor: 1→5, 2→1, 3→3, 4→6, 5→2
const DEFAULT_SLOTS: WorkbenchSlot[] = [
  { slot: 1, monitorNumber: 5, provider: "anthropic", model: "claude-sonnet-4-5-20250929", status: "idle", previewHtml: "", lastCode: "", selected: true, tokenCount: 0, tokensPerSec: 0, startedAt: 0, completedAt: 0, errorMsg: "" },
  { slot: 2, monitorNumber: 1, provider: "openai",    model: "gpt-4o",                    status: "idle", previewHtml: "", lastCode: "", selected: true, tokenCount: 0, tokensPerSec: 0, startedAt: 0, completedAt: 0, errorMsg: "" },
  { slot: 3, monitorNumber: 3, provider: "google",    model: "gemini-2.5-pro",             status: "idle", previewHtml: "", lastCode: "", selected: true, tokenCount: 0, tokensPerSec: 0, startedAt: 0, completedAt: 0, errorMsg: "" },
  { slot: 4, monitorNumber: 6, provider: "xai",       model: "grok-4",                    status: "idle", previewHtml: "", lastCode: "", selected: true, tokenCount: 0, tokensPerSec: 0, startedAt: 0, completedAt: 0, errorMsg: "" },
  { slot: 5, monitorNumber: 2, provider: "deepseek",  model: "deepseek-chat",              status: "idle", previewHtml: "", lastCode: "", selected: true, tokenCount: 0, tokensPerSec: 0, startedAt: 0, completedAt: 0, errorMsg: "" },
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
  setSlotMetrics: (slot: number, tokenCount: number, tokensPerSec: number) => void;
  setSlotError: (slot: number, errorMsg: string) => void;
  setSlotStarted: (slot: number) => void;
  setSlotCompleted: (slot: number) => void;
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
        s.slot === slotNum ? { ...s, previewHtml: html, lastCode: code, status: "complete" as WorkbenchStatus } : s
      ),
    })),

  setSlotMetrics: (slotNum, tokenCount, tokensPerSec) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.slot === slotNum ? { ...s, tokenCount, tokensPerSec } : s
      ),
    })),

  setSlotError: (slotNum, errorMsg) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.slot === slotNum ? { ...s, status: "error" as WorkbenchStatus, errorMsg } : s
      ),
    })),

  setSlotStarted: (slotNum) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.slot === slotNum ? { ...s, status: "building" as WorkbenchStatus, startedAt: Date.now(), completedAt: 0, tokenCount: 0, tokensPerSec: 0, errorMsg: "", previewHtml: "", lastCode: "" } : s
      ),
    })),

  setSlotCompleted: (slotNum) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.slot === slotNum ? { ...s, status: "complete" as WorkbenchStatus, completedAt: Date.now() } : s
      ),
    })),

  toggleSlotSelected: (slotNum) =>
    set((state) => ({
      slots: state.slots.map((s) => s.slot === slotNum ? { ...s, selected: !s.selected } : s),
    })),

  resetSlotStatuses: () =>
    set((state) => ({
      slots: state.slots.map((s) => ({ ...s, status: "idle" as WorkbenchStatus, tokenCount: 0, tokensPerSec: 0, startedAt: 0, completedAt: 0, errorMsg: "" })),
    })),

  lockWinner: (slotNum) => {
    const slot = get().slots.find((s) => s.slot === slotNum);
    if (!slot?.lastCode) return;
    set({ lockedCode: slot.lastCode, lockedHtml: slot.previewHtml, active: false });
  },
}));
