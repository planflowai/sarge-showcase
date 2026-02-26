// Stub module — prevents transitive imports from pulling in
// packages that diagnostics-standalone doesn't need (@sarge/builder, @sarge/apps)

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
