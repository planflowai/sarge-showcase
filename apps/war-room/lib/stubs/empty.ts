// Stub module — prevents transitive imports from pulling in
// packages that war-room doesn't need (@sarge/builder, @sarge/diagnostics)

const noop = () => {};

// @sarge/builder stub
export const useBuilderChatStore = (selector?: (s: Record<string, unknown>) => unknown) => {
  const state: Record<string, unknown> = {
    setPrefilledInput: noop,
    prefilledInput: null,
    messages: [],
    isStreaming: false,
  };
  return selector ? selector(state) : state;
};

// @sarge/diagnostics stub
export const useDiagnosticsStore = (selector?: (s: Record<string, unknown>) => unknown) => {
  const state: Record<string, unknown> = {
    findings: [],
    scanStatus: "idle",
  };
  return selector ? selector(state) : state;
};
