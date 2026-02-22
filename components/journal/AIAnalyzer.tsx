"use client";

import { useState } from "react";
import { useJournalStore, type AnalysisRecord } from "@/lib/stores/journalStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useRoleStore } from "@/lib/stores/roleStore";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, AlertCircle, Sparkles, History, MessageSquare } from "lucide-react";
import { AnalysisOutput } from "./AnalysisOutput";
import { AnalysisHistory } from "./AnalysisHistory";
import { JournalChat } from "./JournalChat";
import { cn } from "@/lib/utils";

type ViewMode = "home" | "analyze" | "history" | "chat";

interface AnalysisResult {
  analysis: string;
  provider: "ollama" | "claude-opus";
}

export function AIAnalyzer() {
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getEntriesToday = useJournalStore((s) => s.getEntriesToday);
  const currentDraft = useJournalStore((s) => s.currentDraft);
  const saveAnalysis = useJournalStore((s) => s.saveAnalysis);
  const analysisHistory = useJournalStore((s) => s.analysisHistory);
  const conversations = useJournalStore((s) => s.conversations);
  const batchHistory = useTestModeStore((s) => s.batchHistory);
  const debateLogic = useTestModeStore((s) => s.debateLogic);
  const roles = useRoleStore((s) => s.roles);

  const handleAnalyze = async () => {
    setViewMode("analyze");
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      // Gather data
      const todayEntries = getEntriesToday();
      const last5Batches = batchHistory?.slice(-5) || [];

      // Get current prompts from roleStore
      const d1Role = roles.find((r) => r.id === "default-d1-responder");
      const d2Role = roles.find((r) => r.id === "default-d2-checker");
      const d3Role = roles.find((r) => r.id === "default-d3-verifier");
      const judgeRole = roles.find((r) => r.id === "default-judge");

      const promptsSnapshot = {
        d1: d1Role?.systemPrompt || "",
        d2: d2Role?.systemPrompt || "",
        d3: d3Role?.systemPrompt || "",
        judge: judgeRole?.systemPrompt || "",
      };

      // Call analysis API
      const response = await fetch("/api/journal/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalEntries: todayEntries,
          currentDraft,
          batchLogs: last5Batches,
          prompts: promptsSnapshot,
          debateLogic: {
            d1Prompt: "",
            d2Prompt: "",
            d3Prompt: "",
            judgePrompt: "",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Analysis failed");
      }

      const data: AnalysisResult = await response.json();
      setResult(data);

      // Save to history
      saveAnalysis(data.analysis, data.provider, {
        journalEntriesCount: todayEntries.length,
        batchLogsCount: last5Batches.length,
        promptsSnapshot,
      });
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(
        err.message || "Failed to analyze. Check if Ollama is running."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectFromHistory = (record: AnalysisRecord) => {
    setResult({
      analysis: record.analysis,
      provider: (record.provider as any) || "ollama",
    });
    setViewMode("analyze");
  };

  const hasData = batchHistory && batchHistory.length > 0;
  const historyCount = analysisHistory.length;
  const chatCount = conversations.length;

  // Chat view
  if (viewMode === "chat") {
    return <JournalChat onBack={() => setViewMode("home")} />;
  }

  // History view
  if (viewMode === "history") {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900/50">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("home")}
            >
              <History className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Analysis History
            </h2>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <AnalysisHistory onSelectAnalysis={handleSelectFromHistory} />
        </div>
      </div>
    );
  }

  // Analyze result view
  if (viewMode === "analyze") {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900/50">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode("home")}
              >
                <Brain className="h-4 w-4" />
              </Button>
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Analysis
              </h2>
              {result && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    result.provider === "ollama"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  )}
                >
                  {result.provider === "ollama" ? "Local" : "Claude Opus"}
                </span>
              )}
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              size="sm"
              className={cn(
                "gap-1.5 h-8 text-xs",
                "bg-indigo-600 hover:bg-indigo-700 text-white",
                "disabled:opacity-50"
              )}
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-3.5 w-3.5" />
                  Re-analyze
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    Analysis Failed
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-4 animate-pulse">
                <Brain className="h-8 w-8 text-indigo-500 animate-pulse" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Analyzing your recent activity...
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">
                Trying local model first, then cloud fallback
              </p>
            </div>
          )}

          {result && !analyzing && <AnalysisOutput content={result.analysis} />}
        </div>
      </div>
    );
  }

  // Home view - show options
  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900/50">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          AI Assistant
        </h2>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="p-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-4">
            <Sparkles className="h-8 w-8 text-indigo-500" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            How can I help?
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 max-w-xs">
            Get AI-powered insights or have a conversation about your test results.
          </p>

          {/* Action buttons */}
          <div className="w-full max-w-xs space-y-3">
            {/* Chat button - primary action */}
            <Button
              onClick={() => setViewMode("chat")}
              className="w-full gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            >
              <MessageSquare className="h-4 w-4" />
              Start Conversation
              {chatCount > 0 && (
                <span className="text-xs opacity-80">({chatCount})</span>
              )}
            </Button>

            {/* Analyze button */}
            <Button
              onClick={handleAnalyze}
              variant="outline"
              className="w-full gap-2"
            >
              <Brain className="h-4 w-4" />
              Quick Analysis
            </Button>

            {/* History button */}
            {historyCount > 0 && (
              <Button
                onClick={() => setViewMode("history")}
                variant="ghost"
                className="w-full gap-2 text-zinc-600 dark:text-zinc-400"
              >
                <History className="h-4 w-4" />
                View History ({historyCount})
              </Button>
            )}
          </div>

          {!hasData && (
            <div className="mt-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No batch logs found. Run some tests first for better insights.
              </p>
            </div>
          )}

          {/* Feature explanation */}
          <div className="mt-6 text-xs text-zinc-400 dark:text-zinc-600 space-y-2">
            <p className="font-medium text-zinc-500 dark:text-zinc-400">Features:</p>
            <div className="text-left space-y-1">
              <p><span className="text-teal-500">Chat:</span> Ask questions, discuss results, refine prompts</p>
              <p><span className="text-indigo-500">Analyze:</span> One-click summary with suggestions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
