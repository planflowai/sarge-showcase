"use client";

import { useEffect, useState, useCallback } from "react";
import { useDiagnosticsStore, type Finding, type ScanDepth } from "@/lib/stores/diagnosticsStore";
import { useProviderStore } from "@/lib/stores/providerStore";
import { useModelStore } from "@/lib/stores/modelStore";
import { fetchOllamaModels, type LocalModel } from "@/lib/providers/localModels";
import { groupOllamaModels } from "@/lib/ollamaModelGroups";
import { providers } from "@/lib/providers";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Download,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  Shield,
  ChevronRight,
  Loader2,
  FileCode,
  History,
  Settings2,
  RefreshCw,
  MessageSquarePlus,
  Send,
  X,
  ClipboardCopy,
} from "lucide-react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAirGapStore } from "@/lib/stores/airGapStore";

// ─────────────────────────────────────────────────────────────────────────────
// Severity Colors & Icons
// ─────────────────────────────────────────────────────────────────────────────

const severityColors = {
  critical: "text-red-500 bg-red-500/10 border-red-500/30",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};

// Severity-level icons — each level gets its own shape
const severityIcons = {
  critical: AlertCircle,    // filled circle with ! — unmistakable danger
  high: AlertTriangle,      // triangle warning
  medium: Shield,           // shield — needs attention
  low: Lightbulb,           // lightbulb — minor tip
};

// Severity-level colors for the group headers
const severityGroupColors = {
  critical: "text-red-500",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-emerald-400",
  info: "text-sky-400",
};

const typeIcons = {
  error: AlertCircle,
  warning: AlertTriangle,
  enhancement: Lightbulb,
  security: Shield,
};

const typeColors = {
  error: "text-orange-400",
  warning: "text-yellow-400",
  enhancement: "text-sky-400",
  security: "text-red-400",
};

// User-facing labels
const typeLabels: Record<string, string> = {
  security: "High",
  error: "Medium",
  warning: "Low",
  enhancement: "Info",
};

// Enhancement / Info specific color — a muted blue that works in both light & dark
const infoColors = "text-sky-400 bg-sky-400/10 border-sky-400/30";

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DiagnosticsPage() {
  // Store state
  const {
    hydrated,
    hydrate,
    isScanning,
    scanProgress,
    scanPhase,
    scanDepth,
    totalFiles,
    filesScanned,
    findings,
    selectedFindingId,
    canResume,
    lastScanTime,
    changelog,
    snapshots,
    analysisProvider,
    analysisModel,
    prefilledCustomRequest,
    startScan,
    stopScan,
    resumeScan,
    selectFinding,
    setScanDepth,
    setAnalysisProvider,
    setAnalysisModel,
    exportChangelog,
    exportScanReport,
    clearFindings,
    addFindings,
    completeScan,
    addChangeEntry,
    setPrefilledCustomRequest,
  } = useDiagnosticsStore();

  const { getDisplayName } = useModelStore();

  // Local state
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [customRequest, setCustomRequest] = useState("");
  const [customRequestTarget, setCustomRequestTarget] = useState("");
  const [isProcessingCustom, setIsProcessingCustom] = useState(false);
  const [customResult, setCustomResult] = useState<{
    explanation: string;
    suggestedFix: string;
    file: string;
    line: number;
    originalCode: string;
  } | null>(null);

  // Get app-wide provider/model for default fallback
  const {
    currentProvider: appProvider,
    currentModel: appModel,
    hydrated: providerHydrated,
    hydrate: hydrateProvider
  } = useProviderStore();

  // Hydrate stores
  useEffect(() => {
    if (!hydrated) hydrate();
    if (!providerHydrated) hydrateProvider();
  }, [hydrated, hydrate, providerHydrated, hydrateProvider]);

  // Sync diagnostics model with app's current provider/model on first load
  // This ensures the dropdown shows a valid model instead of being empty
  useEffect(() => {
    if (!hydrated || !providerHydrated) return;

    // Skip if still loading ollama models
    if (analysisProvider === "ollama" && ollamaLoading) return;

    // Check if the current selection is valid
    const isOllama = analysisProvider === "ollama";
    const availableModels = isOllama
      ? ollamaModels
      : providers.find(p => p.id === analysisProvider)?.models || [];

    // Check if current model exists in available models
    const modelExists = availableModels.some((m: any) =>
      isOllama ? m.id === analysisModel : m.id === analysisModel
    );

    // If model doesn't exist in available models, we need to fallback
    if (!modelExists || availableModels.length === 0) {
      // First try: use app's current provider/model
      if (appProvider && appModel && appProvider !== "ollama") {
        const appProviderModels = providers.find(p => p.id === appProvider)?.models || [];
        if (appProviderModels.some(m => m.id === appModel)) {
          setAnalysisProvider(appProvider);
          setAnalysisModel(appModel);
          return;
        }
      }

      // Second try: find first cloud provider with models
      for (const provider of providers.filter(p => p.type === "cloud")) {
        if (provider.models.length > 0) {
          setAnalysisProvider(provider.id as any);
          setAnalysisModel(provider.models[0].id);
          return;
        }
      }
    }
  }, [hydrated, providerHydrated, analysisProvider, analysisModel, appProvider, appModel, ollamaModels, ollamaLoading, setAnalysisProvider, setAnalysisModel]);

  // Load Ollama models when provider is ollama
  useEffect(() => {
    if (analysisProvider !== "ollama") return;
    setOllamaLoading(true);
    fetchOllamaModels()
      .then((models) => setOllamaModels(models))
      .catch(() => setOllamaModels([]))
      .finally(() => setOllamaLoading(false));
  }, [analysisProvider]);

  // Handle prefilled custom request (e.g., from Forensic Log "Diagnose" button)
  useEffect(() => {
    if (hydrated && prefilledCustomRequest) {
      // Auto-open Custom Request modal with prefilled data
      setCustomRequest(prefilledCustomRequest.request);
      setCustomRequestTarget(prefilledCustomRequest.target);
      setShowCustomRequest(true);
      // Clear the prefilled request after consuming it
      setPrefilledCustomRequest(null);
    }
  }, [hydrated, prefilledCustomRequest, setPrefilledCustomRequest]);

  // Get selected finding
  const selectedFinding = findings.find((f) => f.id === selectedFindingId);

  // Severity weight for sorting (higher = more important)
  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  // Group findings by severity level for clear visual hierarchy
  const findingsBySeverity = {
    critical: findings.filter((f) => f.severity === "critical"),
    high: findings.filter((f) => f.severity === "high"),
    medium: findings.filter((f) => f.severity === "medium"),
    low: findings.filter((f) => f.severity === "low"),
    info: findings.filter((f) => f.type === "enhancement"),
  };

  // Handle scan
  const handleStartScan = useCallback(async () => {
    startScan(scanDepth);

    try {
      const response = await fetch("/api/diagnostics/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depth: scanDepth }),
      });

      if (!response.ok) {
        throw new Error("Scan failed");
      }

      const data = await response.json();
      console.log("[diagnostics] Scan complete:", data);

      // Add all findings from the scan
      if (data.findings && data.findings.length > 0) {
        addFindings(data.findings);
      }

      // Mark scan as complete and show changelog
      completeScan();
      setShowChangelog(true);
    } catch (error) {
      console.error("[diagnostics] Scan error:", error);
      stopScan();
    }
  }, [scanDepth, startScan, stopScan, addFindings, completeScan]);

  // Handle export — downloads full scan report as JSON
  const handleExport = useCallback(() => {
    const json = exportScanReport();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sarge-diagnostics-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportScanReport]);

  // Copy scan report JSON to clipboard
  const handleCopyReport = useCallback(() => {
    const json = exportScanReport();
    navigator.clipboard.writeText(json);
  }, [exportScanReport]);

  // Get models for current provider
  const getModelsForProvider = () => {
    if (analysisProvider === "ollama") {
      return ollamaModels;
    }
    const provider = providers.find((p) => p.id === analysisProvider);
    return provider?.models || [];
  };

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Diagnostics Error">
    <div className="flex h-screen bg-zinc-100 dark:bg-zinc-950">
      {/* ─────────────────────────────────────────────────────────────────────
          LEFT SIDEBAR - Model Selection & Settings
      ───────────────────────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Diagnostics</h1>
          </div>
        </div>

        {/* Model Selection */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Analysis Model
          </h3>

          {/* Provider Selection */}
          <div className="space-y-1 mb-4">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setAnalysisProvider(p.id);
                  // Reset model to first available model for this provider
                  if (p.id !== "ollama" && p.models.length > 0) {
                    setAnalysisModel(p.models[0].id);
                  } else if (p.id === "ollama" && ollamaModels.length > 0) {
                    setAnalysisModel(ollamaModels[0].id);
                  }
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  analysisProvider === p.id
                    ? "bg-indigo-600/20 text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </button>
            ))}
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Model</label>
            {analysisProvider === "ollama" && ollamaLoading ? (
              <p className="text-xs text-zinc-400 py-2">Loading models...</p>
            ) : analysisProvider === "ollama" && ollamaModels.length === 0 ? (
              <div className="text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
                No Ollama models found. Is Ollama running?
              </div>
            ) : getModelsForProvider().length === 0 ? (
              <div className="text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
                No models available for this provider
              </div>
            ) : (
              <select
                value={analysisModel}
                onChange={(e) => setAnalysisModel(e.target.value)}
                className="w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 border-0 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500"
              >
                {analysisProvider === "ollama" ? (
                  groupOllamaModels(ollamaModels.map((m) => m.id)).map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  ))
                ) : (
                  getModelsForProvider().map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {getDisplayName(m.id, m.name)}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          MAIN CONTENT
      ───────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Toolbar — all actions in one bar */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            {/* ── Left group: Scan controls ── */}
            <div className="flex items-center gap-2">
              {!isScanning ? (
                <>
                  <Button
                    onClick={handleStartScan}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Scan Now
                  </Button>
                  {canResume && (
                    <Button variant="outline" onClick={resumeScan}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="destructive" onClick={stopScan}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}

              {/* Scan depth dropdown */}
              <select
                value={scanDepth}
                onChange={(e) => setScanDepth(e.target.value as ScanDepth)}
                className="rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="quick">Quick Look</option>
                <option value="standard">Standard</option>
                <option value="deep">Deep Dive</option>
              </select>
            </div>

            {/* ── Divider ── */}
            <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />

            {/* ── Center group: Actions ── */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                onClick={() => setShowCustomRequest(true)}
                className="text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/10"
              >
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Ask AI to Fix
              </Button>

              <Button
                variant="ghost"
                onClick={() => setShowChangelog(true)}
                className="text-zinc-600 dark:text-zinc-400"
              >
                <FileCode className="h-4 w-4 mr-2" />
                Results ({findings.length})
              </Button>

              <Button
                variant="ghost"
                onClick={() => setShowRollback(true)}
                className="text-zinc-600 dark:text-zinc-400"
              >
                <History className="h-4 w-4 mr-2" />
                Restore ({snapshots.length})
              </Button>

              {findings.length > 0 && !isScanning && (
                <Button variant="ghost" onClick={clearFindings} className="text-zinc-600 dark:text-zinc-400">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />

            {/* ── Right group: Export ── */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={findings.length === 0}
                className="text-zinc-500 dark:text-zinc-500"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyReport}
                disabled={findings.length === 0}
                className="text-zinc-500 dark:text-zinc-500"
              >
                <ClipboardCopy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>

            {/* ── Last scan time — far right ── */}
            {!isScanning && lastScanTime && (
              <span className="text-xs text-zinc-400 ml-auto whitespace-nowrap">
                Last scan: {new Date(lastScanTime).toLocaleString()}
              </span>
            )}
          </div>

          {/* Progress bar — below buttons when scanning */}
          {isScanning && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <span className="text-sm text-zinc-500 w-24">
                {filesScanned}/{totalFiles} files
              </span>
              <span className="text-xs text-zinc-400 capitalize">
                {scanPhase}
              </span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Findings List */}
          <div className="w-96 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
                Findings
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">{findings.length} issues found</p>
            </div>

            <ScrollArea className="flex-1">
              {findings.length === 0 ? (
                <div className="p-8 text-center">
                  <Settings2 className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
                  <p className="text-sm text-zinc-500">No findings yet</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Click &quot;Scan Now&quot; to analyze your codebase
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-3">
                  {findingsBySeverity.critical.length > 0 && (
                    <SeverityGroup
                      severity="critical"
                      label="Critical"
                      findings={findingsBySeverity.critical}
                      selectedId={selectedFindingId}
                      onSelect={selectFinding}
                    />
                  )}

                  {findingsBySeverity.high.length > 0 && (
                    <SeverityGroup
                      severity="high"
                      label="High"
                      findings={findingsBySeverity.high}
                      selectedId={selectedFindingId}
                      onSelect={selectFinding}
                    />
                  )}

                  {findingsBySeverity.medium.length > 0 && (
                    <SeverityGroup
                      severity="medium"
                      label="Medium"
                      findings={findingsBySeverity.medium}
                      selectedId={selectedFindingId}
                      onSelect={selectFinding}
                    />
                  )}

                  {findingsBySeverity.low.length > 0 && (
                    <SeverityGroup
                      severity="low"
                      label="Low"
                      findings={findingsBySeverity.low}
                      selectedId={selectedFindingId}
                      onSelect={selectFinding}
                    />
                  )}

                  {findingsBySeverity.info.length > 0 && (
                    <SeverityGroup
                      severity="info"
                      label="Enhancements"
                      findings={findingsBySeverity.info}
                      selectedId={selectedFindingId}
                      onSelect={selectFinding}
                    />
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Finding Detail */}
          <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 min-h-0 overflow-y-auto">
            {selectedFinding ? (
              <FindingDetail finding={selectedFinding} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <FileCode className="h-16 w-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
                  <p className="text-zinc-500">Select a finding to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Changelog Modal */}
      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}

      {/* Rollback Modal */}
      {showRollback && (
        <RollbackModal onClose={() => setShowRollback(false)} />
      )}

      {/* Custom Request Modal */}
      {showCustomRequest && (
        <CustomRequestModal
          isOpen={showCustomRequest}
          onClose={() => {
            setShowCustomRequest(false);
            setCustomRequest("");
            setCustomRequestTarget("");
            setCustomResult(null);
          }}
          request={customRequest}
          setRequest={setCustomRequest}
          target={customRequestTarget}
          setTarget={setCustomRequestTarget}
          isProcessing={isProcessingCustom}
          setIsProcessing={setIsProcessingCustom}
          result={customResult}
          setResult={setCustomResult}
          provider={analysisProvider}
          model={analysisModel}
          addChangeEntry={addChangeEntry}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Finding Group Component
// ─────────────────────────────────────────────────────────────────────────────

function SeverityGroup({
  severity,
  label,
  findings,
  selectedId,
  onSelect,
}: {
  severity: "critical" | "high" | "medium" | "low" | "info";
  label: string;
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Map severity to icon
  const iconMap = {
    critical: AlertCircle,
    high: AlertTriangle,
    medium: Shield,
    low: Lightbulb,
    info: Lightbulb,
  };
  const Icon = iconMap[severity];
  const color = severityGroupColors[severity];
  const [expanded, setExpanded] = useState(severity === "critical" || severity === "high");

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors ${color}`}
      >
        <ChevronRight
          className={`h-4 w-4 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
        />
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className="text-base font-semibold">{label}</span>
        <span className="text-sm text-zinc-500 ml-auto">({findings.length})</span>
      </button>

      {expanded && (
        <div className="space-y-1 mt-1 ml-3">
          {findings.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                selectedId === f.id
                  ? "bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="truncate flex-1 font-medium">{f.file.split("/").pop()}</span>
                <span className="text-zinc-500 text-xs">:{f.line}</span>
              </div>
              <p className="text-xs text-zinc-500 truncate mt-0.5">{f.message}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Finding Detail Component
// ─────────────────────────────────────────────────────────────────────────────

function FindingDetail({ finding }: { finding: Finding }) {
  const {
    analysisProvider,
    analysisModel,
    updateFindingWithAI,
    addPendingFix,
    createSnapshot,
    addChangeEntry,
    selectFinding,
    findings,
  } = useDiagnosticsStore();
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cloudFallbackUsed, setCloudFallbackUsed] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  const Icon = typeIcons[finding.type];

  const handleAnalyze = async () => {
    console.log("[diagnostics] Analyze clicked for:", finding.id, finding.file);
    console.log("[diagnostics] Using provider:", analysisProvider, "model:", analysisModel);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setCloudFallbackUsed(false);
    try {
      console.log("[diagnostics] Sending analyze request...");
      const requestBody = {
        finding,
        provider: analysisProvider,
        model: analysisModel,
        airGapMode: airGapEnabled,
      };
      console.log("[diagnostics] Request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch("/api/diagnostics/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      console.log("[diagnostics] Response status:", response.status);
      const data = await response.json();
      console.log("[diagnostics] Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      console.log("[diagnostics] Analysis result:", data);
      updateFindingWithAI(finding.id, data.explanation, data.suggestedFix);
      if (data.cloudFallback) {
        setCloudFallbackUsed(true);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Analysis failed";
      console.error("[diagnostics] Analysis error:", msg);
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyFix = async () => {
    if (!finding.suggestedFix || !finding.code) return;

    setIsApplying(true);
    setApplyError(null);

    try {
      const fix = {
        id: crypto.randomUUID(),
        findingId: finding.id,
        file: finding.file,
        line: finding.line,
        originalCode: finding.code,
        newCode: finding.suggestedFix,
        aiReasoning: finding.aiExplanation || "AI suggested fix",
        model: analysisModel,
        provider: analysisProvider,
      };

      const response = await fetch("/api/diagnostics/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fix }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to apply fix");
      }

      // Add to changelog
      addChangeEntry({
        file: finding.file,
        line: finding.line,
        originalCode: finding.code,
        newCode: finding.suggestedFix,
        aiReasoning: finding.aiExplanation || "AI suggested fix",
        model: analysisModel,
        provider: analysisProvider,
        snapshotId: data.snapshotId,
      });

      setApplySuccess(true);

      // Move to next finding after a brief delay
      setTimeout(() => {
        const currentIndex = findings.findIndex((f) => f.id === finding.id);
        const nextFinding = findings[currentIndex + 1];
        if (nextFinding) {
          selectFinding(nextFinding.id);
        }
      }, 1500);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to apply fix";
      console.error("[diagnostics] Apply fix error:", msg);
      setApplyError(msg);
    } finally {
      setIsApplying(false);
    }
  };

  const handleSkip = () => {
    // Move to next finding
    const currentIndex = findings.findIndex((f) => f.id === finding.id);
    const nextFinding = findings[currentIndex + 1];
    if (nextFinding) {
      selectFinding(nextFinding.id);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className={`p-3 rounded-xl ${severityColors[finding.severity]}`}>
          {(() => {
            const SevIcon = severityIcons[finding.severity] || AlertCircle;
            return <SevIcon className="h-7 w-7" />;
          })()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
                severityColors[finding.severity]
              }`}
            >
              {finding.severity}
            </span>
            <span className={`text-xs capitalize ${typeColors[finding.type]}`}>
              {finding.type}
            </span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
            {finding.message}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {finding.file}:{finding.line}
            {finding.column && `:${finding.column}`}
          </p>
        </div>
      </div>

      {/* Code Snippet */}
      {finding.code && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Code
          </h3>
          <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 text-sm overflow-x-auto">
            <code>{finding.code}</code>
          </pre>
        </div>
      )}

      {/* AI Analysis */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            AI Analysis
          </h3>
          {!finding.aiExplanation && (
            <Button size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze with AI"
              )}
            </Button>
          )}
        </div>

        {analysisError && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
            <p className="text-sm text-red-600 dark:text-red-400">{analysisError}</p>
          </div>
        )}

        {cloudFallbackUsed && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Ollama was unreachable — analysis was run via cloud fallback (Claude Haiku).
            </p>
          </div>
        )}

        {finding.aiExplanation ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {finding.aiExplanation}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            Click &quot;Analyze with AI&quot; to get an explanation and suggested fix
          </p>
        )}
      </div>

      {/* Apply Status Messages */}
      {applyError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{applyError}</p>
        </div>
      )}

      {applySuccess && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-600 dark:text-green-400">Fix applied successfully! Moving to next finding...</p>
        </div>
      )}

      {/* Suggested Fix */}
      {finding.suggestedFix && (
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Suggested Fix
          </h3>
          <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 text-sm overflow-x-auto mb-4">
            <code>{finding.suggestedFix}</code>
          </pre>
          <div className="flex gap-2">
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={handleApplyFix}
              disabled={isApplying || applySuccess}
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : applySuccess ? (
                "Applied!"
              ) : (
                "Apply Fix"
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowDiff(true)}>
              Preview Diff
            </Button>
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
          </div>
        </div>
      )}

      {/* Preview Diff Modal */}
      {showDiff && finding.code && finding.suggestedFix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Preview Changes
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowDiff(false)}>
                ✕
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-zinc-500 mb-2">
                  {finding.file}:{finding.line}
                </h3>
              </div>

              <div>
                <h4 className="text-xs font-medium text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">−</span>
                  Original
                </h4>
                <pre className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm overflow-x-auto">
                  <code>{finding.code}</code>
                </pre>
              </div>

              <div>
                <h4 className="text-xs font-medium text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400">+</span>
                  Suggested Fix
                </h4>
                <pre className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-300 rounded-lg p-3 text-sm overflow-x-auto">
                  <code>{finding.suggestedFix}</code>
                </pre>
              </div>

              {finding.aiExplanation && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">AI Reasoning</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3">
                    {finding.aiExplanation}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowDiff(false)}>
                Cancel
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  setShowDiff(false);
                  handleApplyFix();
                }}
                disabled={isApplying}
              >
                Apply Fix
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Changelog Modal
// ─────────────────────────────────────────────────────────────────────────────

function ChangelogModal({ onClose }: { onClose: () => void }) {
  const { changelog, findings, scanDepth, lastScanTime, totalFiles, filesScanned, exportScanReport, clearChangelog } = useDiagnosticsStore();
  const [tab, setTab] = useState<'findings' | 'changelog'>(findings.length > 0 ? 'findings' : 'changelog');
  const [copied, setCopied] = useState(false);

  // Severity weight for sorting
  const sevWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  // Sort findings: critical first, then security, then by severity
  const sortedFindings = [...findings].sort((a, b) => {
    // Critical severity first
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    // Security type second
    if (a.type === 'security' && b.type !== 'security') return -1;
    if (b.type === 'security' && a.type !== 'security') return 1;
    // Then by severity weight
    return (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0);
  });

  const handleExport = () => {
    const json = exportScanReport();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sarge-diagnostics-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportScanReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const summary = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    enhancements: findings.filter(f => f.type === 'enhancement').length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Scan Report
            </h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                <ClipboardCopy className="h-4 w-4 mr-1" />
                {copied ? 'Copied!' : 'Copy JSON'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>

          {/* Summary bar */}
          {findings.length > 0 && (
            <div className="flex items-center gap-3 text-xs mb-3">
              <span className="text-zinc-500">{filesScanned}/{totalFiles} files · {scanDepth} scan{lastScanTime ? ` · ${new Date(lastScanTime).toLocaleString()}` : ''}</span>
              <span className="ml-auto flex gap-2">
                {summary.critical > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">{summary.critical} Critical</span>}
                {summary.high > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-400/15 text-orange-400">{summary.high} High</span>}
                {summary.medium > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-400/15 text-yellow-400">{summary.medium} Medium</span>}
                {summary.low > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400">{summary.low} Low</span>}
                {summary.enhancements > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-400/15 text-sky-400">{summary.enhancements} Info</span>}
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setTab('findings')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${tab === 'findings' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Findings ({findings.length})
            </button>
            <button
              onClick={() => setTab('changelog')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${tab === 'changelog' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Applied Fixes ({changelog.length})
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {tab === 'findings' ? (
            sortedFindings.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No findings. Run a scan first.</p>
            ) : (
              <div className="space-y-2">
                {sortedFindings.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColors[f.type]}`}>
                        {typeLabels[f.type] || f.type}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${severityColors[f.severity]}`}>
                        {f.severity}
                      </span>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                        {f.file}:{f.line}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{f.message}</p>
                    {f.code && (
                      <pre className="mt-1.5 text-[11px] bg-zinc-100 dark:bg-zinc-900 rounded px-2 py-1 text-zinc-500 overflow-x-auto">{f.code.trim()}</pre>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
          changelog.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">No fixes applied yet</p>
          ) : (
            <div className="space-y-3">
              {changelog.map((entry: any) => (
                <div
                  key={entry.id}
                  className={`p-3 rounded-lg border ${
                    entry.rolledBack
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {entry.file}:{entry.line}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                    {entry.aiReasoning}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400">
                      {entry.provider}/{entry.model}
                    </span>
                    {entry.rolledBack && (
                      <span className="text-red-500 font-medium">ROLLED BACK</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
          )}
        </ScrollArea>

        {changelog.length > 0 && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="destructive" size="sm" onClick={clearChangelog}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Changelog
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rollback Modal
// ─────────────────────────────────────────────────────────────────────────────

function RollbackModal({ onClose }: { onClose: () => void }) {
  const { snapshots, rollbackToSnapshot, deleteSnapshot } = useDiagnosticsStore();
  const [rolling, setRolling] = useState<string | null>(null);

  const handleRollback = async (id: string) => {
    setRolling(id);
    const success = await rollbackToSnapshot(id);
    setRolling(null);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Restore Points ({snapshots.length})
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          {snapshots.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">No snapshots available</p>
          ) : (
            <div className="space-y-3">
              {[...snapshots].reverse().map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {snapshot.description}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {snapshot.timestamp.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">
                    {snapshot.files.length} file(s): {snapshot.files.map((f) => f.path.split("/").pop()).join(", ")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRollback(snapshot.id)}
                      disabled={rolling !== null}
                    >
                      {rolling === snapshot.id ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          Rolling back...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3 mr-2" />
                          Rollback
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSnapshot(snapshot.id)}
                      disabled={rolling !== null}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Request Modal with Live Preview
// ─────────────────────────────────────────────────────────────────────────────

function CustomRequestModal({
  isOpen,
  onClose,
  request,
  setRequest,
  target,
  setTarget,
  isProcessing,
  setIsProcessing,
  result,
  setResult,
  provider,
  model,
  addChangeEntry,
}: {
  isOpen: boolean;
  onClose: () => void;
  request: string;
  setRequest: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  result: {
    explanation: string;
    suggestedFix: string;
    file: string;
    line: number;
    originalCode: string;
  } | null;
  setResult: (v: typeof result) => void;
  provider: string;
  model: string;
  addChangeEntry: (entry: any) => void;
}) {
  const { createSnapshot, snapshots, rollbackToSnapshot, undoLast, pushToUndoStack, undoStack } = useDiagnosticsStore();
  const [error, setError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("/");
  const [lastSnapshotId, setLastSnapshotId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Determine preview URL based on target file
  const getPreviewUrl = (file: string): string => {
    if (file.includes("Header") || file.includes("Sidebar") || file.includes("layout")) return "/";
    if (file.includes("settings")) return "/settings";
    if (file.includes("debate")) return "/debate";
    if (file.includes("journal")) return "/journal";
    if (file.includes("library")) return "/library";
    if (file.includes("diagnostics")) return "/diagnostics";
    return "/";
  };

  const handleSubmit = async () => {
    if (!request.trim()) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/diagnostics/custom-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: request.trim(),
          targetFile: target.trim() || undefined,
          provider,
          model,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      setResult(data);
      setPreviewUrl(getPreviewUrl(data.file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = async () => {
    if (!result) return;

    setIsApplying(true);
    setError(null);

    try {
      const fix = {
        id: crypto.randomUUID(),
        findingId: "custom-request",
        file: result.file,
        line: result.line,
        originalCode: result.originalCode,
        newCode: result.suggestedFix,
        aiReasoning: result.explanation,
        model,
        provider,
      };

      const response = await fetch("/api/diagnostics/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fix }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to apply changes");
      }

      // Store snapshot ID for undo (both local state and undo stack)
      setLastSnapshotId(data.snapshotId);
      pushToUndoStack(data.snapshotId);

      addChangeEntry({
        file: result.file,
        line: result.line,
        originalCode: result.originalCode,
        newCode: result.suggestedFix,
        aiReasoning: result.explanation,
        model,
        provider,
        snapshotId: data.snapshotId,
      });

      setApplySuccess(true);
      setShowPreview(true);
      setShowConfirmDialog(false);

      // Refresh preview after a short delay for hot reload
      setTimeout(() => {
        setPreviewKey((k) => k + 1);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setIsApplying(false);
    }
  };

  const handleUndo = async () => {
    setIsApplying(true);
    setError(null);

    try {
      // Use the undo stack for multi-level undo
      const success = await undoLast();
      if (success) {
        setApplySuccess(false);
        setLastSnapshotId(null);
        setResult(null);
        setRequest("");
        // Refresh preview
        setTimeout(() => {
          setPreviewKey((k) => k + 1);
        }, 1000);
      } else {
        setError("No more undo levels available");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50">
      {/* Main Panel */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Custom Request
            </h2>
            <div className="flex items-center gap-2">
              {applySuccess && lastSnapshotId && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUndo}
                  disabled={isApplying}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Undo
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Quick File Shortcuts */}
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">
                Select Target File
              </label>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[
                  { label: "Header/Nav", file: "components/layout/Header.tsx" },
                  { label: "Sidebar", file: "components/layout/Sidebar.tsx" },
                  { label: "Home Page", file: "app/page.tsx" },
                  { label: "Settings", file: "app/settings/page.tsx" },
                  { label: "Debate", file: "app/debate/page.tsx" },
                  { label: "Diagnostics", file: "app/diagnostics/page.tsx" },
                  { label: "Chat Input", file: "components/chat/ChatInput.tsx" },
                  { label: "Chat Messages", file: "components/chat/ChatMessages.tsx" },
                  { label: "Journal", file: "app/journal/page.tsx" },
                  { label: "Library", file: "app/library/page.tsx" },
                  { label: "Live Checker", file: "app/live-checker/page.tsx" },
                  { label: "Model Selector", file: "components/ModelSelector.tsx" },
                ].map((item) => (
                  <button
                    key={item.file}
                    onClick={() => setTarget(item.file)}
                    disabled={isProcessing || applySuccess}
                    className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                      target === item.file
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-indigo-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Or type a custom path..."
                className="w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 border-0 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-500"
                disabled={isProcessing || applySuccess}
              />
              {target && (
                <p className="text-xs text-indigo-500 mt-1">
                  Selected: {target}
                </p>
              )}
            </div>

            {/* Request Input */}
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">
                What would you like to change?
              </label>
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="e.g., Make the nav bar smaller, Add a logout button to the header, Change the primary color to blue..."
                className="w-full h-24 rounded-lg bg-zinc-100 dark:bg-zinc-800 border-0 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-500 resize-none"
                disabled={isProcessing || applySuccess}
              />
            </div>

            {/* Submit Button */}
            {!result && !applySuccess && (
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={handleSubmit}
                disabled={isProcessing || !request.trim()}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Success with Undo */}
            {applySuccess && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Changes applied successfully!
                    </p>
                    <p className="text-xs text-green-500 mt-1">
                      Check the preview to see your changes. Click Undo to revert.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleUndo}
                      disabled={isApplying}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Undo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setApplySuccess(false);
                        setResult(null);
                        setRequest("");
                        setLastSnapshotId(null);
                      }}
                    >
                      New Request
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Result - Before Apply */}
            {result && !applySuccess && (
              <div className="space-y-3">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
                  <h3 className="text-xs font-medium text-zinc-500 mb-1">AI Explanation</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {result.explanation}
                  </p>
                </div>

                <div className="text-xs text-zinc-500">
                  {result.file}:{result.line}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <h4 className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Original</h4>
                    <pre className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 rounded-lg p-2 text-xs overflow-x-auto max-h-32">
                      <code>{result.originalCode}</code>
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">New Code</h4>
                    <pre className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-300 rounded-lg p-2 text-xs overflow-x-auto max-h-32">
                      <code>{result.suggestedFix}</code>
                    </pre>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={isApplying}
                  >
                    Apply Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                      setRequest("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Undo Stack Info */}
            {undoStack.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {undoStack.length} undo level{undoStack.length > 1 ? "s" : ""} available
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    disabled={isApplying}
                    className="text-blue-600 dark:text-blue-400 h-6 px-2"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Undo Last
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && result && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Confirm Changes
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Are you sure you want to apply these changes to <span className="font-mono text-indigo-600 dark:text-indigo-400">{result.file}</span>?
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-zinc-500 mb-1">This will:</p>
              <ul className="text-xs text-zinc-600 dark:text-zinc-400 list-disc list-inside space-y-1">
                <li>Create a backup snapshot (auto-rollback available)</li>
                <li>Replace the original code with the suggested fix</li>
                <li>Trigger a hot reload of your app</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                onClick={handleApply}
                disabled={isApplying}
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  "Yes, Apply Changes"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Panel */}
      {showPreview && (
        <div className="w-[500px] flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 border-l border-zinc-300 dark:border-zinc-700 flex flex-col">
          <div className="p-3 border-b border-zinc-300 dark:border-zinc-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Live Preview</h3>
            <div className="flex items-center gap-2">
              <select
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                className="text-xs bg-zinc-200 dark:bg-zinc-800 border-0 rounded px-2 py-1 text-zinc-700 dark:text-zinc-300"
              >
                <option value="/">Home</option>
                <option value="/settings">Settings</option>
                <option value="/debate">Debate</option>
                <option value="/journal">Journal</option>
                <option value="/library">Library</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewKey((k) => k + 1)}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex-1 bg-white">
            <iframe
              key={previewKey}
              src={previewUrl}
              className="w-full h-full border-0"
              title="Live Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
