// Stub module — prevents transitive imports from pulling in
// packages that builder-standalone doesn't need.
//
// Exports no-op versions of Zustand stores that components reference
// so they don't crash at runtime when the real package is aliased away.
// All 6 aliased stores point here, so we export all expected names.

const emptyState: Record<string, unknown> = {};
const noopStore = (selector?: (s: Record<string, unknown>) => unknown) =>
  selector ? selector(emptyState) : emptyState;

// @sarge/diagnostics
export const useDiagnosticsStore = (selector?: (s: Record<string, unknown>) => unknown) => {
  const state = { findings: [], scanStatus: "idle" };
  return selector ? selector(state as any) : state;
};

// core/forensicLogStore
export const useForensicLogStore = noopStore;

// core/truthAnchorStore
export const useTruthAnchorStore = noopStore;

// core/syncStatusStore
export const useSyncStatusStore = noopStore;
export const shouldSync = false;

// core/journalStore
export const useJournalStore = noopStore;

// chat/debateStore
export const useDebateStore = noopStore;

// chat/debateHistoryStore
export const useDebateHistoryStore = noopStore;
