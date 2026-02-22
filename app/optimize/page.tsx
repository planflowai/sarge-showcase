"use client";

import { useState, useEffect } from "react";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { getTestTheme } from "@/lib/types";
import { Brain, Settings2, ChevronDown, Play, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchOllamaModels, type LocalModel } from "@/lib/providers/localModels";

type OptimizeTab = 'ai' | 'logic';

// Model performance data structure
interface ModelPerformance {
  modelId: string;
  modelName: string;
  testsRun: number;
  catchRate: number;
  echoRate: number;
  avgLatency: number;
  avgTokens: number;
  kills: number;
}

// Recommendation structure
interface Recommendation {
  slot: 'D1' | 'D2' | 'D3' | 'Judge';
  currentModel: string;
  suggestedModel: string;
  reason: string;
  improvement: string;
  action: 'keep' | 'swap';
}

export default function OptimizePage() {
  const [activeTab, setActiveTab] = useState<OptimizeTab>('ai');
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Theme
  const mainTheme = useSettingsStore((s) => s.theme);
  const darkMode = mainTheme === "dark";
  const theme = getTestTheme(darkMode);

  // Store data
  const slots = useTestModeStore((s) => s.slots);
  const updateSlot = useTestModeStore((s) => s.updateSlot);
  const batchHistory = useTestModeStore((s) => s.batchHistory);
  const testHistory = useTestModeStore((s) => s.testHistory);
  const hydrateBatchHistory = useTestModeStore((s) => s.hydrateBatchHistory);
  const hydrateTestHistory = useTestModeStore((s) => s.hydrateTestHistory);

  // Local state for Logic tab
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedTestId, setSelectedTestId] = useState<string>('');

  // Hydrate history from localStorage on mount
  useEffect(() => {
    hydrateBatchHistory();
    hydrateTestHistory();
  }, [hydrateBatchHistory, hydrateTestHistory]);

  // Fetch Ollama models on mount
  useEffect(() => {
    fetchOllamaModels()
      .then(models => {
        setOllamaModels(models);
        setLoading(false);
      })
      .catch(() => {
        setOllamaModels([]);
        setLoading(false);
      });
  }, []);

  // Whether any real test data exists
  const hasRealData = batchHistory.length > 0 || testHistory.length > 0;

  // Calculate model performance from real batch/test history.
  // Per-model breakdowns are not yet stored in the history entries,
  // so we aggregate total test counts only and show 0 for untracked fields.
  const calculateModelPerformance = (): ModelPerformance[] => {
    if (!hasRealData) return []; // No data — show empty state

    // Count how many batch tests ran on local models (Ollama)
    const localBatches = batchHistory.filter(b => b.source === 'local');
    const totalLocalTests = localBatches.reduce((sum, b) => sum + b.testCount, 0);

    // Single-test history entries per model
    const localTests = testHistory.filter(t => t.source === 'local');

    return ollamaModels.map(model => {
      // Count single test runs that mention this model (best-effort from history)
      const modelTestRuns = localTests.filter(t =>
        t.passLogs?.some((log: any) => log.model === model.id)
      ).length;

      return {
        modelId: model.id,
        modelName: model.name,
        testsRun: modelTestRuns > 0 ? modelTestRuns : totalLocalTests > 0 ? totalLocalTests : 0,
        // Per-model accuracy tracking not yet implemented — show 0, not fake numbers
        catchRate: 0,
        echoRate: 0,
        avgLatency: 0,
        avgTokens: 0,
        kills: 0,
      };
    });
  };

  // Generate recommendations based on performance
  const generateRecommendations = (performance: ModelPerformance[]): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    const slotNames: ('D1' | 'D2' | 'D3' | 'Judge')[] = ['D1', 'D2', 'D3', 'Judge'];

    // Sort models by catch rate for recommendations
    const sortedByCatch = [...performance].sort((a, b) => b.catchRate - a.catchRate);
    const sortedBySpeed = [...performance].sort((a, b) => a.avgLatency - b.avgLatency);

    slotNames.forEach((slotName, index) => {
      const currentSlot = slots[index];
      const currentModel = currentSlot?.model || 'Not configured';

      // Find best model for this role
      let suggestedModel = currentModel;
      let reason = '';
      let improvement = '';
      let action: 'keep' | 'swap' = 'keep';

      if (index === 3) {
        // Judge - prioritize accuracy
        if (sortedByCatch[0] && sortedByCatch[0].modelId !== currentModel) {
          suggestedModel = sortedByCatch[0].modelId;
          reason = 'Higher accuracy for verdict decisions';
          improvement = `+${sortedByCatch[0].catchRate - (performance.find(p => p.modelId === currentModel)?.catchRate || 0)}% catch rate`;
          action = 'swap';
        } else {
          reason = 'Best accuracy model already assigned';
        }
      } else if (index === 0) {
        // D1 - balance speed and accuracy
        const balanced = performance.find(p => p.catchRate > 80 && p.avgLatency < 1.5);
        if (balanced && balanced.modelId !== currentModel) {
          suggestedModel = balanced.modelId;
          reason = 'Good balance of speed and accuracy';
          improvement = 'Faster response, maintains quality';
          action = 'swap';
        } else {
          reason = 'Current model has good balance';
        }
      } else {
        // D2, D3 - can use faster models
        if (sortedBySpeed[0] && sortedBySpeed[0].catchRate > 70 && sortedBySpeed[0].modelId !== currentModel) {
          suggestedModel = sortedBySpeed[0].modelId;
          reason = 'Faster cross-checking without sacrificing quality';
          improvement = `${((performance.find(p => p.modelId === currentModel)?.avgLatency || 1) - sortedBySpeed[0].avgLatency).toFixed(1)}s faster`;
          action = 'swap';
        } else {
          reason = 'Current model is efficient';
        }
      }

      recommendations.push({
        slot: slotName,
        currentModel,
        suggestedModel,
        reason,
        improvement,
        action,
      });
    });

    return recommendations;
  };

  const modelPerformance = calculateModelPerformance();
  const recommendations = generateRecommendations(modelPerformance);

  // Note: batchHistory and testHistory are used only to determine hasRealData above.

  // Apply a single recommendation
  const applyRecommendation = (rec: Recommendation) => {
    const slotIndex = ['D1', 'D2', 'D3', 'Judge'].indexOf(rec.slot);
    if (slotIndex >= 0) {
      updateSlot(slotIndex, { provider: 'ollama', model: rec.suggestedModel });
    }
  };

  // Apply all recommendations
  const applyAllRecommendations = () => {
    recommendations.forEach(rec => {
      if (rec.action === 'swap') {
        applyRecommendation(rec);
      }
    });
  };

  return (
    <div className={`flex h-full flex-col ${theme.bg}`}>
      {/* Header */}
      <div className={`shrink-0 px-6 py-4 border-b ${theme.border} ${theme.bgSecondary}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-indigo-500" />
            <h1 className={`text-xl font-bold ${theme.text}`}>Optimize</h1>
          </div>
          <p className={`text-sm ${theme.textSecondary}`}>
            Analyze test results and optimize model + logic configuration
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'ai'
                ? 'bg-indigo-500 text-white'
                : `${theme.bgSecondary} ${theme.textSecondary} hover:bg-zinc-200 dark:hover:bg-zinc-700`
            }`}
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Optimization
            </div>
          </button>
          <button
            onClick={() => setActiveTab('logic')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'logic'
                ? 'bg-purple-500 text-white'
                : `${theme.bgSecondary} ${theme.textSecondary} hover:bg-zinc-200 dark:hover:bg-zinc-700`
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Logic Optimization
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'ai' ? (
          <AIOptimizationTab
            theme={theme}
            loading={loading}
            ollamaModels={ollamaModels}
            modelPerformance={modelPerformance}
            recommendations={recommendations}
            applyRecommendation={applyRecommendation}
            applyAllRecommendations={applyAllRecommendations}
            slots={slots}
            hasRealData={hasRealData}
          />
        ) : (
          <LogicOptimizationTab
            theme={theme}
            batchHistory={batchHistory}
            testHistory={testHistory}
            selectedBatchId={selectedBatchId}
            setSelectedBatchId={setSelectedBatchId}
            selectedTestId={selectedTestId}
            setSelectedTestId={setSelectedTestId}
          />
        )}
      </div>
    </div>
  );
}

// ─── AI Optimization Tab ─────────────────────────────────────────────────────

interface AIOptimizationTabProps {
  theme: ReturnType<typeof getTestTheme>;
  loading: boolean;
  ollamaModels: LocalModel[];
  modelPerformance: ModelPerformance[];
  recommendations: Recommendation[];
  applyRecommendation: (rec: Recommendation) => void;
  applyAllRecommendations: () => void;
  slots: any[];
  hasRealData: boolean;
}

function AIOptimizationTab({
  theme,
  loading,
  ollamaModels,
  modelPerformance,
  recommendations,
  applyRecommendation,
  applyAllRecommendations,
  slots,
  hasRealData,
}: AIOptimizationTabProps) {
  const hasSwaps = recommendations.some(r => r.action === 'swap');

  return (
    <div className="space-y-6">
      {/* Empty state — no test data yet */}
      {!hasRealData && (
        <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-8 text-center`}>
          <Brain className="h-12 w-12 mx-auto mb-4 text-zinc-400 opacity-50" />
          <p className={`text-base font-semibold ${theme.text} mb-2`}>
            No test data available
          </p>
          <p className={`text-sm ${theme.textSecondary} mb-4`}>
            Run a Batch Test or Debate to generate real performance metrics.
          </p>
          <a
            href="/test"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="h-4 w-4" />
            Go to Test Mode
          </a>
        </div>
      )}

      {/* Recommendations Panel */}
      <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-bold ${theme.text}`}>Recommendations</h2>
          {hasSwaps && (
            <Button
              onClick={applyAllRecommendations}
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              Apply All Swaps
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recommendations.map((rec) => (
            <div
              key={rec.slot}
              className={`rounded-lg border p-3 ${
                rec.action === 'swap'
                  ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${theme.text}`}>{rec.slot}</span>
                {rec.action === 'swap' ? (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    SWAP
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    KEEP
                  </span>
                )}
              </div>

              {rec.action === 'swap' ? (
                <>
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <span className={`${theme.textSecondary} line-through`}>{rec.currentModel || 'None'}</span>
                    <ArrowRight className="h-3 w-3 text-amber-500" />
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{rec.suggestedModel}</span>
                  </div>
                  <p className={`text-[11px] ${theme.textSecondary} mb-2`}>{rec.reason}</p>
                  {rec.improvement && (
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{rec.improvement}</p>
                  )}
                  <Button
                    size="sm"
                    onClick={() => applyRecommendation(rec)}
                    className="mt-2 h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    Apply
                  </Button>
                </>
              ) : (
                <>
                  <p className={`text-xs font-medium ${theme.text}`}>{rec.currentModel || 'Not configured'}</p>
                  <p className={`text-[11px] ${theme.textSecondary} mt-1`}>{rec.reason}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Performance Matrix */}
      <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
        <h2 className={`text-lg font-bold ${theme.text} mb-4`}>Performance Matrix</h2>

        {loading ? (
          <div className={`text-center py-8 ${theme.textSecondary}`}>
            Loading models...
          </div>
        ) : ollamaModels.length === 0 ? (
          <div className={`text-center py-8 ${theme.textSecondary}`}>
            <p>No Ollama models found</p>
            <p className="text-xs mt-1">Make sure Ollama is running</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${theme.border}`}>
                  <th className={`text-left py-2 px-3 font-semibold ${theme.textSecondary}`}>Model</th>
                  <th className={`text-center py-2 px-3 font-semibold ${theme.textSecondary}`}>Tests</th>
                  <th className={`text-center py-2 px-3 font-semibold ${theme.textSecondary}`}>Catch %</th>
                  <th className={`text-center py-2 px-3 font-semibold ${theme.textSecondary}`}>Echo %</th>
                  <th className={`text-center py-2 px-3 font-semibold ${theme.textSecondary}`}>Latency</th>
                  <th className={`text-center py-2 px-3 font-semibold ${theme.textSecondary}`}>Tokens</th>
                  <th className={`text-center py-2 px-3 font-semibold ${theme.textSecondary}`}>Kills</th>
                </tr>
              </thead>
              <tbody>
                {modelPerformance.map((perf) => {
                  const isAssigned = slots.some(s => s.model === perf.modelId);
                  return (
                    <tr
                      key={perf.modelId}
                      className={`border-b ${theme.border} ${isAssigned ? 'bg-indigo-50 dark:bg-indigo-950/20' : ''}`}
                    >
                      <td className={`py-2 px-3 font-medium ${theme.text}`}>
                        {perf.modelName}
                        {isAssigned && (
                          <span className="ml-2 text-[10px] font-bold text-indigo-500">ASSIGNED</span>
                        )}
                      </td>
                      <td className={`text-center py-2 px-3 ${theme.textSecondary}`}>{perf.testsRun}</td>
                      <td className={`text-center py-2 px-3 font-semibold ${
                        perf.catchRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                        perf.catchRate >= 60 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {perf.catchRate}%
                      </td>
                      <td className={`text-center py-2 px-3 ${
                        perf.echoRate <= 5 ? 'text-emerald-600 dark:text-emerald-400' :
                        perf.echoRate <= 15 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {perf.echoRate}%
                      </td>
                      <td className={`text-center py-2 px-3 ${theme.textSecondary}`}>{perf.avgLatency.toFixed(1)}s</td>
                      <td className={`text-center py-2 px-3 ${theme.textSecondary}`}>{perf.avgTokens}</td>
                      <td className={`text-center py-2 px-3 font-semibold ${perf.kills > 0 ? 'text-red-500' : theme.textSecondary}`}>
                        {perf.kills}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className={`text-[10px] ${theme.textSecondary} mt-3`}>
          * Test count is derived from batch history. Per-model accuracy tracking (Catch %, Latency, etc.) requires per-run model tagging — coming soon.
        </p>
      </div>

      {/* Quick Model Test */}
      <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
        <h2 className={`text-lg font-bold ${theme.text} mb-4`}>Quick Model Test</h2>
        <p className={`text-sm ${theme.textSecondary} mb-4`}>
          Run a quick benchmark test on a single model to measure response time and quality.
        </p>
        <div className="flex items-center gap-3">
          <select className={`flex-1 rounded-lg border ${theme.border} ${theme.bg} ${theme.text} px-3 py-2 text-sm`}>
            <option value="">Select a model...</option>
            {ollamaModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
            <Play className="h-4 w-4 mr-2" />
            Run Test
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Logic Optimization Tab ──────────────────────────────────────────────────

interface LogicOptimizationTabProps {
  theme: ReturnType<typeof getTestTheme>;
  batchHistory: any[];
  testHistory: any[];
  selectedBatchId: string;
  setSelectedBatchId: (id: string) => void;
  selectedTestId: string;
  setSelectedTestId: (id: string) => void;
}

function LogicOptimizationTab({
  theme,
  batchHistory,
  testHistory,
  selectedBatchId,
  setSelectedBatchId,
  selectedTestId,
  setSelectedTestId,
}: LogicOptimizationTabProps) {
  const promptPools = useTestModeStore((s) => s.promptPools);
  const debateLogic = useTestModeStore((s) => s.debateLogic);

  return (
    <div className="space-y-6">
      {/* Run Selection */}
      <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
        <h2 className={`text-lg font-bold ${theme.text} mb-4`}>Select Run to Analyze</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Batch Run Dropdown */}
          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} uppercase mb-2`}>
              Batch Run
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className={`w-full rounded-lg border ${theme.border} ${theme.bg} ${theme.text} px-3 py-2 text-sm`}
            >
              <option value="">Select a batch run...</option>
              {batchHistory.map((batch) => (
                <option key={batch.batchId} value={batch.batchId}>
                  {new Date(batch.savedAt).toLocaleString()} - {batch.testCount} tests ({batch.source})
                </option>
              ))}
              {batchHistory.length === 0 && (
                <option disabled>No batch runs saved yet</option>
              )}
            </select>
          </div>

          {/* Test Run Dropdown */}
          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} uppercase mb-2`}>
              Single Test Run
            </label>
            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className={`w-full rounded-lg border ${theme.border} ${theme.bg} ${theme.text} px-3 py-2 text-sm`}
            >
              <option value="">Select a test run...</option>
              {testHistory.map((test) => (
                <option key={test.testId} value={test.testId}>
                  {new Date(test.savedAt).toLocaleString()} - {test.question.slice(0, 30)}... ({test.source})
                </option>
              ))}
              {testHistory.length === 0 && (
                <option disabled>No test runs saved yet</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Prompt Analysis */}
      <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
        <h2 className={`text-lg font-bold ${theme.text} mb-4`}>Prompt Configuration</h2>

        <div className="space-y-4">
          {(['d1', 'd2', 'd3', 'judge'] as const).map((agent) => (
            <div key={agent} className={`rounded-lg border ${theme.border} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${theme.text} uppercase`}>{agent}</span>
                <span className={`text-xs ${theme.textSecondary}`}>
                  {promptPools[agent]?.length || 0} prompts available
                </span>
              </div>
              <select className={`w-full rounded border ${theme.border} ${theme.bg} ${theme.text} px-2 py-1.5 text-xs`}>
                {promptPools[agent]?.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Debate Logic Templates */}
      <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
        <h2 className={`text-lg font-bold ${theme.text} mb-4`}>Debate Logic Templates</h2>

        <div className="space-y-3">
          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} uppercase mb-1`}>
              Challenge Keywords
            </label>
            <input
              type="text"
              defaultValue={debateLogic?.challengeKeywords || ''}
              className={`w-full rounded-lg border ${theme.border} ${theme.bg} ${theme.text} px-3 py-2 text-sm`}
              placeholder="incorrect, false, wrong, inaccurate..."
            />
            <p className={`text-[10px] ${theme.textSecondary} mt-1`}>
              Words that indicate an agent challenged a claim
            </p>
          </div>

          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} uppercase mb-1`}>
              Flag Keywords
            </label>
            <input
              type="text"
              defaultValue={debateLogic?.flagKeywords || ''}
              className={`w-full rounded-lg border ${theme.border} ${theme.bg} ${theme.text} px-3 py-2 text-sm`}
              placeholder="suspicious, unverified, doubtful..."
            />
            <p className={`text-[10px] ${theme.textSecondary} mt-1`}>
              Words that indicate D3 flagged an issue
            </p>
          </div>

          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} uppercase mb-1`}>
              Caught Keywords
            </label>
            <input
              type="text"
              defaultValue={debateLogic?.caughtKeywords || ''}
              className={`w-full rounded-lg border ${theme.border} ${theme.bg} ${theme.text} px-3 py-2 text-sm`}
              placeholder="verdict: caught, detected, rejected..."
            />
            <p className={`text-[10px] ${theme.textSecondary} mt-1`}>
              Words that indicate the judge caught the poison
            </p>
          </div>
        </div>

        <Button className="mt-4 bg-purple-500 hover:bg-purple-600 text-white">
          Save Logic Changes
        </Button>
      </div>
    </div>
  );
}
