// Stub module — prevents transitive imports from pulling in
// packages that builder-standalone doesn't need (@sarge/diagnostics)
//
// Exports no-op versions of Zustand stores that components reference
// so they don't crash at runtime when the real package is aliased away.

const noop = () => {};

// @sarge/diagnostics stub — useDiagnosticsStore is used by TimelineView
export const useDiagnosticsStore = (selector?: (s: Record<string, unknown>) => unknown) => {
  const state: Record<string, unknown> = {
    findings: [],
    scanStatus: "idle",
  };
  return selector ? selector(state) : state;
};
