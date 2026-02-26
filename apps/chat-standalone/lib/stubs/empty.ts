// Stub module — prevents transitive imports from pulling in
// packages that chat-standalone doesn't need (@sarge/builder, @sarge/diagnostics)
//
// Exports no-op versions of Zustand stores that chat components reference
// so they don't crash at runtime when the real package is aliased away.

const noop = () => {};

// @sarge/builder stub — useBuilderChatStore is used by MessageBubble
export const useBuilderChatStore = (selector?: (s: Record<string, unknown>) => unknown) => {
  const state: Record<string, unknown> = {
    setPrefilledInput: noop,
    prefilledInput: null,
    messages: [],
    isStreaming: false,
  };
  return selector ? selector(state) : state;
};

// @sarge/diagnostics stub — useDiagnosticsStore is used by TimelineView
export const useDiagnosticsStore = (selector?: (s: Record<string, unknown>) => unknown) => {
  const state: Record<string, unknown> = {
    findings: [],
    scanStatus: "idle",
  };
  return selector ? selector(state) : state;
};
