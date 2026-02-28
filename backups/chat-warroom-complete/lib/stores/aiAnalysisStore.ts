// Stub — useAIAnalysisStore is from @sarge/diagnostics (not available in chat-standalone)
// Header only reads activeSubTab for nav highlighting

import { create } from "zustand";

interface AIAnalysisStub {
  activeSubTab: string;
}

export const useAIAnalysisStore = create<AIAnalysisStub>()(() => ({
  activeSubTab: "analysis",
}));
