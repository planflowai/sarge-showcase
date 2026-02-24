"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useDebateHistoryStore } from "@/lib/stores/debateHistoryStore";
import { useConversationStore } from "@/lib/stores/conversationStore";
import { useParallelChatStore } from "@/lib/stores/parallelChatStore";
import { useMessageStore } from "@/lib/stores/messageStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { useRoleStore } from "@/lib/stores/roleStore";
import { runDebate, type DebateConfig, type DebateEvent, type DebateAgent } from "@/lib/debate/engine";
import { AgentPanel } from "./AgentPanel";
import { JudgePanel } from "./JudgePanel";
import { JudgeSummary } from "./JudgeSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { providers } from "@/lib/providers";
import { fetchOllamaModels, fetchLMStudioModels, type LocalModel } from "@/lib/providers/localModels";
import {
  Play,
  Pause,
  Play as Resume,
  Square,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentState {
  id: string;
  content: string;
  status: "waiting" | "thinking" | "complete";
}

interface SlotConfig {
  provider: string | null;
  model: string | null;
  role?: string;
}

const AGENT_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899"];
const JUDGE_COLOR = "#D97706";

export function DebateView() {
  const {
    debate,
    isRunning,
    isPaused,
    pauseDebate,
    resumeDebate,
    endDebate,
    clearDebate,
  } = useDebateStore();

  const { roles, hydrate } = useRoleStore();

  // Agent slot configuration (3 agents + 1 judge)
  const [agentSlots, setAgentSlots] = useState<SlotConfig[]>([
    { provider: null, model: null, role: undefined },
    { provider: null, model: null, role: undefined },
    { provider: null, model: null, role: undefined },
  ]);
  const [judgeSlot, setJudgeSlot] = useState<SlotConfig>({ provider: null, model: null });

  // UI state for debate execution
  const [passMode, setPassMode] = useState<"blind" | "sequential">("blind");
  const [useLocal, setUseLocal] = useState(true);
  const [totalRounds, setTotalRounds] = useState(3);
  const [topicInput, setTopicInput] = useState("");
  const [judgeState, setJudgeState] = useState({
    content: "",
    status: "waiting" as const,
  });
  const [currentRound, setCurrentRound] = useState(0);
  const [debateComplete, setDebateComplete] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRoundRef = useRef(0);

  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());

  interface RoundData {
    roundNumber: number;
    agents: {
      id: string;
      content: string;
      status: "waiting" | "thinking" | "complete";
    }[];
    judgeSummary: string;
    judgeStatus: "waiting" | "thinking" | "complete";
  }

  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [expandedJudges, setExpandedJudges] = useState<Set<number>>(new Set());
  const [currentActiveRound, setCurrentActiveRound] = useState(0);
  const [finalJudgeSummary, setFinalJudgeSummary] = useState("");

  // Local model fetching
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [lmstudioModels, setLmstudioModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [lmstudioLoading, setLmstudioLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [lmstudioError, setLmstudioError] = useState<string | null>(null);

  // Per-agent Cloud vs Local model selection
  const [agentUseCloud, setAgentUseCloud] = useState<boolean[]>([true, true, true]);
  const [judgeUseCloud, setJudgeUseCloud] = useState(true);

  // Debate history and saving
  const { debates, saveDebate, setCurrent: setCurrentDebate } = useDebateHistoryStore();
  const { enabled: multiChatEnabled } = useParallelChatStore();
  const { createConversation, setCurrent: setCurrentConversation } = useConversationStore();

  // Stable keys to trigger refetch only when provider selection changes
  const hasOllamaLocal = agentUseCloud.some(v => !v) || !judgeUseCloud;
  const hasLMStudioLocal = agentUseCloud.some(v => !v) || !judgeUseCloud;
  const ollamaProviderKey = hasOllamaLocal ? "has-ollama" : "no-ollama";
  const lmstudioProviderKey = hasLMStudioLocal ? "has-lmstudio" : "no-lmstudio";

  // Fetch Ollama models when Ollama provider is selected
  useEffect(() => {
    if (ollamaProviderKey === "no-ollama") {
      setOllamaModels([]);
      return;
    }

    setOllamaLoading(true);
    setOllamaError(null);

    fetchOllamaModels()
      .then(models => setOllamaModels(models))
      .catch(() => {
        setOllamaModels([]);
        setOllamaError("Cannot reach Ollama. Make sure it's running at http://localhost:11434");
      })
      .finally(() => setOllamaLoading(false));
  }, [ollamaProviderKey]);

  // Fetch LM Studio models when LM Studio provider is selected
  useEffect(() => {
    if (lmstudioProviderKey === "no-lmstudio") {
      setLmstudioModels([]);
      return;
    }

    setLmstudioLoading(true);
    setLmstudioError(null);

    fetchLMStudioModels()
      .then(models => setLmstudioModels(models))
      .catch(() => {
        setLmstudioModels([]);
        setLmstudioError("Cannot reach LM Studio. Make sure it's running on port 1240");
      })
      .finally(() => setLmstudioLoading(false));
  }, [lmstudioProviderKey]);

  // Hydrate roles on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Fetch local models when any agent or judge switches to Local mode
  useEffect(() => {
    const needsLocal = agentUseCloud.some(v => !v) || !judgeUseCloud;
    if (!needsLocal) return;

    // Only fetch if we don't have models yet
    if (ollamaModels.length === 0 && !ollamaError) {
      setOllamaLoading(true);
      setOllamaError(null);
      fetchOllamaModels()
        .then(models => setOllamaModels(models))
        .catch(() => {
          setOllamaModels([]);
          setOllamaError("Cannot reach Ollama. Make sure it's running at http://localhost:11434");
        })
        .finally(() => setOllamaLoading(false));
    }

    if (lmstudioModels.length === 0 && !lmstudioError) {
      setLmstudioLoading(true);
      setLmstudioError(null);
      fetchLMStudioModels()
        .then(models => setLmstudioModels(models))
        .catch(() => {
          setLmstudioModels([]);
          setLmstudioError("Cannot reach LM Studio. Make sure it's running on port 1240");
        })
        .finally(() => setLmstudioLoading(false));
    }
  }, [agentUseCloud, judgeUseCloud, ollamaModels.length, lmstudioModels.length, ollamaError, lmstudioError]);

  // Get available models for a provider (dynamic for local, static for cloud)
  const getModelsForProvider = useCallback(
    (providerId: string | null) => {
      if (!providerId) return [];
      if (providerId === "ollama") return ollamaModels;
      if (providerId === "lmstudio") return lmstudioModels;
      const provider = providers.find((p) => p.id === providerId);
      return provider?.models || [];
    },
    [ollamaModels, lmstudioModels]
  );

  // Get all cloud models from all cloud providers
  const cloudModels = useMemo(() => {
    return providers
      .filter(p => p.id !== "ollama" && p.id !== "lmstudio")
      .flatMap(p => p.models.map(m => ({ ...m, providerId: p.id })));
  }, []);

  // Get all local models combined
  const localModels = useMemo(() => {
    return [
      ...ollamaModels.map(m => ({ ...m, providerId: "ollama" })),
      ...lmstudioModels.map(m => ({ ...m, providerId: "lmstudio" }))
    ];
  }, [ollamaModels, lmstudioModels]);

  // Get models for a specific agent slot (cloud or local based on agentUseCloud)
  const getAgentModels = useCallback((slotIdx: number) => {
    return agentUseCloud[slotIdx] ? cloudModels : localModels;
  }, [agentUseCloud, cloudModels, localModels]);

  // Get models for judge (cloud or local based on judgeUseCloud)
  const getJudgeModels = useCallback(() => {
    return judgeUseCloud ? cloudModels : localModels;
  }, [judgeUseCloud, cloudModels, localModels]);

  // Get only cloud models
  const getCloudModels = useCallback(() => {
    return cloudModels;
  }, [cloudModels]);

  // Get only local models
  const getLocalModels = useCallback(() => {
    return localModels;
  }, [localModels]);

  // Handle agent provider change
  const handleAgentProviderChange = (slotIdx: number, providerId: string) => {
    const newSlots = [...agentSlots];
    const models = getModelsForProvider(providerId);
    newSlots[slotIdx] = {
      provider: providerId === "none" ? null : providerId,
      model: models.length > 0 ? models[0].id : null,
      role: newSlots[slotIdx].role,
    };
    setAgentSlots(newSlots);
  };

  // Handle agent model change
  const handleAgentModelChange = (slotIdx: number, modelId: string) => {
    const newSlots = [...agentSlots];
    newSlots[slotIdx].model = modelId || null;
    setAgentSlots(newSlots);
  };

  // Toggle agent cloud/local mode
  const handleAgentCloudLocalToggle = (slotIdx: number) => {
    const newUseCloud = [...agentUseCloud];
    newUseCloud[slotIdx] = !newUseCloud[slotIdx];
    setAgentUseCloud(newUseCloud);
    // Reset model selection when switching modes
    const newSlots = [...agentSlots];
    newSlots[slotIdx].model = null;
    newSlots[slotIdx].provider = null;
    setAgentSlots(newSlots);
  };

  // Toggle judge cloud/local mode
  const handleJudgeCloudLocalToggle = () => {
    setJudgeUseCloud(!judgeUseCloud);
    // Reset judge model selection when switching modes
    setJudgeSlot({ provider: null, model: null });
  };

  // Handle agent role change
  const handleAgentRoleChange = (slotIdx: number, roleId: string) => {
    const newSlots = [...agentSlots];
    newSlots[slotIdx].role = roleId || undefined;
    setAgentSlots(newSlots);
  };

  // Handle judge provider change
  const handleJudgeProviderChange = (providerId: string) => {
    const models = getModelsForProvider(providerId);
    setJudgeSlot({
      provider: providerId,
      model: models.length > 0 ? models[0].id : null,
    });
  };

  // Handle judge model change
  const handleJudgeModelChange = (modelId: string) => {
    setJudgeSlot((prev) => ({ ...prev, model: modelId }));
  };

  // Check if debate is valid (at least 2 agents + judge)
  const activeAgentCount = agentSlots.filter((s) => s.provider).length;
  const isDebateValid = topicInput.trim() && activeAgentCount >= 2 && judgeSlot.provider;

  // Start debate handler
  const handleStartDebate = useCallback(async () => {
    if (!isDebateValid) return;

    // Build active agents from slots
    const activeAgents = agentSlots.filter((s) => s.provider);

    // Reset judge state
    setJudgeState({ content: "", status: "waiting" });
    setCurrentRound(0);
    setDebateComplete(false);

    // Build participants and judge objects for store
    const participants = activeAgents.map((slot) => ({
      provider: slot.provider!,
      model: slot.model,
    }));
    const judge = {
      provider: judgeSlot.provider!,
      model: judgeSlot.model,
    };

    // Initialize store state with debate object (for UI)
    const { startDebate: storeStartDebate } = useDebateStore.getState();
    storeStartDebate(topicInput.trim(), participants, judge, totalRounds);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Build config from local component state (NO setTimeout, NO store read)
    const config: DebateConfig = {
      topic: topicInput.trim(),
      agents: activeAgents.map((slot, idx) => {
        const selectedRole = slot.role ? roles.find(r => r.id === slot.role) : null;
        return {
          id: `agent-${idx}`,
          provider: slot.provider!,
          model: slot.model || "",
          role: selectedRole?.systemPrompt || "",
          color: AGENT_COLORS[idx],
        };
      }),
      judge: {
        id: "judge",
        provider: judgeSlot.provider!,
        model: judgeSlot.model || "",
        role: "judge",
        color: JUDGE_COLOR,
      },
      totalRounds,
      passMode,
    };

    // Run debate engine IMMEDIATELY
    try {
      for await (const event of runDebate(config, abortControllerRef.current?.signal)) {
        switch (event.type) {
          case "round_start":
            currentRoundRef.current = event.roundNumber || 0;
            setCurrentRound(event.roundNumber || 0);
            setCurrentActiveRound(event.roundNumber || 0);
            const activeAgentCount = agentSlots.filter(s => s.provider).length;
            setRounds(prev => [...prev, {
              roundNumber: event.roundNumber || 0,
              agents: Array(activeAgentCount).fill(null).map((_, idx) => ({
                id: `agent-${idx}`,
                content: "",
                status: "waiting" as const
              })),
              judgeSummary: "",
              judgeStatus: "waiting" as const
            }]);
            setExpandedRounds(prev => new Set(prev).add(event.roundNumber || 0));
            break;

          case "agent_start":
            if (event.agentId) {
              const idx = parseInt(event.agentId.split("-")[1]);
              setRounds(prev => prev.map(r =>
                r.roundNumber === currentRoundRef.current
                  ? {
                      ...r,
                      agents: r.agents.map((a, i) =>
                        i === idx ? { ...a, status: "thinking" as const } : a
                      )
                    }
                  : r
              ));
            }
            break;

          case "chunk":
            if (event.agentId && event.chunk) {
              const idx = parseInt(event.agentId.split("-")[1]);
              setRounds(prev => prev.map(r =>
                r.roundNumber === currentRoundRef.current
                  ? {
                      ...r,
                      agents: r.agents.map((a, i) =>
                        i === idx ? { ...a, content: a.content + event.chunk } : a
                      )
                    }
                  : r
              ));
            }
            break;

          case "agent_complete":
            if (event.agentId) {
              const idx = parseInt(event.agentId.split("-")[1]);
              setRounds(prev => prev.map(r =>
                r.roundNumber === currentRoundRef.current
                  ? {
                      ...r,
                      agents: r.agents.map((a, i) =>
                        i === idx ? { ...a, status: "complete" as const } : a
                      )
                    }
                  : r
              ));
            }
            break;

          case "judge_start":
            if (event.roundNumber !== undefined) {
              setRounds(prev => prev.map(r =>
                r.roundNumber === event.roundNumber
                  ? { ...r, judgeStatus: "thinking" as const, judgeSummary: "" }
                  : r
              ));
              setExpandedJudges(prev => new Set(prev).add(event.roundNumber!));
            }
            break;

          case "judge_chunk":
            if (event.chunk && event.roundNumber) {
              setRounds(prev => prev.map(r =>
                r.roundNumber === event.roundNumber
                  ? { ...r, judgeSummary: r.judgeSummary + event.chunk }
                  : r
              ));
            }
            break;

          case "judge_complete":
            if (event.roundNumber) {
              setRounds(prev => prev.map(r =>
                r.roundNumber === event.roundNumber
                  ? { ...r, judgeStatus: "complete" as const }
                  : r
              ));
              // If this is the last round, store as final summary
              const isLastRound = event.roundNumber === totalRounds;
              if (isLastRound) {
                setRounds(prev => {
                  const lastRound = prev.find(r => r.roundNumber === event.roundNumber);
                  if (lastRound) {
                    setFinalJudgeSummary(lastRound.judgeSummary);
                    setDebateComplete(true);
                  }
                  return prev;
                });
              }
            }
            break;

          case "error":
            console.error("Debate error:", event.error);
            break;
        }
      }
    } catch (error) {
      console.error("Debate execution failed:", error);
    } finally {
      endDebate();  // sets isRunning: false, isPaused: false, debateComplete: true
    }
  }, [topicInput, totalRounds, passMode, agentSlots, judgeSlot, isDebateValid, endDebate]);

  const handlePause = useCallback(() => {
    pauseDebate();
  }, [pauseDebate]);

  const handleResume = useCallback(() => {
    resumeDebate();
  }, [resumeDebate]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    endDebate();

    // Save debate state before clearing
    if (topicInput.trim() && activeAgentCount >= 2 && judgeSlot.provider) {
      saveDebate({
        id: `debate-${Date.now()}`,
        topic: topicInput.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
        agentSlots: agentSlots.filter(s => s.provider),
        judgeSlot,
        passMode,
        totalRounds,
        currentRound: currentRound || 0,
        rounds: rounds as any,
        debateComplete: false,
        finalJudgeSummary: "",
      });
    }

    setRounds([]);
    setJudgeState({ content: "", status: "waiting" });
    setDebateComplete(false);
  }, [endDebate, topicInput, activeAgentCount, judgeSlot, agentSlots, passMode, totalRounds, currentRound, rounds, saveDebate]);

  const handleCopyJudgment = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(judgeState.content);
    } catch {
      /* ignore */
    }
  }, [judgeState.content]);

  // Auto-save debate state when debate completes
  useEffect(() => {
    if (!topicInput.trim() || activeAgentCount < 2 || !judgeSlot.provider || !debateComplete) return;

    saveDebate({
      id: `debate-${Date.now()}`,
      topic: topicInput.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      agentSlots: agentSlots.filter(s => s.provider),
      judgeSlot,
      passMode,
      totalRounds,
      currentRound: currentRound || 0,
      rounds: rounds as any,
      debateComplete: true,
      finalJudgeSummary,
    });
  }, [debateComplete, finalJudgeSummary, topicInput, activeAgentCount, judgeSlot, agentSlots, passMode, totalRounds, currentRound, rounds, saveDebate]);

  // Send final summary to chat
  const handleSendToChat = useCallback(async () => {
    if (!finalJudgeSummary) return;

    if (multiChatEnabled) {
      // Send to multi-chat (parallel chat)
      console.log("Sending to multi-chat");
      // This would be implemented by the parallel chat store
    } else {
      // Send to single chat - create a new message
      const convo = useConversationStore.getState().conversations[0];
      if (convo) {
        setCurrentConversation(convo.id);
        // Message will be added by chat view
      }
    }
  }, [finalJudgeSummary, multiChatEnabled, setCurrentConversation]);

  // Send final summary to multi-chat
  const handleSendToMultiChat = useCallback(async () => {
    if (!finalJudgeSummary) return;

    if (multiChatEnabled) {
      console.log("Sending to multi-chat");
    } else {
      console.log("Multi-chat not enabled");
    }
  }, [finalJudgeSummary, multiChatEnabled]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-50">
      {/* Header / Control Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 space-y-4 max-h-[50vh] overflow-auto">
        {/* Topic, Rounds, and Debate Selector */}
        <div className="flex gap-3">
          <Input
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Enter debate topic..."
            disabled={isRunning}
            className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-500"
          />
          <select
            value={totalRounds}
            onChange={(e) => setTotalRounds(Number(e.target.value))}
            disabled={isRunning}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-50 text-sm font-medium"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} Round{n !== 1 ? "s" : ""}
              </option>
            ))}
          </select>
          {/* Saved Debates Dropdown */}
          {debates.length > 0 && (
            <select
              onChange={(e) => {
                const debate = debates.find(d => d.id === e.target.value);
                if (debate) {
                  setTopicInput(debate.topic);
                  setTotalRounds(debate.totalRounds);
                  setCurrentRound(debate.currentRound);
                  setRounds(debate.rounds);
                  setDebateComplete(debate.debateComplete);
                  setFinalJudgeSummary(debate.finalJudgeSummary);
                  setAgentSlots(debate.agentSlots as SlotConfig[]);
                  setJudgeSlot(debate.judgeSlot);
                }
              }}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-50 text-sm font-medium"
            >
              <option value="">Load Debate</option>
              {debates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.topic.substring(0, 30)}... ({new Date(d.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Agent Slot Configuration */}
        {!isRunning && (
          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <h3 className="text-sm font-semibold text-zinc-300">Agents & Models</h3>

            {agentSlots.map((slot, idx) => {
              const cloudModels = getCloudModels();
              const localModels = getLocalModels();
              return (
              <div key={idx} className="flex gap-1.5 items-center text-xs">
                <span className="text-zinc-400 font-medium w-12">Agent {idx + 1}</span>
                {/* Cloud dropdown */}
                <select
                  value={agentUseCloud[idx] && slot.model ? slot.model : ""}
                  onChange={(e) => {
                    const selectedModel = cloudModels.find(m => m.id === e.target.value);
                    const newSlots = [...agentSlots];
                    const newUseCloud = [...agentUseCloud];
                    if (selectedModel) {
                      newSlots[idx].model = selectedModel.id;
                      newSlots[idx].provider = selectedModel.providerId;
                      newUseCloud[idx] = true;
                    } else {
                      newUseCloud[idx] = false;
                    }
                    setAgentSlots(newSlots);
                    setAgentUseCloud(newUseCloud);
                  }}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs flex-1 disabled:opacity-50"
                >
                  <option value="">☁️ Cloud</option>
                  {cloudModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {/* Local dropdown */}
                <select
                  value={!agentUseCloud[idx] && slot.model ? slot.model : ""}
                  onChange={(e) => {
                    const selectedModel = localModels.find(m => m.id === e.target.value);
                    const newSlots = [...agentSlots];
                    const newUseCloud = [...agentUseCloud];
                    if (selectedModel) {
                      newSlots[idx].model = selectedModel.id;
                      newSlots[idx].provider = selectedModel.providerId;
                      newUseCloud[idx] = false;
                    } else {
                      newUseCloud[idx] = true;
                    }
                    setAgentSlots(newSlots);
                    setAgentUseCloud(newUseCloud);
                  }}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs flex-1 disabled:opacity-50"
                >
                  <option value="">🌐 Local</option>
                  {localModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            );
            })}

            {/* Judge Slot */}
            <div className="border-t border-zinc-800 pt-2">
              <div className="flex gap-1.5 items-center text-xs">
                <span className="text-zinc-400 font-medium w-12">Judge</span>
                {/* Judge Cloud dropdown */}
                <select
                  value={judgeUseCloud && judgeSlot.model ? judgeSlot.model : ""}
                  onChange={(e) => {
                    const selectedModel = getCloudModels().find(m => m.id === e.target.value);
                    if (selectedModel) {
                      setJudgeSlot({
                        provider: selectedModel.providerId,
                        model: selectedModel.id,
                      });
                      setJudgeUseCloud(true);
                    } else {
                      setJudgeUseCloud(false);
                    }
                  }}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs flex-1 disabled:opacity-50"
                >
                  <option value="">☁️ Cloud</option>
                  {getCloudModels().map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {/* Judge Local dropdown */}
                <select
                  value={!judgeUseCloud && judgeSlot.model ? judgeSlot.model : ""}
                  onChange={(e) => {
                    const selectedModel = getLocalModels().find(m => m.id === e.target.value);
                    if (selectedModel) {
                      setJudgeSlot({
                        provider: selectedModel.providerId,
                        model: selectedModel.id,
                      });
                      setJudgeUseCloud(false);
                    } else {
                      setJudgeUseCloud(true);
                    }
                  }}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs flex-1 disabled:opacity-50"
                >
                  <option value="">🌐 Local</option>
                  {getLocalModels().map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 flex-wrap pt-3 border-t border-zinc-800">
          {!isRunning ? (
            <Button
              onClick={handleStartDebate}
              disabled={!isDebateValid}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Debate
            </Button>
          ) : (
            <>
              {!isPaused ? (
                <Button
                  onClick={handlePause}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              ) : (
                <Button
                  onClick={handleResume}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  <Resume className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}
              <Button
                onClick={handleStop}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </>
          )}

          {/* Toggles */}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setUseLocal(!useLocal)}
              disabled={isRunning}
              className={cn(
                "px-3 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50",
                useLocal
                  ? "bg-cyan-600/30 text-cyan-400 border border-cyan-500/50"
                  : "bg-purple-600/30 text-purple-400 border border-purple-500/50"
              )}
            >
              {useLocal ? "🌐 Local" : "☁️ Cloud"}
            </button>
            <button
              onClick={() =>
                setPassMode(passMode === "blind" ? "sequential" : "blind")
              }
              disabled={isRunning}
              className={cn(
                "px-3 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50",
                passMode === "blind"
                  ? "bg-indigo-600/30 text-indigo-400 border border-indigo-500/50"
                  : "bg-rose-600/30 text-rose-400 border border-rose-500/50"
              )}
            >
              {passMode === "blind" ? "👁️ Blind" : "👀 Open"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {!debate ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-zinc-400">
              <p className="text-lg mb-2">Configure agents, judge, and topic above</p>
              <p className="text-sm">Then click Start Debate to begin</p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Sequential Rounds Display */}
            {rounds.map((round, roundIdx) => {
              // Only show rounds up to and including current active round
              if (round.roundNumber > currentActiveRound && round.judgeStatus === "waiting") {
                return null;
              }

              const isCurrentRound = round.roundNumber === currentActiveRound;
              const isRoundExpanded = expandedRounds.has(round.roundNumber);

              return (
                <div key={round.roundNumber} className="border border-zinc-700 rounded-lg bg-zinc-900/30 overflow-hidden">
                  {/* Round Header */}
                  <button
                    onClick={() => {
                      const next = new Set(expandedRounds);
                      next.has(round.roundNumber)
                        ? next.delete(round.roundNumber)
                        : next.add(round.roundNumber);
                      setExpandedRounds(next);
                    }}
                    className={cn(
                      "w-full px-6 py-3 flex items-center justify-between transition-colors",
                      isCurrentRound
                        ? "bg-amber-900/40 hover:bg-amber-800/40"
                        : "bg-zinc-800 hover:bg-zinc-700"
                    )}
                  >
                    <h3 className="text-lg font-semibold text-zinc-100">
                      Round {round.roundNumber}
                      {isCurrentRound && <span className="ml-2 text-sm text-amber-400">(Active)</span>}
                      {round.judgeStatus === "complete" && <span className="ml-2 text-sm text-emerald-400">✓</span>}
                    </h3>
                    <span className="text-zinc-400">{isRoundExpanded ? '▼' : '▶'}</span>
                  </button>

                  {/* Round Content */}
                  {isRoundExpanded && (
                    <div className="p-6 space-y-4">
                      {/* Agent Panels for this round */}
                      <div className="space-y-3">
                        {round.agents.map((agent, idx) =>
                          agentSlots[idx]?.provider ? (
                            <div key={`round-${round.roundNumber}-agent-${idx}`} className="border border-zinc-600 rounded-lg bg-zinc-800/20">
                              {/* Agent Header (Collapsible) */}
                              <button
                                onClick={() => {
                                  const agentKey = `agent-${round.roundNumber}-${idx}`;
                                  const next = new Set(expandedAgents);
                                  next.has(agentKey)
                                    ? next.delete(agentKey)
                                    : next.add(agentKey);
                                  setExpandedAgents(next);
                                }}
                                className="w-full px-4 py-2 flex items-center justify-between bg-zinc-700 hover:bg-zinc-600 transition-colors"
                              >
                                <span className="font-semibold text-zinc-100">
                                  Agent {idx + 1} {["Researcher", "Engineer", "Analyst"][idx] || ""}
                                </span>
                                <span className="text-zinc-400">
                                  {expandedAgents.has(`agent-${round.roundNumber}-${idx}`) ? '▼' : '▶'}
                                </span>
                              </button>

                              {/* Agent Content */}
                              {expandedAgents.has(`agent-${round.roundNumber}-${idx}`) && (
                                <div className="p-4">
                                  <AgentPanel
                                    agent={{
                                      id: agent.id,
                                      provider: agentSlots[idx].provider,
                                      model: agentSlots[idx].model || "",
                                      role: ["Researcher", "Engineer", "Analyst"][idx] || "Agent",
                                      color: AGENT_COLORS[idx],
                                    }}
                                    agentNumber={idx + 1}
                                    roundNumber={round.roundNumber}
                                    isStreaming={agent.status === "thinking"}
                                    content={agent.content}
                                    status={agent.status}
                                  />
                                </div>
                              )}
                            </div>
                          ) : null
                        )}
                      </div>

                      {/* Judge Summary for this round (Collapsible) */}
                      {round.judgeStatus !== "waiting" && (
                        <div className="border border-amber-700/50 rounded-lg bg-amber-900/20">
                          <button
                            onClick={() => {
                              const next = new Set(expandedJudges);
                              next.has(round.roundNumber)
                                ? next.delete(round.roundNumber)
                                : next.add(round.roundNumber);
                              setExpandedJudges(next);
                            }}
                            className="w-full px-4 py-2 flex items-center justify-between bg-amber-800/40 hover:bg-amber-800/50 transition-colors"
                          >
                            <span className="font-semibold text-amber-100">
                              Judge Summary — Round {round.roundNumber}
                              {round.judgeStatus === "complete" && <span className="ml-2 text-sm text-emerald-400">✓</span>}
                            </span>
                            <span className="text-amber-400">
                              {expandedJudges.has(round.roundNumber) ? '▼' : '▶'}
                            </span>
                          </button>

                          {expandedJudges.has(round.roundNumber) && (
                            <div className="p-4">
                              {round.judgeStatus === "thinking" && (
                                <div className="text-amber-200 flex items-center gap-2">
                                  <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                  Analyzing...
                                </div>
                              )}
                              {round.judgeSummary && (
                                <div className="prose prose-invert dark:prose-invert max-w-none text-zinc-200">
                                  {round.judgeSummary}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Final Judge Summary — shown after all rounds complete */}
            {debateComplete && finalJudgeSummary && (
              <div className="w-full mt-8 border-t border-zinc-700 pt-6">
                <h2 className="text-2xl font-bold text-zinc-100 mb-4">Final Verdict</h2>
                <JudgeSummary
                  summary={finalJudgeSummary}
                  onCopy={handleCopyJudgment}
                  onExportPDF={() => {
                    // Export PDF functionality to be implemented
                    console.log("Export PDF clicked");
                  }}
                  onSendToChat={handleSendToChat}
                  onSendToMultiChat={handleSendToMultiChat}
                  onClear={clearDebate}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
