"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@sarge/core";
import { useTestModeStore } from "@sarge/core";
import { useDebateStore } from "@sarge/chat";
import { providers } from "@sarge/core";
import type {
  Provider,
  Message,
  Conversation,
  Debate,
  DebateParticipant,
  Critique,
  RoundSummary,
  ForensicLogEntry,
  ForensicSession,
  ForensicLogViewType,
  BatchConfig,
  BatchRotationEntry,
  BatchTestResult,
  BatchPassLog,
  ModelAssignment,
  EchoConfig,
  SavedQuestion,
  SavedPoison,
} from "@sarge/core";

// ============================================================================
// SUB-TAB TYPES
// ============================================================================

export type AIAnalysisSubTab = 'chat' | 'debate' | 'batch' | 'test' | 'forensic' | 'review';

// ============================================================================
// AI CHAT TYPES
// ============================================================================

interface AIChatConversation extends Conversation {
  // Inherits all conversation properties
}

interface AIChatMessage extends Message {
  // Inherits all message properties
}

interface AIChatState {
  conversations: AIChatConversation[];
  currentConversationId: string | null;
  messages: AIChatMessage[];
  loading: boolean;
  sending: boolean;
}

// ============================================================================
// AI DEBATE TYPES
// ============================================================================

type AIDebatePhase = "idle" | "research" | "cross-check" | "judging";

interface AIDebateState {
  debate: Debate | null;
  showingSetup: boolean;
  debateHidden: boolean;
  isRunning: boolean;
  isPaused: boolean;
  autoAdvance: boolean;
  currentPhase: AIDebatePhase;
  activeAgentIndex: number;
  sourceConversationId: string | null;
  history: Debate[];
}

// ============================================================================
// AI TEST TYPES
// ============================================================================

interface AITestResponse {
  round: number;
  role: 'd1' | 'd2' | 'd3' | 'judge';
  model: string;
  content: string;
  tokens: number;
  timeMs: number;
  status?: 'clean' | 'echo' | 'flagged';
  poisonInjected?: boolean;
}

interface AITestState {
  mode: 'unfiltered' | 'pill' | 'pill-prompt';
  source: 'local' | 'cloud';
  echoConfig: EchoConfig;
  currentRound: number;
  question: string;
  poison: string;
  questionLocked: boolean;
  poisonLocked: boolean;
  responses: AITestResponse[];
  isRunning: boolean;
  poisonMarkers: string[];
}

// ============================================================================
// AI BATCH TYPES
// ============================================================================

interface AIBatchState {
  batchRunning: boolean;
  batchPaused: boolean;
  batchId: string;
  batchSource: 'local' | 'cloud';
  batchCurrentPass: number;
  batchCurrentTest: number;
  batchTotalTests: number;
  batchRotation: BatchRotationEntry[];
  batchPassLogs: BatchPassLog[];
  batchActivity: string;
  batchLockedRotation: BatchRotationEntry[] | null;
  speedMode: 1 | 2 | 3;
  history: AIBatchHistoryEntry[];
  selectedBatchId: string | null;
}

interface AIBatchHistoryEntry {
  batchId: string;
  savedAt: string;
  source: 'local' | 'cloud';
  testCount: number;
  passLogs: BatchPassLog[];
}

// ============================================================================
// AI FORENSIC TYPES
// ============================================================================

interface AIForensicFilters {
  severity: string[];
  category: string[];
  searchText: string;
  sessionId: string | null;
}

interface AIForensicState {
  entries: ForensicLogEntry[];
  sessions: ForensicSession[];
  showingForensicLog: boolean;
  currentView: ForensicLogViewType;
  selectedSessionId: string | null;
  expandedEntryId: string | null;
  replayIndex: number;
  replayPlaying: boolean;
  replaySpeed: number;
  filters: AIForensicFilters;
  chainValid: boolean;
  _seq: number;
}

// ============================================================================
// AI REVIEW TYPES
// ============================================================================

interface AIReviewState {
  selectedBatchId: string | null;
  selectedTest: BatchTestResult | null;
  comparisonMode: boolean;
  comparedBatchIds: string[];
}

// ============================================================================
// MAIN STORE INTERFACE
// ============================================================================

interface AIAnalysisState {
  // Navigation
  activeSubTab: AIAnalysisSubTab;

  // Sub-states
  aiChat: AIChatState;
  aiDebate: AIDebateState;
  aiTest: AITestState;
  aiBatch: AIBatchState;
  aiForensic: AIForensicState;
  aiReview: AIReviewState;

  // Global actions
  aiSetActiveSubTab: (tab: AIAnalysisSubTab) => void;

  // AI Chat actions
  aiChatLoadConversations: () => Promise<void>;
  aiChatCreateConversation: (title?: string) => Promise<string | null>;
  aiChatDeleteConversation: (id: string) => Promise<void>;
  aiChatUpdateConversationTitle: (id: string, title: string) => Promise<void>;
  aiChatSetCurrent: (id: string | null) => void;
  aiChatLoadMessages: (conversationId: string) => Promise<void>;
  aiChatAddMessage: (message: AIChatMessage) => Promise<void>;
  aiChatSendMessage: (
    conversationId: string,
    prompt: string,
    provider: Provider,
    model: string
  ) => Promise<void>;
  aiChatClearMessages: () => void;

  // AI Debate actions
  aiDebateOpenSetup: () => void;
  aiDebateCloseSetup: () => void;
  aiDebateHide: () => void;
  aiDebateShow: () => void;
  aiDebateSetSourceConversation: (id: string | null) => void;
  aiDebateStart: (
    topic: string,
    participants: DebateParticipant[],
    judge: DebateParticipant,
    rounds: number
  ) => void;
  aiDebateRunRound: () => Promise<void>;
  aiDebatePause: () => void;
  aiDebateResume: () => void;
  aiDebateRedirect: (newPrompt: string) => void;
  aiDebateSwapJudge: (newJudge: DebateParticipant) => void;
  aiDebateSetAutoAdvance: (auto: boolean) => void;
  aiDebateEnd: () => void;
  aiDebateSaveToHistory: () => void;

  // AI Test actions
  aiTestSetMode: (mode: 'unfiltered' | 'pill' | 'pill-prompt') => void;
  aiTestSetSource: (source: 'local' | 'cloud') => void;
  aiTestSetQuestion: (question: string) => void;
  aiTestSetPoison: (poison: string) => void;
  aiTestSetQuestionLocked: (locked: boolean) => void;
  aiTestSetPoisonLocked: (locked: boolean) => void;
  aiTestSetEchoConfig: (config: EchoConfig) => void;
  aiTestRunTest: () => Promise<void>;
  aiTestStopTest: () => void;
  aiTestClearResults: () => void;

  // AI Forensic actions
  aiForensicOpenLog: () => void;
  aiForensicCloseLog: () => void;
  aiForensicSetCurrentView: (view: ForensicLogViewType) => void;
  aiForensicSetSelectedSession: (id: string | null) => void;
  aiForensicSetExpandedEntry: (id: string | null) => void;
  aiForensicCaptureEntry: (
    params: Omit<
      ForensicLogEntry,
      "id" | "sequenceNumber" | "hash" | "previousHash" | "timestamp" | "aiDecision" | "medicationContext" | "actors" | "dataLineage" | "compliance"
    > & {
      aiDecision?: ForensicLogEntry["aiDecision"];
      medicationContext?: ForensicLogEntry["medicationContext"];
      actors?: ForensicLogEntry["actors"];
      dataLineage?: ForensicLogEntry["dataLineage"];
      compliance?: ForensicLogEntry["compliance"];
    }
  ) => Promise<void>;
  aiForensicStartSession: (
    config: ForensicSession["config"],
    type: "single" | "batch"
  ) => string;
  aiForensicEndSession: (sessionId: string, verdict?: string) => void;
  aiForensicSetReplayIndex: (i: number) => void;
  aiForensicReplayNext: () => void;
  aiForensicReplayPrev: () => void;
  aiForensicToggleReplayPlay: () => void;
  aiForensicSetReplaySpeed: (ms: number) => void;
  aiForensicStopReplay: () => void;
  aiForensicSetFilters: (f: Partial<AIForensicFilters>) => void;
  aiForensicGetFilteredEntries: () => ForensicLogEntry[];
  aiForensicGetSessionEntries: (sessionId: string) => ForensicLogEntry[];
  aiForensicExportJSON: () => void;
  aiForensicClearAll: () => void;

  // AI Review actions
  aiReviewSelectBatch: (batchId: string | null) => void;
  aiReviewSelectTest: (test: BatchTestResult | null) => void;
  aiReviewToggleComparison: () => void;
  aiReviewAddComparedBatch: (batchId: string) => void;
  aiReviewRemoveComparedBatch: (batchId: string) => void;
  aiReviewClearComparisons: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const AI_CHAT_STORAGE_KEY = "ai-analysis-chat-conversations";
const AI_CHAT_MESSAGES_PREFIX = "ai-analysis-chat-messages-";

function loadAIChatConversationsFromStorage(): AIChatConversation[] {
  try {
    const raw = localStorage.getItem(AI_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((c: Record<string, unknown>) => ({
      ...c,
      createdAt: new Date(c.createdAt as string),
      updatedAt: new Date(c.updatedAt as string),
    }));
  } catch {
    return [];
  }
}

function saveAIChatConversationsToStorage(conversations: AIChatConversation[]) {
  try {
    localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // ignore
  }
}

function loadAIChatMessagesFromStorage(conversationId: string): AIChatMessage[] {
  try {
    const raw = localStorage.getItem(AI_CHAT_MESSAGES_PREFIX + conversationId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((m: Record<string, unknown>) => ({
      ...m,
      timestamp: new Date(m.timestamp as string),
    }));
  } catch {
    return [];
  }
}

function saveAIChatMessagesToStorage(conversationId: string, messages: AIChatMessage[]) {
  try {
    localStorage.setItem(
      AI_CHAT_MESSAGES_PREFIX + conversationId,
      JSON.stringify(messages)
    );
  } catch {
    // ignore
  }
}

function generateAIId(): string {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function computeAIForensicHash(
  entry: Omit<ForensicLogEntry, "hash">
): Promise<string> {
  const payload = JSON.stringify({
    seq: entry.sequenceNumber,
    prev: entry.previousHash,
    event: entry.event,
    timestamp: entry.timestamp,
  });

  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for environments without crypto API
  return `hash_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useAIAnalysisStore = create<AIAnalysisState>()(
  persist(
    (set, get) => ({
      // Navigation
      activeSubTab: 'chat',

      // Sub-states with initial values
      aiChat: {
        conversations: [],
        currentConversationId: null,
        messages: [],
        loading: false,
        sending: false,
      },

      aiDebate: {
        debate: null,
        showingSetup: false,
        debateHidden: false,
        isRunning: false,
        isPaused: false,
        autoAdvance: true,
        currentPhase: "idle",
        activeAgentIndex: -1,
        sourceConversationId: null,
        history: [],
      },

      aiTest: {
        mode: 'unfiltered',
        source: 'local',
        echoConfig: {
          rounds: 5,
          poisonRound: 3,
          poisonAgent: 'd1',
        },
        currentRound: 0,
        question: '',
        poison: '',
        questionLocked: false,
        poisonLocked: false,
        responses: [],
        isRunning: false,
        poisonMarkers: [],
      },

      aiBatch: {
        batchRunning: false,
        batchPaused: false,
        batchId: '',
        batchSource: 'local',
        batchCurrentPass: 1,
        batchCurrentTest: 0,
        batchTotalTests: 0,
        batchRotation: [],
        batchPassLogs: [],
        batchActivity: '',
        batchLockedRotation: null,
        speedMode: 1,
        history: [],
        selectedBatchId: null,
      },

      aiForensic: {
        entries: [],
        sessions: [],
        showingForensicLog: false,
        currentView: "timeline",
        selectedSessionId: null,
        expandedEntryId: null,
        replayIndex: 0,
        replayPlaying: false,
        replaySpeed: 1500,
        filters: { severity: [], category: [], searchText: "", sessionId: null },
        chainValid: true,
        _seq: 0,
      },

      aiReview: {
        selectedBatchId: null,
        selectedTest: null,
        comparisonMode: false,
        comparedBatchIds: [],
      },

      // ========================================================================
      // GLOBAL ACTIONS
      // ========================================================================

      aiSetActiveSubTab: (tab) => set({ activeSubTab: tab }),

      // ========================================================================
      // AI CHAT ACTIONS
      // ========================================================================

      aiChatLoadConversations: async () => {
        set((state) => ({
          aiChat: { ...state.aiChat, loading: true },
        }));
        const conversations = loadAIChatConversationsFromStorage();
        set((state) => ({
          aiChat: { ...state.aiChat, conversations, loading: false },
        }));
      },

      aiChatCreateConversation: async (title?: string) => {
        const newTitle = title || "New AI Conversation";
        const now = new Date();
        const conversation: AIChatConversation = {
          id: generateAIId(),
          title: newTitle,
          messages: [],
          contextFiles: [],
          provider: "anthropic",
          model: "",
          createdAt: now,
          updatedAt: now,
        };
        const state = get();
        const updated = [conversation, ...state.aiChat.conversations];
        saveAIChatConversationsToStorage(updated);
        set({
          aiChat: {
            ...state.aiChat,
            conversations: updated,
            currentConversationId: conversation.id,
          },
        });
        return conversation.id;
      },

      aiChatDeleteConversation: async (id: string) => {
        const state = get();
        const updated = state.aiChat.conversations.filter((c) => c.id !== id);
        saveAIChatConversationsToStorage(updated);
        set({
          aiChat: {
            ...state.aiChat,
            conversations: updated,
            currentConversationId:
              state.aiChat.currentConversationId === id
                ? null
                : state.aiChat.currentConversationId,
          },
        });
      },

      aiChatUpdateConversationTitle: async (id: string, title: string) => {
        const state = get();
        const updated = state.aiChat.conversations.map((c) =>
          c.id === id ? { ...c, title, updatedAt: new Date() } : c
        );
        saveAIChatConversationsToStorage(updated);
        set({
          aiChat: { ...state.aiChat, conversations: updated },
        });
      },

      aiChatSetCurrent: (id: string | null) => {
        set((state) => ({
          aiChat: { ...state.aiChat, currentConversationId: id },
        }));
      },

      aiChatLoadMessages: async (conversationId: string) => {
        set((state) => ({
          aiChat: { ...state.aiChat, loading: true, messages: [] },
        }));
        const messages = loadAIChatMessagesFromStorage(conversationId);
        set((state) => ({
          aiChat: { ...state.aiChat, messages, loading: false },
        }));
      },

      aiChatAddMessage: async (message: AIChatMessage) => {
        const state = get();
        const updated = [...state.aiChat.messages, message];
        set({
          aiChat: { ...state.aiChat, messages: updated },
        });
        saveAIChatMessagesToStorage(message.conversationId, updated);
      },

      aiChatSendMessage: async (
        conversationId: string,
        prompt: string,
        provider: Provider,
        model: string
      ) => {
        const { aiChatAddMessage } = get();

        // Add user message
        const userMessage: AIChatMessage = {
          id: generateAIId(),
          conversationId,
          role: "user",
          content: prompt,
          provider,
          model,
          timestamp: new Date(),
        };
        await aiChatAddMessage(userMessage);

        // Auto-generate conversation title from first user message
        const state = get();
        const userMessages = state.aiChat.messages.filter((m) => m.role === "user");
        if (userMessages.length === 1) {
          const title = prompt
            .substring(0, 50)
            .trim()
            .replace(/[#*`_~]/g, "")
            .replace(/\s+/g, " ");
          const finalTitle = title.length < prompt.length ? title + "..." : title;
          get().aiChatUpdateConversationTitle(conversationId, finalTitle);
        }

        // Call API for assistant response
        set((state) => ({
          aiChat: { ...state.aiChat, sending: true },
        }));
        const startTime = Date.now();

        try {
          const allMessages = get().aiChat.messages;
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: allMessages, provider, model }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || `API error: ${res.status}`);
          }

          const latencyMs = Date.now() - startTime;

          const assistantMessage: AIChatMessage = {
            id: generateAIId(),
            conversationId,
            role: "assistant",
            content: data.content,
            provider,
            model,
            timestamp: new Date(),
            tokenCount: data.tokens,
            latencyMs,
          };
          await aiChatAddMessage(assistantMessage);
        } catch (err) {
          console.error("[AI Chat] Error:", err);
          const errorMessage: AIChatMessage = {
            id: generateAIId(),
            conversationId,
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Failed to get response"}`,
            provider,
            model,
            timestamp: new Date(),
          };
          await aiChatAddMessage(errorMessage);
        } finally {
          set((state) => ({
            aiChat: { ...state.aiChat, sending: false },
          }));
        }
      },

      aiChatClearMessages: () => {
        set((state) => ({
          aiChat: { ...state.aiChat, messages: [] },
        }));
      },

      // ========================================================================
      // AI DEBATE ACTIONS
      // ========================================================================

      aiDebateOpenSetup: () => {
        set((state) => ({
          aiDebate: { ...state.aiDebate, showingSetup: true },
        }));
      },

      aiDebateCloseSetup: () => {
        set((state) => ({
          aiDebate: {
            ...state.aiDebate,
            showingSetup: false,
            sourceConversationId: null,
          },
        }));
      },

      aiDebateHide: () => {
        set((state) => ({
          aiDebate: { ...state.aiDebate, debateHidden: true },
        }));
      },

      aiDebateShow: () => {
        set((state) => ({
          aiDebate: { ...state.aiDebate, debateHidden: false },
        }));
      },

      aiDebateSetSourceConversation: (id) =>
        set((state) => ({
          aiDebate: { ...state.aiDebate, sourceConversationId: id },
        })),

      aiDebateSetAutoAdvance: (auto) =>
        set((state) => ({
          aiDebate: { ...state.aiDebate, autoAdvance: auto },
        })),

      aiDebateStart: (topic, participants, judge, rounds) => {
        const state = get();
        const debate: Debate = {
          id: generateAIId(),
          topic,
          participants,
          judge,
          rounds,
          currentRound: 1,
          messages: [],
          critiques: [],
          roundSummaries: [],
          usedCitations: [],
          redirects: [],
          sourceConversationId: state.aiDebate.sourceConversationId ?? undefined,
          status: "running",
          createdAt: new Date(),
        };

        set({
          aiDebate: {
            ...state.aiDebate,
            debate,
            showingSetup: false,
          },
        });
      },

      aiDebateRunRound: async () => {
        const state = get();
        if (!state.aiDebate.debate || state.aiDebate.isRunning) return;
        if (
          state.aiDebate.debate.status === "completed" ||
          state.aiDebate.debate.status === "error"
        )
          return;

        set((s) => ({
          aiDebate: {
            ...s.aiDebate,
            isRunning: true,
            isPaused: false,
            currentPhase: "research",
          },
        }));

        // Simplified debate round logic (actual implementation would be more complex)
        try {
          // Phase 1: Research
          // Phase 2: Cross-check
          // Phase 3: Judging

          // Update round and check completion
          const currentState = get();
          const currentDebate = currentState.aiDebate.debate!;
          const nextRound = currentDebate.currentRound + 1;
          const isComplete = nextRound > currentDebate.rounds;

          set((s) => ({
            aiDebate: {
              ...s.aiDebate,
              debate: s.aiDebate.debate
                ? {
                    ...s.aiDebate.debate,
                    currentRound: isComplete
                      ? s.aiDebate.debate.currentRound
                      : nextRound,
                    status: isComplete ? "completed" : "running",
                    completedAt: isComplete ? new Date() : undefined,
                  }
                : null,
              isRunning: false,
              currentPhase: "idle",
              activeAgentIndex: -1,
            },
          }));

          // Auto-advance if enabled
          if (!isComplete && get().aiDebate.autoAdvance) {
            setTimeout(() => get().aiDebateRunRound(), 1000);
          }
        } catch (err) {
          console.error("[AI Debate] Error:", err);
          set((s) => ({
            aiDebate: {
              ...s.aiDebate,
              debate: s.aiDebate.debate
                ? { ...s.aiDebate.debate, status: "error" }
                : null,
              isRunning: false,
              currentPhase: "idle",
              activeAgentIndex: -1,
            },
          }));
        }
      },

      aiDebatePause: () => {
        set((s) => ({
          aiDebate: {
            ...s.aiDebate,
            isPaused: true,
            debate: s.aiDebate.debate
              ? { ...s.aiDebate.debate, status: "paused" }
              : null,
          },
        }));
      },

      aiDebateResume: () => {
        set((s) => ({
          aiDebate: {
            ...s.aiDebate,
            isPaused: false,
            debate: s.aiDebate.debate
              ? { ...s.aiDebate.debate, status: "running" }
              : null,
          },
        }));
        if (!get().aiDebate.isRunning) {
          get().aiDebateRunRound();
        }
      },

      aiDebateRedirect: (newPrompt) => {
        const state = get();
        if (!state.aiDebate.debate) return;

        set((s) => ({
          aiDebate: {
            ...s.aiDebate,
            debate: s.aiDebate.debate
              ? {
                  ...s.aiDebate.debate,
                  redirects: [...s.aiDebate.debate.redirects, newPrompt],
                }
              : null,
          },
        }));

        if (!state.aiDebate.isRunning) {
          get().aiDebateRunRound();
        }
      },

      aiDebateSwapJudge: (newJudge) => {
        const state = get();
        if (!state.aiDebate.debate || state.aiDebate.isRunning) return;
        set((s) => ({
          aiDebate: {
            ...s.aiDebate,
            debate: s.aiDebate.debate
              ? { ...s.aiDebate.debate, judge: newJudge }
              : null,
          },
        }));
      },

      aiDebateEnd: () => {
        const state = get();
        if (state.aiDebate.debate) {
          get().aiDebateSaveToHistory();
        }
        set((s) => ({
          aiDebate: {
            ...s.aiDebate,
            debate: null,
            showingSetup: false,
            debateHidden: false,
            isRunning: false,
            isPaused: false,
            currentPhase: "idle",
            activeAgentIndex: -1,
            sourceConversationId: null,
          },
        }));
      },

      aiDebateSaveToHistory: () => {
        const state = get();
        if (!state.aiDebate.debate) return;
        set((s) => ({
          aiDebate: {
            ...s.aiDebate,
            history: [...s.aiDebate.history, s.aiDebate.debate!],
          },
        }));
      },

      // ========================================================================
      // AI TEST ACTIONS
      // ========================================================================

      aiTestSetMode: (mode) =>
        set((state) => ({
          aiTest: { ...state.aiTest, mode },
        })),

      aiTestSetSource: (source) =>
        set((state) => ({
          aiTest: { ...state.aiTest, source },
        })),

      aiTestSetQuestion: (question) =>
        set((state) => ({
          aiTest: { ...state.aiTest, question },
        })),

      aiTestSetPoison: (poison) =>
        set((state) => ({
          aiTest: { ...state.aiTest, poison },
        })),

      aiTestSetQuestionLocked: (locked) =>
        set((state) => ({
          aiTest: { ...state.aiTest, questionLocked: locked },
        })),

      aiTestSetPoisonLocked: (locked) =>
        set((state) => ({
          aiTest: { ...state.aiTest, poisonLocked: locked },
        })),

      aiTestSetEchoConfig: (config) =>
        set((state) => ({
          aiTest: { ...state.aiTest, echoConfig: config },
        })),

      aiTestRunTest: async () => {
        set((state) => ({
          aiTest: { ...state.aiTest, isRunning: true, responses: [] },
        }));

        try {
          // Simplified test run logic
          // Actual implementation would include full debate simulation

          set((state) => ({
            aiTest: { ...state.aiTest, isRunning: false },
          }));
        } catch (err) {
          console.error("[AI Test] Error:", err);
          set((state) => ({
            aiTest: { ...state.aiTest, isRunning: false },
          }));
        }
      },

      aiTestStopTest: () => {
        set((state) => ({
          aiTest: { ...state.aiTest, isRunning: false },
        }));
      },

      aiTestClearResults: () => {
        set((state) => ({
          aiTest: { ...state.aiTest, responses: [], currentRound: 0 },
        }));
      },

      // ========================================================================
      // AI BATCH HELPER FUNCTIONS
      // ========================================================================
      // AI FORENSIC ACTIONS
      // ========================================================================

      aiForensicOpenLog: () =>
        set((state) => ({
          aiForensic: { ...state.aiForensic, showingForensicLog: true },
        })),

      aiForensicCloseLog: () =>
        set((state) => ({
          aiForensic: { ...state.aiForensic, showingForensicLog: false },
        })),

      aiForensicSetCurrentView: (view) =>
        set((state) => ({
          aiForensic: { ...state.aiForensic, currentView: view },
        })),

      aiForensicSetSelectedSession: (id) =>
        set((state) => ({
          aiForensic: {
            ...state.aiForensic,
            selectedSessionId: id,
            replayIndex: 0,
          },
        })),

      aiForensicSetExpandedEntry: (id) =>
        set((state) => ({
          aiForensic: { ...state.aiForensic, expandedEntryId: id },
        })),

      aiForensicCaptureEntry: async (params) => {
        const state = get();
        const seq = state.aiForensic._seq;
        const lastEntry =
          state.aiForensic.entries[state.aiForensic.entries.length - 1];
        const previousHash = lastEntry?.hash ?? "GENESIS";

        const retentionDate = new Date();
        retentionDate.setFullYear(retentionDate.getFullYear() + 7);

        const defaults = {
          aiDecision: {
            action: params.event || "N/A",
            confidence: 0,
            modelVersion: "N/A",
            explanation: "N/A",
            factors: [] as string[],
            thresholds: {} as Record<string, string>,
          },
          medicationContext: {
            drugName: "N/A",
            prescribedDose: "N/A",
            administeredDose: "N/A",
            variance: "N/A",
          },
          actors: {
            aiSystem: "AI_Analysis",
            humanUsers: [] as string[],
            overrideOccurred: false,
            overrideReason: "N/A",
          },
          dataLineage: {
            sources: ["AI Analysis Module"],
            transformations: [] as string[],
            validationChecks: [],
          },
          compliance: {
            regulations: ["EU AI Act", "FDA SaMD", "NIST AI RMF"],
            retentionUntil: retentionDate.toISOString().slice(0, 10),
            auditReady: true,
          },
        };

        const partial: Omit<ForensicLogEntry, "hash"> = {
          id: generateAIId(),
          sequenceNumber: seq,
          timestamp: new Date().toISOString(),
          previousHash,
          ...defaults,
          ...params,
        };

        const hash = await computeAIForensicHash(partial);
        const entry: ForensicLogEntry = { ...partial, hash };

        set((s) => ({
          aiForensic: {
            ...s.aiForensic,
            entries: [...s.aiForensic.entries, entry],
            _seq: s.aiForensic._seq + 1,
            sessions: s.aiForensic.sessions.map((sess) =>
              sess.id === params.sessionId
                ? { ...sess, entryCount: sess.entryCount + 1 }
                : sess
            ),
          },
        }));
      },

      aiForensicStartSession: (config, type) => {
        const id = generateAIId();
        const session: ForensicSession = {
          id,
          type,
          startTime: new Date().toISOString(),
          config,
          entryCount: 0,
        };
        set((s) => ({
          aiForensic: {
            ...s.aiForensic,
            sessions: [...s.aiForensic.sessions, session],
          },
        }));
        return id;
      },

      aiForensicEndSession: (sessionId, verdict) => {
        set((s) => ({
          aiForensic: {
            ...s.aiForensic,
            sessions: s.aiForensic.sessions.map((sess) =>
              sess.id === sessionId
                ? { ...sess, endTime: new Date().toISOString(), verdict }
                : sess
            ),
          },
        }));
      },

      aiForensicSetReplayIndex: (i) =>
        set((state) => ({
          aiForensic: { ...state.aiForensic, replayIndex: i },
        })),

      aiForensicReplayNext: () => {
        const state = get();
        const sessionEntries = state.aiForensic.selectedSessionId
          ? state.aiForensic.entries.filter(
              (e) => e.sessionId === state.aiForensic.selectedSessionId
            )
          : state.aiForensic.entries;
        if (state.aiForensic.replayIndex < sessionEntries.length - 1) {
          set((s) => ({
            aiForensic: {
              ...s.aiForensic,
              replayIndex: s.aiForensic.replayIndex + 1,
            },
          }));
        } else {
          get().aiForensicStopReplay();
        }
      },

      aiForensicReplayPrev: () => {
        const state = get();
        if (state.aiForensic.replayIndex > 0) {
          set((s) => ({
            aiForensic: {
              ...s.aiForensic,
              replayIndex: s.aiForensic.replayIndex - 1,
            },
          }));
        }
      },

      aiForensicToggleReplayPlay: () => {
        const state = get();
        if (state.aiForensic.replayPlaying) {
          set((s) => ({
            aiForensic: { ...s.aiForensic, replayPlaying: false },
          }));
        } else {
          set((s) => ({
            aiForensic: { ...s.aiForensic, replayPlaying: true },
          }));
          // Start replay interval
          const interval = setInterval(
            () => get().aiForensicReplayNext(),
            state.aiForensic.replaySpeed
          );
          // Note: In real implementation, store interval ID to clear it
        }
      },

      aiForensicSetReplaySpeed: (ms) =>
        set((state) => ({
          aiForensic: { ...state.aiForensic, replaySpeed: ms },
        })),

      aiForensicStopReplay: () =>
        set((state) => ({
          aiForensic: { ...state.aiForensic, replayPlaying: false },
        })),

      aiForensicSetFilters: (f) =>
        set((state) => ({
          aiForensic: {
            ...state.aiForensic,
            filters: { ...state.aiForensic.filters, ...f },
          },
        })),

      aiForensicGetFilteredEntries: () => {
        const state = get();
        let result = state.aiForensic.entries;
        const filters = state.aiForensic.filters;

        if (filters.sessionId) {
          result = result.filter((e) => e.sessionId === filters.sessionId);
        }
        if (filters.severity.length > 0) {
          result = result.filter((e) => filters.severity.includes(e.severity));
        }
        if (filters.category.length > 0) {
          result = result.filter((e) => filters.category.includes(e.category));
        }
        if (filters.searchText) {
          const q = filters.searchText.toLowerCase();
          result = result.filter(
            (e) =>
              e.event.toLowerCase().includes(q) ||
              e.input?.toLowerCase().includes(q) ||
              e.output?.toLowerCase().includes(q)
          );
        }
        return result;
      },

      aiForensicGetSessionEntries: (sessionId) => {
        return get().aiForensic.entries.filter((e) => e.sessionId === sessionId);
      },

      aiForensicExportJSON: () => {
        const state = get();
        const report = {
          exportDate: new Date().toISOString(),
          totalEntries: state.aiForensic.entries.length,
          totalSessions: state.aiForensic.sessions.length,
          sessions: state.aiForensic.sessions,
          entries: state.aiForensic.entries,
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ai-analysis-forensic-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },

      aiForensicClearAll: () => {
        set((state) => ({
          aiForensic: {
            ...state.aiForensic,
            entries: [],
            sessions: [],
            _seq: 0,
            chainValid: true,
            selectedSessionId: null,
            replayIndex: 0,
            replayPlaying: false,
            expandedEntryId: null,
          },
        }));
      },

      // ========================================================================
      // AI REVIEW ACTIONS
      // ========================================================================

      aiReviewSelectBatch: (batchId) =>
        set((state) => ({
          aiReview: { ...state.aiReview, selectedBatchId: batchId },
        })),

      aiReviewSelectTest: (test) =>
        set((state) => ({
          aiReview: { ...state.aiReview, selectedTest: test },
        })),

      aiReviewToggleComparison: () =>
        set((state) => ({
          aiReview: {
            ...state.aiReview,
            comparisonMode: !state.aiReview.comparisonMode,
          },
        })),

      aiReviewAddComparedBatch: (batchId) => {
        const state = get();
        if (!state.aiReview.comparedBatchIds.includes(batchId)) {
          set({
            aiReview: {
              ...state.aiReview,
              comparedBatchIds: [...state.aiReview.comparedBatchIds, batchId],
            },
          });
        }
      },

      aiReviewRemoveComparedBatch: (batchId) =>
        set((state) => ({
          aiReview: {
            ...state.aiReview,
            comparedBatchIds: state.aiReview.comparedBatchIds.filter(
              (id) => id !== batchId
            ),
          },
        })),

      aiReviewClearComparisons: () =>
        set((state) => ({
          aiReview: { ...state.aiReview, comparedBatchIds: [] },
        })),
    }),
    {
      name: "ai-analysis-storage",
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        activeSubTab: state.activeSubTab,
        aiChat: {
          conversations: state.aiChat.conversations,
          currentConversationId: state.aiChat.currentConversationId,
          messages: state.aiChat.messages ?? [],
          loading: state.aiChat.loading ?? false,
          sending: state.aiChat.sending ?? false,
        },
        aiDebate: {
          autoAdvance: state.aiDebate.autoAdvance,
          history: state.aiDebate.history.slice(-10), // Keep last 10 debates
        },
        aiTest: {
          mode: state.aiTest.mode,
          source: state.aiTest.source,
          echoConfig: state.aiTest.echoConfig,
        },
        aiBatch: {
          speedMode: state.aiBatch.speedMode,
          history: state.aiBatch.history.slice(-20), // Keep last 20 batch runs
          selectedBatchId: state.aiBatch.selectedBatchId,
        },
        aiForensic: {
          entries: state.aiForensic.entries.slice(-500), // Keep last 500 entries
          sessions: state.aiForensic.sessions,
          _seq: state.aiForensic._seq,
          chainValid: state.aiForensic.chainValid,
        },
        aiReview: {
          selectedBatchId: state.aiReview.selectedBatchId,
          comparisonMode: state.aiReview.comparisonMode,
          comparedBatchIds: state.aiReview.comparedBatchIds,
        },
      }),
    }
  )
);
