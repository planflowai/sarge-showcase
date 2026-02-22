"use client";

import { useState, useMemo } from "react";
import { useJournalStore, AnalysisRecord } from "@/lib/stores/journalStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useRoleStore } from "@/lib/stores/roleStore";
import { useProviderStore } from "@/lib/stores/providerStore";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, AlertCircle, History } from "lucide-react";
import { AnalysisOutput } from "./AnalysisOutput";
import { AnalysisHistory } from "./AnalysisHistory";
import { cn } from "@/lib/utils";

type ViewMode = "current" | "history";

interface AnalysisResult {
  analysis: string;
  provider: "ollama" | "claude-opus";
}

export function AnalysisPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>("current");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Provider store - use sidebar's model selection
  const currentProvider = useProviderStore((s) => s.currentProvider);
  const currentModel = useProviderStore((s) => s.currentModel);

  const getEntriesToday = useJournalStore((s) => s.getEntriesToday);
  const currentDraft = useJournalStore((s) => s.currentDraft);
  const saveAnalysis = useJournalStore((s) => s.saveAnalysis);
  const analysisHistory = useJournalStore((s) => s.analysisHistory);
  const setCurrentAnalysis = useJournalStore((s) => s.setCurrentAnalysis);
  const setCurrentPrompts = useJournalStore((s) => s.setCurrentPrompts);
  const batchHistory = useTestModeStore((s) => s.batchHistory);
  const debateLogic = useTestModeStore((s) => s.debateLogic);
  const roles = useRoleStore((s) => s.roles);

  // Format model string for API based on sidebar selection
  const apiModelString = useMemo(() => {
    if (currentProvider === "ollama") {
      return `ollama:${currentModel}`;
    }
    return currentModel;
  }, [currentProvider, currentModel]);

  const handleAnalyze = async () => {
    setViewMode("current");
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const todayEntries = getEntriesToday();
      const last5Batches = batchHistory?.slice(-5) || [];

      const d1Role = roles.find((r) => r.id === "default-d1-responder");
      const d2Role = roles.find((r) => r.id === "default-d2-checker");
      const d3Role = roles.find((r) => r.id === "default-d3-verifier");
      const judgeRole = roles.find((r) => r.id === "default-judge");

      const promptsSnapshot = {
        d1: d1Role?.systemPrompt || debateLogic?.d1Prompt,
        d2: d2Role?.systemPrompt || debateLogic?.d2Prompt,
        d3: d3Role?.systemPrompt || debateLogic?.d3Prompt,
        judge: judgeRole?.systemPrompt || debateLogic?.judgePrompt,
      };

      const response = await fetch("/api/journal/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: apiModelString,
          journalEntries: todayEntries,
          currentDraft,
          batchLogs: last5Batches,
          prompts: promptsSnapshot,
          debateLogic: {
            d1Prompt: debateLogic?.d1Prompt,
            d2Prompt: debateLogic?.d2Prompt,
            d3Prompt: debateLogic?.d3Prompt,
            judgePrompt: debateLogic?.judgePrompt,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Analysis failed");
      }

      const data: AnalysisResult = await response.json();
      setResult(data);

      // Push to shared context so Chat can see it automatically
      setCurrentAnalysis(data.analysis, data.provider);
      setCurrentPrompts({
        d1: promptsSnapshot.d1 || null,
        d2: promptsSnapshot.d2 || null,
        d3: promptsSnapshot.d3 || null,
        judge: promptsSnapshot.judge || null,
      });

      saveAnalysis(data.analysis, data.provider, {
        journalEntriesCount: todayEntries.length,
        batchLogsCount: last5Batches.length,
        promptsSnapshot,
      });
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Failed to analyze. Check if Ollama is running.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectFromHistory = (record: AnalysisRecord) => {
    setResult({
      analysis: record.analysis,
      provider: record.provider,
    });
    setViewMode("current");

    // Push to shared context so Chat can see it
    setCurrentAnalysis(record.analysis, record.provider);
    if (record.context?.promptsSnapshot) {
      setCurrentPrompts({
        d1: record.context.promptsSnapshot.d1 || null,
        d2: record.context.promptsSnapshot.d2 || null,
        d3: record.context.promptsSnapshot.d3 || null,
        judge: record.context.promptsSnapshot.judge || null,
      });
    }
  };

  const historyCount = analysisHistory.length;
  const batchCount = batchHistory?.length || 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900/50">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Analysis
            </h2>
            {/* Data status */}
            <span
              className={cn(
                "text-[9px] px-1 py-0.5 rounded",
                batchCount > 0
                  ? "bg-green-500/20 text-green-600 dark:text-green-400"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              )}
              title={`${batchCount} batches available`}
            >
              {batchCount}B
            </span>
            {result && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  result.provider.startsWith("ollama")
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                )}
              >
                {result.provider.startsWith("ollama") ? "Local" : result.provider.split("-").slice(0, 2).join(" ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {historyCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs gap-1",
                  viewMode === "history" && "bg-zinc-100 dark:bg-zinc-800"
                )}
                onClick={() => setViewMode(viewMode === "history" ? "current" : "history")}
              >
                <History className="h-3 w-3" />
                {historyCount}
              </Button>
            )}
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              size="sm"
              className="h-6 px-2 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {analyzing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Brain className="h-3 w-3" />
              )}
              {analyzing ? "..." : "Run"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {viewMode === "history" ? (
          <AnalysisHistory onSelectAnalysis={handleSelectFromHistory} />
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 mb-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            {analyzing && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="p-3 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-3 animate-pulse">
                  <Brain className="h-6 w-6 text-indigo-500" />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Analyzing...
                </p>
              </div>
            )}

            {!analyzing && !result && !error && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Brain className="h-8 w-8 text-indigo-500/30 mb-2" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Click "Run" for AI analysis of your batches and prompts
                </p>
              </div>
            )}

            {result && !analyzing && <AnalysisOutput content={result.analysis} />}
          </>
        )}
      </div>
    </div>
  );
}
