"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useMessageStore } from "@/lib/stores/messageStore";
import { useRoleStore } from "@/lib/stores/roleStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { providers } from "@/lib/providers";
import { fetchOllamaModels, fetchLMStudioModels, type LocalModel } from "@/lib/providers/localModels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportDebateSummaryToPDF, exportDebateThreadToPDF } from "@/lib/export/pdf";
import { exportDebateToCSV } from "@/lib/export/csv";
import { cn } from "@/lib/utils";
import type { Provider, DebateParticipant, Message, Critique, RoundSummary, Debate } from "@/lib/types";
import {
  Swords,
  FileText,
  Download,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Copy,
  Check,
  Scale,
  Brain,
  ArrowRight,
  BookmarkPlus,
  Maximize2,
  Terminal,
  Send,
  Zap,
  Loader2,
  Code2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useBuilderChatStore } from "@/lib/stores/builderChatStore";
import { CollapsibleRow } from "./CollapsibleRow";
import { ExecutiveSummaryModal } from "./ExecutiveSummaryModal";
import { DebateHistory } from "./DebateHistory";
import { useAIModeStore } from "@/lib/stores/aiModeStore";
import Link from "next/link";

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Calculate the starting index for a debate round's research messages.
 * Accounts for judge messages interleaved between rounds.
 *
 * Message ordering: [R1 agents...] [R1 judge] [R2 agents...] [R2 judge] ...
 *
 * @param round - The 1-indexed round number
 * @param participantCount - Number of debate participants (not including judge)
 * @param roundSummariesCount - Number of judge summaries created so far
 * @returns The starting index in the messages array for this round's research
 */
function getResearchStartIndex(round: number, participantCount: number, roundSummariesCount: number): number {
  const completedRoundsBefore = round - 1;
  const judgeMessagesBefore = Math.min(completedRoundsBefore, roundSummariesCount);
  return (round - 1) * participantCount + judgeMessagesBefore;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AGENT_COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#ef4444"];
const AGENT_LABEL_COLORS = [
  "text-indigo-600 dark:text-indigo-400",
  "text-purple-600 dark:text-purple-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-rose-600 dark:text-rose-400",
];
const AGENT_BG_COLORS = [
  "border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/20",
  "border-purple-500/30 bg-purple-50 dark:bg-purple-950/20",
  "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20",
  "border-rose-500/30 bg-rose-50 dark:bg-rose-950/20",
];

interface SlotConfig {
  provider: Provider | null;
  model: string;
  roleId?: string;
}

const emptySlot = (): SlotConfig => ({ provider: null, model: "", roleId: undefined });

function getProviderName(provider: string): string {
  return providers.find((p) => p.id === provider)?.name ?? provider;
}

// ─── Copy button helper ─────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      title={label || "Copy"}
      className="rounded p-1 text-zinc-500 dark:text-zinc-500 hover:text-zinc-300 hover:bg-zinc-300 dark:bg-zinc-700/50 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Animated dots ──────────────────────────────────────────────────────────

function AnimatedDots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 py-4 justify-center">
      <span className="inline-flex gap-0.5">
        <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
        <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
        <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
      </span>
      {label}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DebateView() {
  const {
    debate,
    isRunning,
    isPaused,
    autoAdvance,
    currentPhase,
    activeAgentIndex,
    showingSetup,
    startDebate,
    startQuickDebate,
    runRound,
    pauseDebate,
    resumeDebate,
    redirectDebate,
    swapJudge,
    setAutoAdvance,
    saveToKnowledge,
    endDebate,
    closeSetup,
    hideDebate,
    endDebateToThread,
    sourceConversationId,
  } = useDebateStore();

  const { roles, hydrated: rolesHydrated, hydrate: hydrateRoles } = useRoleStore();

  const debateSidebarCollapsed = useUIStore((s) => s.debateSidebarCollapsed);
  const toggleDebateSidebar = useUIStore((s) => s.toggleDebateSidebar);
  const setDebateSidebarCollapsed = useUIStore((s) => s.setDebateSidebarCollapsed);
  const llmSectionCollapsed = useUIStore((s) => s.llmSectionCollapsed);
  const setLlmSectionCollapsed = useUIStore((s) => s.setLlmSectionCollapsed);
  const showToast = useUIStore((s) => s.showToast);

  // AI Mode store
  const aiModeDisplayName = useAIModeStore((s) => s.getDisplayName);
  const executionMode = useAIModeStore((s) => s.executionMode);

  // Builder integration
  const router = useRouter();
  const setPrefilledInput = useBuilderChatStore((s) => s.setPrefilledInput);

  // Handler for sending agent response to Builder
  const handleSendToBuilder = useCallback((content: string) => {
    const prefillText = `Based on the debate agent's suggestion, build: ${content.slice(0, 800)}${content.length > 800 ? '...' : ''}`;
    setPrefilledInput(prefillText);
    endDebate();
    router.push('/builder');
  }, [setPrefilledInput, endDebate, router]);

  // ─── Setup state ────────────────────────────────────────────────
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(3);
  const [slots, setSlots] = useState<[SlotConfig, SlotConfig, SlotConfig, SlotConfig]>([
    emptySlot(),
    emptySlot(),
    emptySlot(),
    { provider: null, model: "", roleId: "default-judge" },
  ]);
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [lmstudioModels, setLmstudioModels] = useState<LocalModel[]>([]);
  const [lmstudioLoading, setLmstudioLoading] = useState(false);

  // ─── Pre-fill topic from thread when sourceConversationId is set ─
  const threadMessages = useMessageStore((s) => s.messages);
  useEffect(() => {
    // Only prefill if we have a source conversation and topic is empty
    if (!sourceConversationId || topic) return;
    const recent = threadMessages.slice(-8);
    if (recent.length === 0) return;
    const formatted = recent
      .map((m) => `[${m.role === "user" ? "User" : "Assistant"}]: ${m.content}`)
      .join("\n\n");
    setTopic(`Debate the following discussion:\n\n${formatted}`);
  }, [sourceConversationId, threadMessages, topic]);

  // ─── Debate interaction state ───────────────────────────────────
  const [redirectInput, setRedirectInput] = useState("");
  const [showRedirect, setShowRedirect] = useState(false);
  const [showJudgeSwap, setShowJudgeSwap] = useState(false);
  const [judgeSwapSlot, setJudgeSwapSlot] = useState<SlotConfig>({ provider: null, model: "", roleId: "default-judge" });
  const [savedToMemory, setSavedToMemory] = useState(false);
  const [showExecModal, setShowExecModal] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [debateCopied, setDebateCopied] = useState(false);
  const [quickInput, setQuickInput] = useState("");
  const [quickDebateLoading, setQuickDebateLoading] = useState(false);
  const [quickDebateUseLocal, setQuickDebateUseLocal] = useState(true);

  // ─── Hydrate roles + fetch ollama ───────────────────────────────
  useEffect(() => {
    if (!rolesHydrated) hydrateRoles();
  }, [rolesHydrated, hydrateRoles]);

  useEffect(() => {
    setOllamaLoading(true);
    fetchOllamaModels()
      .then(setOllamaModels)
      .catch(() => setOllamaModels([]))
      .finally(() => setOllamaLoading(false));

    setLmstudioLoading(true);
    fetchLMStudioModels()
      .then(setLmstudioModels)
      .catch(() => setLmstudioModels([]))
      .finally(() => setLmstudioLoading(false));
  }, []);

  // ─── Setup helpers ──────────────────────────────────────────────
  const updateSlot = (index: number, updates: Partial<SlotConfig>) => {
    setSlots((prev) => {
      const next = [...prev] as typeof prev;
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleProviderChange = (index: number, providerId: string) => {
    if (!providerId) {
      updateSlot(index, { provider: null, model: "", roleId: index === 3 ? "default-judge" : undefined });
      return;
    }
    const prov = providers.find((p) => p.id === providerId);
    let defaultModel = "";

    if (providerId === "lmstudio") {
      defaultModel = lmstudioModels[0]?.id ?? "";
    } else if (prov?.type === "local") {
      defaultModel = ollamaModels[0]?.id ?? "";
    } else {
      defaultModel = prov?.models[0]?.id ?? "";
    }
    updateSlot(index, { provider: providerId as Provider, model: defaultModel });
  };

  const agentCount = slots.slice(0, 3).filter((s) => s.provider).length;
  const hasJudge = slots[3].provider !== null;
  const isValid = topic.trim() && agentCount >= 2 && hasJudge;

  const handleStart = async () => {
    if (!isValid) return;
    const participants: DebateParticipant[] = slots
      .slice(0, 3)
      .filter((s) => s.provider)
      .map((s) => ({ provider: s.provider!, model: s.model, roleId: s.roleId }));
    const judge: DebateParticipant = {
      provider: slots[3].provider!,
      model: slots[3].model,
      roleId: slots[3].roleId || "default-judge",
    };
    startDebate(topic.trim(), participants, judge, rounds);
    // Auto-collapse sidebar when debate starts
    setDebateSidebarCollapsed(true);
    // Auto-start Round 1 immediately
    await runRound();
  };

  const handleQuickDebate = async () => {
    if (!topic.trim()) return;
    setQuickDebateLoading(true);
    setDebateSidebarCollapsed(true);
    setLlmSectionCollapsed(true);
    try {
      const modelIds = ollamaModels.map((m) => m.id);
      await startQuickDebate(topic.trim(), quickDebateUseLocal, modelIds);
    } finally {
      setQuickDebateLoading(false);
    }
  };

  // Auto-collapse sidebar and LLM section when debate starts
  useEffect(() => {
    if (debate && !showingSetup) {
      setDebateSidebarCollapsed(true);
      setLlmSectionCollapsed(true);
    }
  }, [debate, showingSetup, setDebateSidebarCollapsed, setLlmSectionCollapsed]);

  const handleRedirectSubmit = () => {
    if (!redirectInput.trim()) return;
    redirectDebate(redirectInput.trim());
    setRedirectInput("");
    setShowRedirect(false);
  };

  const handleJudgeSwap = () => {
    if (!judgeSwapSlot.provider) return;
    swapJudge({
      provider: judgeSwapSlot.provider,
      model: judgeSwapSlot.model,
      roleId: judgeSwapSlot.roleId || "default-judge",
    });
    setShowJudgeSwap(false);
  };

  const handleSaveToMemory = () => {
    saveToKnowledge();
    setSavedToMemory(true);
    setTimeout(() => setSavedToMemory(false), 3000);
  };

  const handleCopyExecSummary = useCallback(async () => {
    if (!debate?.executiveSummary) return;
    try {
      await navigator.clipboard.writeText(debate.executiveSummary);
    } catch { /* ignore */ }
  }, [debate?.executiveSummary]);

  const handleCopyDebate = useCallback(async () => {
    if (!debate || debate.messages.length === 0) return;

    let transcript = `DEBATE: ${debate.topic}\n`;
    transcript += `${"=".repeat(50)}\n\n`;

    for (let round = 1; round <= debate.rounds; round++) {
      const roundCritiques = debate.critiques.filter((c) => c.round === round);
      const roundSummary = debate.roundSummaries.find((rs) => rs.round === round);
      const participantCount = debate.participants.length;
      const researchStartIdx = getResearchStartIndex(round, participantCount, debate.roundSummaries.length);

      transcript += `ROUND ${round}\n`;
      transcript += `${"-".repeat(30)}\n\n`;

      // Research phase
      transcript += "** Research Phase **\n\n";
      debate.participants.forEach((participant, pIdx) => {
        const msg = debate.messages[researchStartIdx + pIdx];
        if (msg) {
          transcript += `[Agent ${pIdx + 1} - ${getProviderName(participant.provider)}/${participant.model}]\n`;
          transcript += `${msg.content}\n\n`;
        }
      });

      // Cross-check phase
      if (roundCritiques.length > 0) {
        transcript += "** Cross-Check Phase **\n\n";
        roundCritiques.forEach((critique) => {
          const participant = debate.participants[critique.fromParticipantIndex];
          if (!participant) return; // Skip invalid participant references
          transcript += `[Agent ${critique.fromParticipantIndex + 1} - ${getProviderName(participant.provider)}/${participant.model}]\n`;
          transcript += `${critique.content}\n\n`;
        });
      }

      // Judge summary
      if (roundSummary) {
        transcript += "** Judge Summary **\n";
        transcript += `[${getProviderName(debate.judge.provider)}/${debate.judge.model}]\n`;
        transcript += `${roundSummary.summary}\n`;
        if (roundSummary.agreements && roundSummary.agreements.length > 0) {
          transcript += "\nConsensus Points:\n";
          roundSummary.agreements.forEach((a: any) => {
            transcript += `- [${a.consensusLevel}] ${a.statement}\n`;
          });
        }
        transcript += "\n";
      }

      transcript += "\n";
    }

    // Executive summary
    if (debate.executiveSummary) {
      transcript += `${"=".repeat(50)}\n`;
      transcript += "EXECUTIVE SUMMARY\n";
      transcript += `${"=".repeat(50)}\n\n`;
      transcript += debate.executiveSummary;
    }

    try {
      await navigator.clipboard.writeText(transcript);
      setDebateCopied(true);
      setTimeout(() => setDebateCopied(false), 2000);
    } catch { /* ignore */ }
  }, [debate]);

  const handleToggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev);
  }, []);

  const handleQuickInput = () => {
    if (!quickInput.trim() || !debate || isRunning || isComplete) return;
    redirectDebate(quickInput.trim());
    setQuickInput("");
  };

  const agentRoles = roles.filter((r) => !r.isDefault);
  const slotLabels = ["Agent 1", "Agent 2", "Agent 3 (Optional)", "Judge"];

  // ─── Render model select for a slot ─────────────────────────────
  const renderModelSelect = (slot: SlotConfig, index: number, onChange: (model: string) => void) => {
    if (!slot.provider) return null;
    const prov = providers.find((p) => p.id === slot.provider);
    const isLocal = prov?.type === "local";

    // Handle LM Studio separately
    if (slot.provider === "lmstudio") {
      if (lmstudioLoading) return <p className="px-1 text-[10px] text-zinc-500 dark:text-zinc-500">Loading...</p>;
      if (lmstudioModels.length === 0) return <p className="px-1 text-[10px] text-red-400">No models</p>;
      return (
        <select
          value={slot.model}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded bg-zinc-300 dark:bg-zinc-700 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 border-0 focus:ring-1 focus:ring-indigo-500"
        >
          {lmstudioModels.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      );
    }

    // Handle Ollama
    if (isLocal) {
      if (ollamaLoading) return <p className="px-1 text-[10px] text-zinc-500 dark:text-zinc-500">Loading...</p>;
      if (ollamaModels.length === 0) return <p className="px-1 text-[10px] text-red-400">No models</p>;
      return (
        <select
          value={slot.model}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded bg-zinc-300 dark:bg-zinc-700 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 border-0 focus:ring-1 focus:ring-indigo-500"
        >
          {ollamaModels.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      );
    }

    // Handle cloud providers
    return (
      <select
        value={slot.model}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded bg-zinc-300 dark:bg-zinc-700 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 border-0 focus:ring-1 focus:ring-indigo-500"
      >
        {prov?.models.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    );
  };

  const isComplete = debate?.status === "completed";

  // ═══════════════════════════════════════════════════════════════════
  // UNIFIED VIEW
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT: TWO-COLUMN LAYOUT (Left Sidebar + Right Content)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">
        {/* ─── LEFT SIDEBAR: Input Controls ─────────────────────────── */}
        {debateSidebarCollapsed ? (
          // COLLAPSED SIDEBAR - Thin vertical bar with icon buttons
          <div className="w-16 border-r border-zinc-300 dark:border-zinc-800 p-2 space-y-2 overflow-y-auto flex flex-col items-center">
            {/* Expand button */}
            <button
              onClick={toggleDebateSidebar}
              className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                Expand Sidebar
              </span>
            </button>

            {debate && (
              <>
                <div className="h-px w-full bg-zinc-300 dark:bg-zinc-700" />

                {/* Run Round / Play button */}
                {!isRunning && !isComplete && (
                  <button
                    onClick={runRound}
                    className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors"
                  >
                    <Play className="h-4 w-4 text-white" />
                    <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                      Run Round {debate.currentRound}
                    </span>
                  </button>
                )}

                {/* Pause button */}
                {isRunning && !isPaused && (
                  <button
                    onClick={pauseDebate}
                    className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-amber-700 hover:border-amber-600 transition-colors"
                  >
                    <Pause className="h-4 w-4 text-amber-400" />
                    <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                      Pause
                    </span>
                  </button>
                )}

                {/* Resume button */}
                {isPaused && (
                  <button
                    onClick={resumeDebate}
                    className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-emerald-700 hover:border-emerald-600 transition-colors"
                  >
                    <Play className="h-4 w-4 text-emerald-400" />
                    <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                      Resume
                    </span>
                  </button>
                )}

                {/* Redirect button */}
                {!isRunning && !isComplete && (
                  <button
                    onClick={() => setShowRedirect((v) => !v)}
                    className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-600 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                      Redirect
                    </span>
                  </button>
                )}

                {/* Swap Judge button */}
                {!isRunning && !isComplete && (
                  <button
                    onClick={() => setShowJudgeSwap((v) => !v)}
                    className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-600 transition-colors"
                  >
                    <Scale className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                      Swap Judge
                    </span>
                  </button>
                )}

                {/* Export Summary button */}
                <button
                  onClick={() => {
                    exportDebateSummaryToPDF(debate as any);
                    showToast({ message: "Exported debate summary as PDF", type: "success" });
                  }}
                  disabled={!debate.executiveSummary}
                  className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-30"
                >
                  <FileText className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                    Export Summary
                  </span>
                </button>

                {/* Export Thread button */}
                <button
                  onClick={() => {
                    exportDebateThreadToPDF(debate as any);
                    showToast({ message: "Exported debate thread as PDF", type: "success" });
                  }}
                  disabled={debate.messages.length === 0}
                  className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-30"
                >
                  <Download className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                    Export Thread
                  </span>
                </button>

                <div className="h-px w-full bg-zinc-300 dark:bg-zinc-700" />

                {/* End Debate button */}
                <button
                  onClick={endDebate}
                  className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-red-700 hover:border-red-600 transition-colors"
                >
                  <X className="h-4 w-4 text-red-400" />
                  <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                    End Debate
                  </span>
                </button>

                {/* Back to Workbench button */}
                <button
                  onClick={hideDebate}
                  className="relative group w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 border border-indigo-700 hover:border-indigo-600 transition-colors"
                >
                  <Terminal className="h-4 w-4 text-indigo-400" />
                  <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                    Back to Workbench
                  </span>
                </button>

                <div className="flex-1" />

                {/* Bottom section - Progress visuals */}
                <div className="space-y-2 w-full">
                  <div className="h-px w-full bg-zinc-300 dark:bg-zinc-700" />

                  {/* Current round */}
                  <div className="relative group flex flex-col items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 p-2">
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500">R</span>
                    <span className="text-sm font-bold text-indigo-400">{debate.currentRound}</span>
                    <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                      Round {debate.currentRound} of {debate.rounds}
                    </span>
                  </div>

                  {/* Phase indicator */}
                  {currentPhase && (
                    <div className="relative group flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 p-2">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {currentPhase === "research" ? "R" : currentPhase === "cross-check" ? "C" : "J"}
                      </span>
                      <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                        {currentPhase}
                      </span>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="relative group flex items-center justify-center rounded-lg p-2">
                    {isRunning && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                          Running
                        </span>
                      </>
                    )}
                    {isPaused && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                          Paused
                        </span>
                      </>
                    )}
                    {isComplete && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs text-white z-50">
                          Complete
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          // EXPANDED SIDEBAR - Narrower with all controls
          <div className="w-64 border-r border-zinc-300 dark:border-zinc-800 p-3 space-y-1.5 flex flex-col h-full">
            {/* Header with collapse button and AI mode pill */}
            <div className="flex items-center justify-between">
              {/* AI Mode Quick Toggle */}
              <Link
                href="/settings"
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all",
                  "hover:ring-1 hover:ring-zinc-500",
                  executionMode === "local" && "bg-emerald-500/20 text-emerald-500 dark:text-emerald-400",
                  executionMode === "cloud" && "bg-violet-500/20 text-violet-500 dark:text-violet-400",
                  executionMode === "hybrid" && "bg-amber-500/20 text-amber-500 dark:text-amber-400"
                )}
                title="AI Orchestration Mode"
              >
                <Zap className="h-2.5 w-2.5" />
                {aiModeDisplayName()}
              </Link>

              {/* Collapse button */}
              <button
                onClick={toggleDebateSidebar}
                className="h-7 flex items-center justify-end px-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-xs text-zinc-600 dark:text-zinc-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Rounds selector - only show in setup mode (no debate yet) */}
            {!debate && (
              <>
                <div className="h-px bg-zinc-300 dark:bg-zinc-700" />
                <div className="space-y-1">
                  <label className="block px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                    Rounds
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setRounds(n)}
                        className={cn(
                          "rounded px-2 py-1 text-xs font-semibold transition-colors",
                          rounds === n
                            ? "bg-indigo-600 text-white"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-zinc-300 dark:bg-zinc-700" />
              </>
            )}

            {/* All controls - always visible, disabled when not applicable */}

            {/* Run Round button - also starts debate if none exists */}
            <Button
              onClick={!debate ? handleStart : runRound}
              disabled={!debate ? !isValid : (isRunning || isComplete)}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 h-7 text-xs font-bold px-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="h-3 w-3 mr-1" />
              {!debate ? "Start Debate" : `Run Round ${debate.currentRound}`}
            </Button>

            {/* Quick Debate button - only show when no debate active */}
            {!debate && !quickDebateLoading && (
              <div className="space-y-1">
                <Button
                  onClick={handleQuickDebate}
                  disabled={!topic.trim() || quickDebateLoading}
                  className="w-full bg-cyan-600 text-white hover:bg-cyan-700 h-7 text-xs font-bold px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Quick Debate This
                </Button>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setQuickDebateUseLocal(true)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded transition-colors",
                      quickDebateUseLocal
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                        : "text-zinc-500 hover:text-zinc-400"
                    )}
                  >
                    Local
                  </button>
                  <button
                    onClick={() => setQuickDebateUseLocal(false)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded transition-colors",
                      !quickDebateUseLocal
                        ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/50"
                        : "text-zinc-500 hover:text-zinc-400"
                    )}
                  >
                    Cloud
                  </button>
                </div>
              </div>
            )}

            {/* Quick Debate Progress Indicator */}
            {quickDebateLoading && (
              <div className="rounded-lg border border-cyan-500/50 bg-cyan-950/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                  <span className="text-xs font-bold text-cyan-400">Quick Debate Running</span>
                </div>
                <div className="text-[11px] text-cyan-300/80">
                  {currentPhase === "research" && activeAgentIndex >= 0 && (
                    <span>Agent {activeAgentIndex + 1} of {debate?.participants.length || 3} researching...</span>
                  )}
                  {currentPhase === "cross-check" && activeAgentIndex >= 0 && (
                    <span>Agent {activeAgentIndex + 1} cross-checking...</span>
                  )}
                  {currentPhase === "judging" && (
                    <span>Judge summarizing...</span>
                  )}
                  {currentPhase === "idle" && !debate && (
                    <span>Starting debate...</span>
                  )}
                  {currentPhase === "idle" && debate && (
                    <span>Generating executive summary...</span>
                  )}
                </div>
                <div className="h-1.5 bg-cyan-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-500"
                    style={{
                      width: currentPhase === "judging"
                        ? "90%"
                        : currentPhase === "cross-check"
                          ? `${50 + ((activeAgentIndex + 1) / (debate?.participants.length || 3)) * 25}%`
                          : currentPhase === "research" && activeAgentIndex >= 0
                            ? `${((activeAgentIndex + 1) / (debate?.participants.length || 3)) * 50}%`
                            : "5%"
                    }}
                  />
                </div>
              </div>
            )}

            {/* Pause / Resume buttons - side by side */}
            <div className="grid grid-cols-2 gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={pauseDebate}
                disabled={!debate || !isRunning || isPaused}
                className="h-6 gap-1 px-1 text-[10px] text-amber-400 hover:text-amber-300 border border-amber-700 hover:border-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pause className="h-2.5 w-2.5" />
                Pause
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={resumeDebate}
                disabled={!debate || !isPaused}
                className="h-6 gap-1 px-1 text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-700 hover:border-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="h-2.5 w-2.5" />
                Resume
              </Button>
            </div>

            {/* Redirect button + expandable input */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRedirect((v) => !v)}
              disabled={!debate || isRunning || isComplete}
              className={cn(
                "w-full h-6 gap-1 px-2 text-[10px] border disabled:opacity-40 disabled:cursor-not-allowed",
                showRedirect
                  ? "text-indigo-400 border-indigo-700"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 border-zinc-400 dark:border-zinc-700 hover:border-zinc-600"
              )}
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Redirect
            </Button>

            {showRedirect && debate && !isRunning && !isComplete && (
              <div className="space-y-2">
                <label className="block text-[10px] font-medium text-indigo-400 uppercase tracking-wider">
                  Redirect Debate
                </label>
                <Input
                  value={redirectInput}
                  onChange={(e) => setRedirectInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRedirectSubmit()}
                  placeholder="Enter new direction for the debate..."
                  className="w-full bg-zinc-200 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs h-8"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleRedirectSubmit}
                  disabled={!redirectInput.trim()}
                  className="w-full bg-indigo-600 text-white hover:bg-indigo-700 h-8 text-sm font-semibold px-3"
                >
                  Redirect & Run
                </Button>
              </div>
            )}

            {/* Swap Judge button + expandable picker */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowJudgeSwap((v) => !v)}
              disabled={!debate || isRunning || isComplete}
              className={cn(
                "w-full h-6 gap-1 px-2 text-[10px] border disabled:opacity-40 disabled:cursor-not-allowed",
                showJudgeSwap
                  ? "text-amber-400 border-amber-700"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 border-zinc-400 dark:border-zinc-700 hover:border-zinc-600"
              )}
            >
              <Scale className="h-2.5 w-2.5" />
              Swap Judge
            </Button>

            {showJudgeSwap && debate && !isRunning && !isComplete && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-medium text-amber-400 uppercase tracking-wider">
                          Swap Judge
                        </label>
                        <div>
                          <label className="block mb-1 text-[10px] text-zinc-500 dark:text-zinc-500">Provider</label>
                          <select
                            value={judgeSwapSlot.provider ?? ""}
                            onChange={(e) => {
                              const pid = e.target.value;
                              if (!pid) {
                                setJudgeSwapSlot({ provider: null, model: "", roleId: "default-judge" });
                                return;
                              }
                              const prov = providers.find((p) => p.id === pid);
                              const isLocal = prov?.type === "local";
                              setJudgeSwapSlot({
                                provider: pid as Provider,
                                model: isLocal ? (ollamaModels[0]?.id ?? "") : (prov?.models[0]?.id ?? ""),
                                roleId: "default-judge",
                              });
                            }}
                            className="w-full rounded bg-zinc-300 dark:bg-zinc-700 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 border-0 focus:ring-1 focus:ring-amber-500"
                          >
                            <option value="">Select provider</option>
                            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        {judgeSwapSlot.provider && (
                          <div>
                            <label className="block mb-1 text-[10px] text-zinc-500 dark:text-zinc-500">Model</label>
                            {renderModelSelect(judgeSwapSlot, 3, (model) => setJudgeSwapSlot((s) => ({ ...s, model })))}
                          </div>
                        )}
                        <Button
                          size="sm"
                          onClick={handleJudgeSwap}
                          disabled={!judgeSwapSlot.provider}
                          className="w-full bg-amber-600 text-white hover:bg-amber-700 h-8 text-sm font-semibold px-3"
                        >
                          <Scale className="h-3.5 w-3.5 mr-1.5" />
                          Swap
                        </Button>
              </div>
            )}

            {/* End Debate button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={endDebate}
              disabled={!debate}
              className="w-full h-6 gap-1 px-2 text-[10px] text-red-400 hover:text-red-300 border border-red-700 hover:border-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="h-2.5 w-2.5" />
              End Debate
            </Button>

            <div className="h-px bg-zinc-300 dark:bg-zinc-700" />

            {/* Export Summary PDF */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (debate) {
                  exportDebateSummaryToPDF(debate as any);
                  showToast({ message: "Exported debate summary as PDF", type: "success" });
                }
              }}
              disabled={!debate || !debate.executiveSummary}
              className="w-full h-6 gap-1 px-2 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FileText className="h-2.5 w-2.5" />
              Export Summary
            </Button>

            {/* Export Thread PDF */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (debate) {
                  exportDebateThreadToPDF(debate as any);
                  showToast({ message: "Exported debate thread as PDF", type: "success" });
                }
              }}
              disabled={!debate || debate.messages.length === 0}
              className="w-full h-6 gap-1 px-2 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="h-2.5 w-2.5" />
              Export Thread
            </Button>

            {/* Export CSV */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (debate) {
                  exportDebateToCSV(debate as any);
                  showToast({ message: "Exported debate as CSV", type: "success" });
                }
              }}
              disabled={!debate || debate.messages.length === 0}
              className="w-full h-6 gap-1 px-2 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="h-2.5 w-2.5" />
              Export CSV
            </Button>

            {/* Save to Memory */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveToMemory}
              disabled={!debate || debate.messages.length === 0}
              className={cn(
                "w-full h-6 gap-1 px-2 text-[10px] border disabled:opacity-30 disabled:cursor-not-allowed",
                savedToMemory
                  ? "text-emerald-400 border-emerald-700"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 border-zinc-400 dark:border-zinc-700 hover:border-zinc-600"
              )}
            >
              {savedToMemory ? <Check className="h-2.5 w-2.5" /> : <BookmarkPlus className="h-2.5 w-2.5" />}
              {savedToMemory ? "Saved" : "Save to Memory"}
            </Button>

            <div className="h-px bg-zinc-300 dark:bg-zinc-700" />

            {/* Debate History - with flex-1 to take remaining space */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="mb-1 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  Debate History
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <DebateHistory />
              </div>
            </div>
          </div>
        )}

        {/* ─── RIGHT SIDE: Output/Visual Content ───────────────────── */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* LLM Section - Collapsible */}
          {!llmSectionCollapsed ? (
            <div className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 p-3 space-y-2">
              {/* Collapse button */}
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">LLM Configuration</h2>
                <button
                  onClick={() => setLlmSectionCollapsed(true)}
                  className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Collapse
                </button>
              </div>

              {/* Participant slots */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  Participants
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {slots.map((slot, idx) => {
                    const isJudge = idx === 3;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-lg border p-2 space-y-1",
                          isJudge
                            ? "border-amber-700/50 bg-amber-50 dark:bg-amber-950/20"
                            : AGENT_BG_COLORS[idx] || "border-zinc-400 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800/50"
                        )}
                      >
                        <p className={cn(
                          "text-[11px] font-bold uppercase tracking-wider",
                          isJudge ? "text-amber-700 dark:text-amber-400" : AGENT_LABEL_COLORS[idx]
                        )}>
                          {slotLabels[idx]}
                        </p>
                        <select
                          value={slot.provider ?? ""}
                          onChange={(e) => handleProviderChange(idx, e.target.value)}
                          disabled={!!debate}
                          className="w-full rounded bg-zinc-300 dark:bg-zinc-700 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 border-0 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">No LLM</option>
                          {providers.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {renderModelSelect(slot, idx, (model) => updateSlot(idx, { model }))}
                        {slot.provider && (
                          <select
                            value={slot.roleId ?? ""}
                            onChange={(e) => updateSlot(idx, { roleId: e.target.value || undefined })}
                            disabled={!!debate}
                            className="w-full rounded bg-zinc-300 dark:bg-zinc-700 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 border-0 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isJudge ? (
                              roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}{r.isDefault ? " (Default)" : ""}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="">No Role (General)</option>
                                {agentRoles.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </>
                            )}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            <div className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 h-12 flex items-center justify-between px-4">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {agentCount} LLMs configured ({debate ? `${debate.participants.length} agents + judge` : `${agentCount} agents + judge`})
              </span>
              <button
                onClick={() => setLlmSectionCollapsed(false)}
                className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Expand
              </button>
            </div>
          )}

          {/* Topic + Debate output - scrollable */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Topic */}
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  Research Question
                </label>
                {sourceConversationId && (
                  <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-500/30">
                    From thread
                  </span>
                )}
              </div>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter debate topic or paste content..."
                rows={4}
                disabled={!!debate}
                className="w-full rounded-lg border border-zinc-400 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 dark:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
              />
            </div>

            {/* Status badges + Current Round/Phase info */}
            {debate && (
              <div className="flex flex-wrap items-center gap-2">
                {isRunning && (
                  <span className="rounded-full bg-indigo-600/20 px-2.5 py-1 text-[11px] font-medium text-indigo-400 border border-indigo-500/30">
                    Running - Round {debate.currentRound}
                  </span>
                )}
                {isComplete && (
                  <span className="rounded-full bg-emerald-600/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                    Completed
                  </span>
                )}
                {isPaused && (
                  <span className="rounded-full bg-amber-600/15 px-2.5 py-1 text-[11px] font-medium text-amber-400">
                    Paused
                  </span>
                )}
                {currentPhase && (
                  <span className="rounded-full bg-zinc-300 dark:bg-zinc-700/50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    {currentPhase}
                  </span>
                )}
              </div>
            )}

            {/* Debate Transcript - Grouped by Round */}
            {debate && debate.messages.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Debate Transcript</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleExpandAll}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      title={allExpanded ? "Collapse All" : "Expand All"}
                    >
                      {allExpanded ? (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Collapse All
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-3.5 w-3.5" />
                          Expand All
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCopyDebate}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      title="Copy entire debate"
                    >
                      {debateCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Debate
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {Array.from({ length: debate.rounds }, (_, roundIdx) => {
                  const round = roundIdx + 1;
                  const roundCritiques = debate.critiques.filter((c) => c.round === round);
                  const roundSummary = debate.roundSummaries.find((rs) => rs.round === round);
                  const participantCount = debate.participants.length;
                  const researchStartIdx = getResearchStartIndex(round, participantCount, debate.roundSummaries.length);
                  const isCurrentRound = debate.currentRound === round && debate.status === 'ongoing';

                  return (
                    <DebateRoundGroup
                      key={round}
                      round={round}
                      isCurrentRound={isCurrentRound}
                      defaultExpanded={round === debate.currentRound || round === debate.rounds}
                      forceExpanded={allExpanded}
                    >
                      {/* Research Phase */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500 px-1">Research Phase</div>
                        {debate.participants.map((participant, pIdx) => {
                          const msg = debate.messages[researchStartIdx + pIdx];
                          if (!msg) return null;
                          return (
                            <AgentMessageCard
                              key={`r${round}-research-${pIdx}`}
                              agentIndex={pIdx}
                              agentLabel={`Agent ${pIdx + 1}`}
                              model={`${getProviderName(participant.provider)} / ${participant.model}`}
                              phase="Research"
                              content={msg.content}
                              forceExpanded={allExpanded}
                              onSendToBuilder={handleSendToBuilder}
                            />
                          );
                        })}
                      </div>

                      {/* Cross-Check Phase */}
                      {roundCritiques.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500 px-1">Cross-Check Phase</div>
                          {debate.participants.map((participant, pIdx) => {
                            const critique = roundCritiques.find((c) => c.fromParticipantIndex === pIdx);
                            if (!critique) return null;
                            return (
                              <AgentMessageCard
                                key={`r${round}-critique-${pIdx}`}
                                agentIndex={pIdx}
                                agentLabel={`Agent ${pIdx + 1}`}
                                model={`${getProviderName(participant.provider)} / ${participant.model}`}
                                phase="Cross-Check"
                                content={critique.content}
                                forceExpanded={allExpanded}
                                onSendToBuilder={handleSendToBuilder}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Judge Summary */}
                      {roundSummary && (
                        <JudgeSummaryCard
                          model={`${getProviderName(debate.judge.provider)} / ${debate.judge.model}`}
                          summary={roundSummary.summary}
                          agreements={roundSummary.agreements}
                          forceExpanded={allExpanded}
                        />
                      )}
                    </DebateRoundGroup>
                  );
                })}
              </div>
            )}

            {/* Executive Summary */}
            {debate?.executiveSummary && (
              <div className="border-2 border-indigo-400 dark:border-indigo-500 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                    <h2 className="text-lg font-bold text-indigo-700 dark:text-indigo-300">Executive Summary</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowExecModal(true)}
                    className="h-7 gap-1 px-2 text-sm font-semibold text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Expand
                  </Button>
                </div>

                <div className="rounded-lg border border-indigo-300 dark:border-indigo-500/30 bg-white dark:bg-zinc-900/50 p-4 max-h-[24rem] overflow-y-auto">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</p>,
                      h1: ({ children }) => <h1 className="mb-4 mt-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{children}</h1>,
                      h2: ({ children }) => <h2 className="mb-3 mt-5 text-xl font-bold text-zinc-900 dark:text-zinc-100">{children}</h2>,
                      h3: ({ children }) => <h3 className="mb-2 mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{children}</h3>,
                      ul: ({ children }) => <ul className="mb-4 space-y-2 pl-5 list-disc text-base text-zinc-700 dark:text-zinc-300">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-4 space-y-2 pl-5 list-decimal text-base text-zinc-700 dark:text-zinc-300">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-indigo-400 dark:border-indigo-500 pl-4 italic text-zinc-600 dark:text-zinc-400">{children}</blockquote>,
                      strong: ({ children }) => <strong className="font-bold text-zinc-900 dark:text-zinc-100">{children}</strong>,
                    }}
                  >
                    {debate.executiveSummary}
                  </ReactMarkdown>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowExecModal(true)}
                    className="h-8 gap-1 px-3 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Maximize
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      exportDebateSummaryToPDF(debate as any);
                      showToast({ message: "Exported debate summary as PDF", type: "success" });
                    }}
                    className="h-8 gap-1 px-3 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Export Summary
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      exportDebateThreadToPDF(debate as any);
                      showToast({ message: "Exported debate thread as PDF", type: "success" });
                    }}
                    className="h-8 gap-1 px-3 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Thread
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveToMemory}
                    className="h-8 gap-1 px-3 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save to Memory
                  </Button>
                  {sourceConversationId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={endDebateToThread}
                      className="h-8 gap-1 px-3 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 border border-indigo-400 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-600"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Return to Thread
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyExecSummary}
                    className="h-8 gap-1 px-3 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Input Bar - Redirect/Ask Questions */}
          {debate && !isComplete && (
            <div className="border-t border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/80 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleQuickInput()}
                  placeholder={isRunning ? "Debate in progress..." : "Ask a question or redirect the debate..."}
                  disabled={isRunning}
                  className="flex-1 rounded-lg border border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={handleQuickInput}
                  disabled={isRunning || !quickInput.trim()}
                  className="h-9 px-3 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-500">
                Press Enter to redirect the debate with your question or instruction
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Executive Summary Modal */}
      {debate?.executiveSummary && (
        <ExecutiveSummaryModal
          open={showExecModal}
          onOpenChange={setShowExecModal}
          summary={debate.executiveSummary}
          topic={debate.topic}
        />
      )}
    </div>
  );
}

// ─── Round Group ─────────────────────────────────────────────────────────────

function DebateRoundGroup({
  round,
  isCurrentRound,
  defaultExpanded,
  forceExpanded,
  children,
}: {
  round: number;
  isCurrentRound: boolean;
  defaultExpanded: boolean;
  forceExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [userOverride, setUserOverride] = useState<boolean | null>(null);

  // User click overrides forceExpanded, otherwise use forceExpanded or local state
  const isExpanded = userOverride !== null ? userOverride : (forceExpanded !== undefined ? forceExpanded : expanded);

  const handleToggle = () => {
    if (forceExpanded !== undefined) {
      // Override the forceExpanded with user's choice
      setUserOverride(userOverride === null ? !forceExpanded : !userOverride);
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <div className={cn(
      "rounded-xl border-2 overflow-hidden transition-colors",
      isCurrentRound
        ? "border-amber-500/50 bg-amber-950/5 dark:bg-amber-950/10"
        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/30",
    )}>
      {/* Round Header */}
      <button
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 transition-colors",
          isCurrentRound
            ? "bg-amber-500/10 hover:bg-amber-500/15"
            : "bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800",
        )}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          )}
          <span className={cn(
            "text-sm font-bold",
            isCurrentRound ? "text-amber-600 dark:text-amber-400" : "text-zinc-800 dark:text-zinc-200"
          )}>
            Round {round}
          </span>
          {isCurrentRound && (
            <span className="text-xs font-medium text-amber-500 animate-pulse">In Progress</span>
          )}
        </div>
      </button>

      {/* Round Content */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Agent Message Card ──────────────────────────────────────────────────────

const AGENT_LEFT_BORDER = [
  "border-l-indigo-500",
  "border-l-purple-500",
  "border-l-emerald-500",
  "border-l-rose-500",
];

const AGENT_BADGE_COLORS = [
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
];

function AgentMessageCard({
  agentIndex,
  agentLabel,
  model,
  phase,
  content,
  forceExpanded,
  onSendToBuilder,
}: {
  agentIndex: number;
  agentLabel: string;
  model: string;
  phase: string;
  content: string;
  forceExpanded?: boolean;
  onSendToBuilder?: (content: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const isExpanded = userOverride !== null ? userOverride : (forceExpanded !== undefined ? forceExpanded : expanded);
  const [copied, setCopied] = useState(false);
  const colorIdx = agentIndex % AGENT_LEFT_BORDER.length;

  const handleToggle = () => {
    if (forceExpanded !== undefined) {
      setUserOverride(userOverride === null ? !forceExpanded : !userOverride);
    } else {
      setExpanded(!expanded);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToBuilder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSendToBuilder?.(content);
  };

  return (
    <div className={cn(
      "rounded-lg border border-zinc-200 dark:border-zinc-700 border-l-4 overflow-hidden",
      AGENT_LEFT_BORDER[colorIdx],
    )}>
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800/40">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
          )}
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            AGENT_BADGE_COLORS[colorIdx],
          )}>
            {agentLabel}
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{model}</span>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-auto flex-shrink-0">{phase}</span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button
            onClick={handleSendToBuilder}
            className="rounded p-1 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
            title="Send to Builder"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            title="Copy"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-3 max-h-80 overflow-y-auto bg-white dark:bg-zinc-900/50">
          <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 leading-relaxed text-sm">{children}</p>,
                h1: ({ children }) => <h1 className="mb-3 mt-4">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 mt-4">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-2 mt-3">{children}</h3>,
                ul: ({ children }) => <ul className="mb-3 space-y-1.5 pl-4">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 space-y-1.5 pl-4">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 italic text-zinc-500 dark:text-zinc-400">{children}</blockquote>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Judge Summary Card ──────────────────────────────────────────────────────

function JudgeSummaryCard({
  model,
  summary,
  agreements,
  forceExpanded,
}: {
  model: string;
  summary: string;
  agreements?: { statement: string; consensusLevel: string }[];
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const isExpanded = userOverride !== null ? userOverride : (forceExpanded !== undefined ? forceExpanded : expanded);

  const handleToggle = () => {
    if (forceExpanded !== undefined) {
      setUserOverride(userOverride === null ? !forceExpanded : !userOverride);
    } else {
      setExpanded(!expanded);
    }
  };

  const fullContent = summary + (agreements && agreements.length > 0
    ? `\n\n**Consensus Points:**\n${agreements.map(a => `- [${a.consensusLevel}] ${a.statement}`).join('\n')}`
    : '');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border-2 border-amber-400 dark:border-amber-500/60 overflow-hidden bg-amber-50 dark:bg-amber-950/15">
      <div className="flex items-center justify-between px-3 py-2 bg-amber-100 dark:bg-amber-900/30">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          )}
          <Scale className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300">JUDGE</span>
          <span className="text-[11px] text-amber-600/70 dark:text-amber-400/70 truncate">{model}</span>
        </button>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 rounded p-1 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 ml-2"
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-amber-300 dark:border-amber-500/30 px-4 py-3 max-h-96 overflow-y-auto">
          <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 leading-relaxed text-sm text-zinc-700 dark:text-zinc-300">{children}</p>,
                h1: ({ children }) => <h1 className="mb-3 mt-4 text-amber-800 dark:text-amber-200">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 mt-4 text-amber-800 dark:text-amber-200">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-2 mt-3 text-amber-800 dark:text-amber-200">{children}</h3>,
                ul: ({ children }) => <ul className="mb-3 space-y-1.5 pl-4">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 space-y-1.5 pl-4">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-amber-400 dark:border-amber-500 pl-3 italic text-zinc-500 dark:text-zinc-400">{children}</blockquote>,
                strong: ({ children }) => <strong className="font-bold text-amber-800 dark:text-amber-200">{children}</strong>,
              }}
            >
              {fullContent}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
