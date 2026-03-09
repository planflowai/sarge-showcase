"use client";

import React, { useState, useCallback, useRef } from "react";
import { X, Search, Loader2, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";

interface ModelResult {
  model: string;
  current: { input: number; output: number };
  found: { input: number; output: number };
  changed: boolean;
}

interface ProviderResult {
  provider: string;
  models: ModelResult[];
  checked: number;
  changed: number;
}

interface ProviderStatus {
  status: "pending" | "searching" | "extracting" | "done" | "error";
  message: string;
  result?: ProviderResult;
}

const CHECKER_MODELS = [
  { label: "Grok 4 Fast", provider: "xai", model: "grok-4-fast" },
  { label: "DeepSeek V3.2", provider: "deepseek", model: "deepseek-chat" },
  { label: "Gemini 2.0 Flash", provider: "google", model: "gemini-2.0-flash" },
  { label: "Mistral Small", provider: "mistral", model: "mistral-small-latest" },
  { label: "GPT-4o Mini", provider: "openai", model: "gpt-4o-mini" },
];

const PROVIDERS = ["anthropic", "openai", "google", "xai", "deepseek", "mistral"];

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic", openai: "OpenAI", google: "Google",
  xai: "xAI", deepseek: "DeepSeek", mistral: "Mistral",
};

function fmtCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.10) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function pctDiff(current: number, found: number): string {
  if (current === 0 && found === 0) return "—";
  if (current === 0) return "+∞";
  const pct = ((found - current) / current) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

export function CheckPricesModal({ onClose }: { onClose: () => void }) {
  const [selectedChecker, setSelectedChecker] = useState(0);
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>(() => {
    const init: Record<string, ProviderStatus> = {};
    PROVIDERS.forEach(p => { init[p] = { status: "pending", message: "Pending" }; });
    return init;
  });
  const [allChanges, setAllChanges] = useState<Array<ModelResult & { provider: string }>>([]);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [applyingAll, setApplyingAll] = useState(false);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startCheck = useCallback(async () => {
    setRunning(true);
    setDone(false);
    setAllChanges([]);
    setApplied(new Set());
    setSkipped(new Set());

    const init: Record<string, ProviderStatus> = {};
    PROVIDERS.forEach(p => { init[p] = { status: "pending", message: "Pending" }; });
    setStatuses(init);

    const checker = CHECKER_MODELS[selectedChecker];
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/billing/check-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractionProvider: checker.provider,
          model: checker.model,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.event === "status") {
              setStatuses(prev => ({
                ...prev,
                [event.provider]: {
                  status: event.message.includes("Searching") ? "searching" : "extracting",
                  message: event.message,
                },
              }));
            } else if (event.event === "result") {
              const pr = event as ProviderResult & { event: string };
              setStatuses(prev => ({
                ...prev,
                [pr.provider]: {
                  status: "done",
                  message: `${pr.checked} checked, ${pr.changed} changed`,
                  result: pr,
                },
              }));
              // Collect changes
              const changes = (pr.models || [])
                .filter((m: ModelResult) => m.changed)
                .map((m: ModelResult) => ({ ...m, provider: pr.provider }));
              if (changes.length > 0) {
                setAllChanges(prev => [...prev, ...changes]);
              }
            } else if (event.event === "error") {
              setStatuses(prev => ({
                ...prev,
                [event.provider]: { status: "error", message: event.message },
              }));
            } else if (event.event === "done") {
              setDone(true);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[CheckPrices]", err);
      }
    }

    setRunning(false);
  }, [selectedChecker]);

  const applyOne = useCallback(async (change: ModelResult & { provider: string }) => {
    try {
      const checker = CHECKER_MODELS[selectedChecker];
      await fetch("/api/billing/check-prices/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ model: change.model, input: change.found.input, output: change.found.output }],
          checkedWith: checker.model,
        }),
      });
      setApplied(prev => new Set([...prev, change.model]));
    } catch (err) {
      console.error("[ApplyOne]", err);
    }
  }, [selectedChecker]);

  const applyAll = useCallback(async () => {
    setApplyingAll(true);
    const unapplied = allChanges.filter(c => !applied.has(c.model) && !skipped.has(c.model));
    if (unapplied.length === 0) { setApplyingAll(false); return; }
    try {
      const checker = CHECKER_MODELS[selectedChecker];
      await fetch("/api/billing/check-prices/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: unapplied.map(c => ({ model: c.model, input: c.found.input, output: c.found.output })),
          checkedWith: checker.model,
        }),
      });
      setApplied(prev => new Set([...prev, ...unapplied.map(c => c.model)]));
    } catch (err) {
      console.error("[ApplyAll]", err);
    }
    setApplyingAll(false);
  }, [allChanges, applied, skipped, selectedChecker]);

  const stopCheck = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const unappliedCount = allChanges.filter(c => !applied.has(c.model) && !skipped.has(c.model)).length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-8">
      <div className="bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-[800px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-400" />
            <span className="text-lg font-bold text-white">Check Prices</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {/* Model selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-zinc-300">Checker Model:</label>
            <div className="relative">
              <select
                value={selectedChecker}
                onChange={(e) => setSelectedChecker(Number(e.target.value))}
                disabled={running}
                className="appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 pr-8 text-sm font-bold text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
              >
                {CHECKER_MODELS.map((m, i) => (
                  <option key={i} value={i}>{m.label} ({m.provider})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
            {!running && !done && (
              <button
                onClick={startCheck}
                className="px-4 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 rounded-lg text-sm font-bold transition-all"
              >
                Start Check
              </button>
            )}
            {running && (
              <button
                onClick={stopCheck}
                className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-300 rounded-lg text-sm font-bold transition-all"
              >
                Stop
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="space-y-1.5">
            {PROVIDERS.map(provider => {
              const ps = statuses[provider];
              return (
                <div key={provider} className="flex items-center gap-3 px-3 py-2 bg-zinc-900/60 rounded-lg">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {ps.status === "done" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {ps.status === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
                    {(ps.status === "searching" || ps.status === "extracting") && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                    {ps.status === "pending" && <div className="w-3 h-3 rounded-full bg-zinc-700" />}
                  </div>
                  <span className="text-sm font-bold text-zinc-200 w-24">{PROVIDER_LABELS[provider]}</span>
                  <span className={`text-sm ${ps.status === "error" ? "text-red-400" : ps.status === "done" ? "text-zinc-400" : "text-zinc-500"}`}>
                    {ps.message}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Changes table */}
          {allChanges.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">
                  Changes Found ({allChanges.length})
                </span>
                {unappliedCount > 0 && (
                  <button
                    onClick={applyAll}
                    disabled={applyingAll}
                    className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                  >
                    {applyingAll ? "Applying..." : `Apply All (${unappliedCount})`}
                  </button>
                )}
              </div>
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-900/80">
                      <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400 uppercase">Model</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-zinc-400 uppercase">Current In/Out</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-zinc-400 uppercase">Found In/Out</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-zinc-400 uppercase">Diff</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-zinc-400 uppercase w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allChanges.map((c) => {
                      const isApplied = applied.has(c.model);
                      const isSkipped = skipped.has(c.model);
                      const inputPct = pctDiff(c.current.input, c.found.input);
                      const outputPct = pctDiff(c.current.output, c.found.output);
                      const cheaper = c.found.input <= c.current.input && c.found.output <= c.current.output;

                      return (
                        <tr key={c.model} className={`border-t border-zinc-800/50 ${isApplied ? "opacity-50" : ""}`}>
                          <td className="px-3 py-2 font-bold text-zinc-200">{c.model}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-400">
                            {fmtCost(c.current.input)}/{fmtCost(c.current.output)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-white">
                            {fmtCost(c.found.input)}/{fmtCost(c.found.output)}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono text-sm ${cheaper ? "text-emerald-400" : "text-red-400"}`}>
                            {inputPct}/{outputPct}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {isApplied ? (
                              <span className="text-emerald-400 text-xs font-bold">Applied</span>
                            ) : isSkipped ? (
                              <span className="text-zinc-500 text-xs font-bold">Skipped</span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => applyOne(c)}
                                  className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 rounded text-xs font-bold transition-all"
                                >
                                  Apply
                                </button>
                                <button
                                  onClick={() => setSkipped(prev => new Set([...prev, c.model]))}
                                  className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-400 rounded text-xs font-bold transition-all"
                                >
                                  Skip
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No changes message */}
          {done && allChanges.length === 0 && (
            <div className="text-center py-6">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-zinc-200">All prices are up to date</p>
              <p className="text-xs text-zinc-400 mt-1">No differences found across all providers</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">
            Overrides saved to rates-custom.json
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg text-sm font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
