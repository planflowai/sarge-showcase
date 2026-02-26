// Stub module — prevents transitive imports from pulling in
// packages that apps-standalone doesn't need

const noop = () => {};

export const useBuilderChatStore = (selector?: (s: Record<string, unknown>) => unknown) => {
  const state: Record<string, unknown> = {
    setPrefilledInput: noop,
    prefilledInput: null,
    messages: [],
    isStreaming: false,
  };
  return selector ? selector(state) : state;
};

export const useDiagnosticsStore = (selector?: (s: Record<string, unknown>) => unknown) => {
  const state: Record<string, unknown> = {
    findings: [],
    scanStatus: "idle",
  };
  return selector ? selector(state) : state;
};
