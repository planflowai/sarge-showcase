"use client";

import { useState, useCallback } from "react";
import { providers, fetchOllamaModels, type LocalModel } from "@sarge/core";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Radio,
  AlertTriangle,
  RefreshCw,
  Cloud,
  HardDrive,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Provider } from "@sarge/core";

interface RollCallResult {
  provider: Provider;
  model: string;
  requested: string;
  success: boolean;
  response?: string;
  error?: string;
  latencyMs: number;
}

export function RollCall() {
  const [cloudResults, setCloudResults] = useState<RollCallResult[]>([]);
  const [localResults, setLocalResults] = useState<RollCallResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const testModel = useCallback(
    async (provider: Provider, model: string): Promise<RollCallResult> => {
      try {
        const res = await fetch("/api/rollcall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, model }),
        });
        return await res.json();
      } catch (err) {
        return {
          provider,
          model,
          requested: `${provider}/${model}`,
          success: false,
          error: err instanceof Error ? err.message : "Request failed",
          latencyMs: 0,
        };
      }
    },
    []
  );

  const pullOllamaModel = useCallback(async (model: string) => {
    setPullingModel(model);
    try {
      const res = await fetch("http://localhost:11434/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: model, stream: false }),
      });
      if (res.ok) {
        const result = await testModel("ollama", model);
        setLocalResults((prev) => {
          const existing = prev.findIndex((r) => r.model === model);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = result;
            return updated;
          }
          return [...prev, result];
        });
      }
    } catch (err) {
      console.error("Failed to pull model:", err);
    } finally {
      setPullingModel(null);
    }
  }, [testModel]);

  const runRollCall = useCallback(async () => {
    setTesting(true);
    setCloudResults([]);
    setLocalResults([]);

    let localModels: LocalModel[] = [];
    try {
      localModels = await fetchOllamaModels();
      setOllamaModels(localModels);
    } catch {
      // Ollama not running
    }

    for (const p of providers) {
      if (p.type === "cloud" && p.models.length > 0) {
        for (const m of p.models) {
          setCurrentTest(`${p.id}/${m.id}`);
          const result = await testModel(p.id as Provider, m.id);
          setCloudResults((prev) => [...prev, result]);
        }
      }
    }

    for (const m of localModels) {
      setCurrentTest(`ollama/${m.id}`);
      const result = await testModel("ollama", m.id);
      setLocalResults((prev) => [...prev, result]);
    }

    setCurrentTest(null);
    setTesting(false);
  }, [testModel]);

  const testSingleModel = useCallback(
    async (provider: Provider, model: string) => {
      setCurrentTest(`${provider}/${model}`);
      const result = await testModel(provider, model);

      if (provider === "ollama") {
        setLocalResults((prev) => {
          const existing = prev.findIndex((r) => r.model === model);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = result;
            return updated;
          }
          return [...prev, result];
        });
      } else {
        setCloudResults((prev) => {
          const existing = prev.findIndex((r) => r.provider === provider && r.model === model);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = result;
            return updated;
          }
          return [...prev, result];
        });
      }
      setCurrentTest(null);
    },
    [testModel]
  );

  const toggleExpand = useCallback((key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const copyReport = useCallback(() => {
    const lines: string[] = [];
    const ts = new Date().toLocaleString();
    lines.push(`SARGE Roll Call Report — ${ts}`);
    lines.push("═".repeat(60));

    const formatSection = (title: string, results: RollCallResult[]) => {
      if (results.length === 0) return;
      const pass = results.filter(r => r.success).length;
      const fail = results.filter(r => !r.success).length;
      lines.push("");
      lines.push(`${title}  (${pass} pass / ${fail} fail)`);
      lines.push("─".repeat(60));
      for (const r of results) {
        const status = r.success ? "✓" : "✗";
        const response = r.success ? r.response || "" : r.error || "";
        const truncated = response.length > 80 ? response.substring(0, 80) + "…" : response;
        lines.push(`  ${status}  ${r.requested.padEnd(38)} ${r.latencyMs.toString().padStart(6)}ms  ${truncated}`);
      }
    };

    formatSection("CLOUD MODELS", cloudResults);
    formatSection("LOCAL MODELS (Ollama)", localResults);
    lines.push("");
    lines.push("─".repeat(60));
    lines.push("Generated by SARGE — The Foundry");

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [cloudResults, localResults]);

  const cloudPassCount = cloudResults.filter((r) => r.success).length;
  const cloudFailCount = cloudResults.filter((r) => !r.success).length;
  const localPassCount = localResults.filter((r) => r.success).length;
  const localFailCount = localResults.filter((r) => !r.success).length;

  const renderResultsTable = (
    results: RollCallResult[],
    isLocal: boolean
  ) => {
    if (results.length === 0) return null;

    return (
      <div className="rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm text-zinc-500 dark:text-zinc-400 font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm text-zinc-500 dark:text-zinc-400 font-semibold">Requested</th>
              <th className="px-4 py-3 text-left text-sm text-zinc-500 dark:text-zinc-400 font-semibold">Response</th>
              <th className="px-4 py-3 text-left text-sm text-zinc-500 dark:text-zinc-400 font-semibold">Latency</th>
              <th className="px-4 py-3 text-left text-sm text-zinc-500 dark:text-zinc-400 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {results.map((r, i) => {
              const isMismatch =
                r.success &&
                r.response &&
                !r.response.toLowerCase().includes(r.model.split("-")[0].toLowerCase()) &&
                !r.model.toLowerCase().includes(r.response.split("-")[0].toLowerCase());

              const canPull = isLocal && !r.success && r.error?.includes("not found");
              const rowKey = `${r.provider}/${r.model}`;
              const isExpanded = expandedRows.has(rowKey);
              const responseText = r.success ? r.response || "" : r.error || "";
              const isLong = responseText.length > 60;

              return (
                <tr
                  key={i}
                  className={
                    r.success
                      ? isMismatch
                        ? "bg-amber-100 dark:bg-amber-950/20"
                        : "bg-emerald-50 dark:bg-emerald-950/10"
                      : "bg-red-100 dark:bg-red-950/20"
                  }
                >
                  <td className="px-4 py-3">
                    {r.success ? (
                      isMismatch ? (
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      )
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-zinc-600 dark:text-zinc-300">
                    {r.requested}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-md">
                    <div className="flex items-start gap-1">
                      <span
                        className={`${
                          r.success
                            ? isMismatch ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        } ${isExpanded ? "whitespace-pre-wrap break-all" : "truncate block max-w-[300px]"}`}
                      >
                        {responseText}
                      </span>
                      {isLong && (
                        <button
                          onClick={() => toggleExpand(rowKey)}
                          className="flex-shrink-0 text-zinc-400 hover:text-zinc-200 mt-0.5"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {r.latencyMs}ms
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => testSingleModel(r.provider, r.model)}
                        disabled={currentTest === `${r.provider}/${r.model}`}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50"
                      >
                        Retest
                      </button>
                      {canPull && (
                        <button
                          onClick={() => pullOllamaModel(r.model)}
                          disabled={pullingModel === r.model}
                          className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 disabled:opacity-50 flex items-center gap-1"
                        >
                          {pullingModel === r.model ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Pulling...
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              Pull
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const hasResults = cloudResults.length > 0 || localResults.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Model Roll Call</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasResults && (
            <Button
              onClick={copyReport}
              variant="outline"
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Report
                </>
              )}
            </Button>
          )}
          <Button
            onClick={runRollCall}
            disabled={testing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Roll Call
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Tests each model directly (NO fallback) and reports what model actually responds.
        This helps verify that your selected model is actually being used.
      </p>

      {currentTest && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Testing: {currentTest}
        </div>
      )}

      {(cloudResults.length > 0 || testing) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              Cloud Models
            </h3>
            {cloudResults.length > 0 && (
              <div className="flex gap-3 ml-auto text-sm">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  {cloudPassCount}
                </span>
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  {cloudFailCount}
                </span>
              </div>
            )}
          </div>
          {renderResultsTable(cloudResults, false)}
        </div>
      )}

      {(localResults.length > 0 || testing) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              Local Models (Ollama)
            </h3>
            {localResults.length > 0 && (
              <div className="flex gap-3 ml-auto text-sm">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  {localPassCount}
                </span>
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  {localFailCount}
                </span>
              </div>
            )}
          </div>
          {localResults.length === 0 && !testing && (
            <p className="text-xs text-zinc-300 dark:text-zinc-400 italic">
              No Ollama models found. Make sure Ollama is running.
            </p>
          )}
          {renderResultsTable(localResults, true)}
        </div>
      )}

      {hasResults && (
        <div className="flex flex-wrap gap-5 text-sm text-zinc-400 dark:text-zinc-400 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Model responded correctly
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Name mismatch (may be training artifact)
          </span>
          <span className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            Model failed
          </span>
          <span className="flex items-center gap-1.5">
            <Download className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Pull missing Ollama model
          </span>
        </div>
      )}
    </div>
  );
}
