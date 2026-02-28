"use client";

import { useState, useCallback } from "react";
import { providers } from "@/lib/providers";
import { fetchOllamaModels, type LocalModel } from "@/lib/providers/localModels";
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
} from "lucide-react";
import type { Provider } from "@/lib/types";

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
        // Re-test the model after pulling
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

    // Fetch Ollama models first
    let localModels: LocalModel[] = [];
    try {
      localModels = await fetchOllamaModels();
      setOllamaModels(localModels);
    } catch {
      // Ollama not running
    }

    // Test ALL cloud provider models first
    for (const p of providers) {
      if (p.type === "cloud" && p.models.length > 0) {
        for (const m of p.models) {
          setCurrentTest(`${p.id}/${m.id}`);
          const result = await testModel(p.id as Provider, m.id);
          setCloudResults((prev) => [...prev, result]);
        }
      }
    }

    // Then test ALL Ollama models
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
              <th className="px-3 py-2 text-left text-zinc-600 dark:text-zinc-400 font-medium">Status</th>
              <th className="px-3 py-2 text-left text-zinc-600 dark:text-zinc-400 font-medium">Requested</th>
              <th className="px-3 py-2 text-left text-zinc-600 dark:text-zinc-400 font-medium">Response</th>
              <th className="px-3 py-2 text-left text-zinc-600 dark:text-zinc-400 font-medium">Latency</th>
              <th className="px-3 py-2 text-left text-zinc-600 dark:text-zinc-400 font-medium">Action</th>
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
                  <td className="px-3 py-2">
                    {r.success ? (
                      isMismatch ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      )
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {r.requested}
                  </td>
                  <td className="px-3 py-2 text-xs max-w-xs truncate">
                    {r.success ? (
                      <span
                        className={
                          isMismatch ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                        }
                      >
                        {r.response}
                      </span>
                    ) : (
                      <span className="text-red-700 dark:text-red-400">{r.error}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.latencyMs}ms
                  </td>
                  <td className="px-3 py-2 flex gap-2">
                    <button
                      onClick={() => testSingleModel(r.provider, r.model)}
                      disabled={currentTest === `${r.provider}/${r.model}`}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50"
                    >
                      Retest
                    </button>
                    {canPull && (
                      <button
                        onClick={() => pullOllamaModel(r.model)}
                        disabled={pullingModel === r.model}
                        className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 disabled:opacity-50 flex items-center gap-1"
                      >
                        {pullingModel === r.model ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Pulling...
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" />
                            Pull
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Model Roll Call</h2>
        </div>
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

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Tests each model directly (NO fallback) and reports what model actually responds.
        This helps verify that your selected model is actually being used.
      </p>

      {currentTest && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Testing: {currentTest}
        </div>
      )}

      {/* CLOUD MODELS SECTION */}
      {(cloudResults.length > 0 || testing) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              Cloud Models
            </h3>
            {cloudResults.length > 0 && (
              <div className="flex gap-3 ml-auto text-xs">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3 w-3" />
                  {cloudPassCount}
                </span>
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-3 w-3" />
                  {cloudFailCount}
                </span>
              </div>
            )}
          </div>
          {renderResultsTable(cloudResults, false)}
        </div>
      )}

      {/* LOCAL MODELS SECTION */}
      {(localResults.length > 0 || testing) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              Local Models (Ollama)
            </h3>
            {localResults.length > 0 && (
              <div className="flex gap-3 ml-auto text-xs">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3 w-3" />
                  {localPassCount}
                </span>
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-3 w-3" />
                  {localFailCount}
                </span>
              </div>
            )}
          </div>
          {localResults.length === 0 && !testing && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              No Ollama models found. Make sure Ollama is running.
            </p>
          )}
          {renderResultsTable(localResults, true)}
        </div>
      )}

      {/* Legend */}
      {(cloudResults.length > 0 || localResults.length > 0) && (
        <div className="flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Model responded correctly
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            Name mismatch (routing issue)
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
            Model failed
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
            Pull missing Ollama model
          </span>
        </div>
      )}
    </div>
  );
}
