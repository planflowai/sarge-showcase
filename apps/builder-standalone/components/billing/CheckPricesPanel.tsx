"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Sparkles,
  Play,
  Square,
  RotateCcw,
} from "lucide-react";

interface ModelResult {
  model: string;
  current: { input: number; output: number };
  found: { input: number; output: number };
  crossFound?: { input: number; output: number } | null;
  changed: boolean;
  confidence?: "confirmed" | "mismatch" | "single-source";
}

interface DiscoveredModel {
  model: string;
  input: number;
  output: number;
  provider: string;
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
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  deepseek: "DeepSeek",
  mistral: "Mistral",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#FF6700", openai: "#10B981", google: "#3B82F6",
  xai: "#A855F7", deepseek: "#06B6D4", mistral: "#FF7000",
};

function fmtCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function pctDiff(current: number, found: number): string {
  if (current === 0 && found === 0) return "—";
  if (current === 0) return "+∞";
  const pct = ((found - current) / current) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

export default function CheckPricesPanel() {
  const [selectedChecker, setSelectedChecker] = useState(0);
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>(() => {
    const init: Record<string, ProviderStatus> = {};
    PROVIDERS.forEach((p) => { init[p] = { status: "pending", message: "Pending" }; });
    return init;
  });
  const [allChanges, setAllChanges] = useState<Array<ModelResult & { provider: string }>>([]);
  const [discovered, setDiscovered] = useState<DiscoveredModel[]>([]);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [addedModels, setAddedModels] = useState<Set<string>>(new Set());
  const [applyingAll, setApplyingAll] = useState(false);
  const [done, setDone] = useState(false);
  const [sourcesInfo, setSourcesInfo] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Collapsible sections
  const [providerSectionsOpen, setProviderSectionsOpen] = useState<Record<string, boolean>>({});
  const [changesOpen, setChangesOpen] = useState(true);
  const [discoveredOpen, setDiscoveredOpen] = useState(true);

  const toggleProviderSection = (provider: string) => {
    setProviderSectionsOpen(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const startCheck = useCallback(async () => {
    setRunning(true);
    setDone(false);
    setAllChanges([]);
    setDiscovered([]);
    setApplied(new Set());
    setSkipped(new Set());
    setAddedModels(new Set());
    setSourcesInfo(null);
    setProviderSectionsOpen({});

    const init: Record<string, ProviderStatus> = {};
    PROVIDERS.forEach((p) => { init[p] = { status: "pending", message: "Pending" }; });
    setStatuses(init);

    const checker = CHECKER_MODELS[selectedChecker];
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/billing/check-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractionProvider: checker.provider, model: checker.model }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) { setRunning(false); return; }

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
                  status: event.message.includes("Fetching") ? "searching" : "extracting",
                  message: event.message,
                },
              }));
            } else if (event.event === "result") {
              const pr = event as ProviderResult & { event: string };
              setStatuses(prev => ({
                ...prev,
                [pr.provider]: { status: "done", message: `${pr.checked} checked, ${pr.changed} changed`, result: pr },
              }));
              const changes = (pr.models || [])
                .filter((m: ModelResult) => m.changed)
                .map((m: ModelResult) => ({ ...m, provider: pr.provider }));
              if (changes.length > 0) {
                setAllChanges(prev => [...prev, ...changes]);
              }
            } else if (event.event === "discovered") {
              const models = (event.models || []).map((m: { model: string; input: number; output: number }) => ({
                ...m, provider: event.provider,
              }));
              if (models.length > 0) {
                setDiscovered(prev => [...prev, ...models]);
              }
            } else if (event.event === "error") {
              setStatuses(prev => ({ ...prev, [event.provider]: { status: "error", message: event.message } }));
            } else if (event.event === "done") {
              setDone(true);
            } else if (event.event === "info") {
              if (event.sources) setSourcesInfo(event.sources as string);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error("[CheckPrices]", err);
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
    } catch (err) { console.error("[ApplyOne]", err); }
  }, [selectedChecker]);

  const applyAll = useCallback(async () => {
    setApplyingAll(true);
    const unapplied = allChanges.filter(c => !applied.has(c.model) && !skipped.has(c.model) && c.confidence === "confirmed");
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
    } catch (err) { console.error("[ApplyAll]", err); }
    setApplyingAll(false);
  }, [allChanges, applied, skipped, selectedChecker]);

  const addDiscoveredModel = useCallback(async (d: DiscoveredModel) => {
    try {
      const checker = CHECKER_MODELS[selectedChecker];
      await fetch("/api/billing/check-prices/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discovered: [{ model: d.model, provider: d.provider, name: d.model, input: d.input, output: d.output }],
          checkedWith: checker.model,
        }),
      });
      setAddedModels(prev => new Set([...prev, d.model]));
    } catch (err) { console.error("[AddDiscovered]", err); }
  }, [selectedChecker]);

  const addAllDiscovered = useCallback(async () => {
    const unadded = discovered.filter(d => !addedModels.has(d.model));
    if (unadded.length === 0) return;
    try {
      const checker = CHECKER_MODELS[selectedChecker];
      await fetch("/api/billing/check-prices/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discovered: unadded.map(d => ({ model: d.model, provider: d.provider, name: d.model, input: d.input, output: d.output })),
          checkedWith: checker.model,
        }),
      });
      setAddedModels(prev => new Set([...prev, ...unadded.map(d => d.model)]));
    } catch (err) { console.error("[AddAllDiscovered]", err); }
  }, [discovered, addedModels, selectedChecker]);

  const stopCheck = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const confirmedUnapplied = allChanges.filter(c => !applied.has(c.model) && !skipped.has(c.model) && c.confidence === "confirmed").length;
  const unaddedDiscovered = discovered.filter(d => !addedModels.has(d.model)).length;

  // Group discovered by provider
  const discoveredByProvider = discovered.reduce<Record<string, DiscoveredModel[]>>((acc, d) => {
    if (!acc[d.provider]) acc[d.provider] = [];
    acc[d.provider].push(d);
    return acc;
  }, {});

  // Summary counts
  const totalChecked = Object.values(statuses).reduce((s, ps) => s + (ps.result?.checked || 0), 0);
  const totalChanged = allChanges.length;
  const totalDiscovered = discovered.length;
  const doneProviders = Object.values(statuses).filter(ps => ps.status === "done").length;
  const errorProviders = Object.values(statuses).filter(ps => ps.status === "error").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Control Bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-shrink-0 bg-zinc-900/40">
        <Search className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <label className="text-base font-bold text-white">Extraction Model:</label>
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
          <button onClick={startCheck}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 rounded-lg text-sm font-bold transition-all">
            <Play className="w-3.5 h-3.5" /> Start Check
          </button>
        )}
        {running && (
          <button onClick={stopCheck}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-300 rounded-lg text-sm font-bold transition-all">
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        )}
        {done && !running && (
          <button onClick={startCheck}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 rounded-lg text-sm font-bold transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Re-run
          </button>
        )}

        {/* Summary stats */}
        <div className="flex-1" />
        {(running || done) && (
          <div className="flex items-center gap-4 text-sm font-bold">
            <span className="text-white">{doneProviders}/{PROVIDERS.length} providers</span>
            {errorProviders > 0 && <span className="text-red-400">{errorProviders} errors</span>}
            <span className="text-white">{totalChecked} models checked</span>
            {totalChanged > 0 && <span className="text-amber-300">{totalChanged} changes</span>}
            {totalDiscovered > 0 && <span className="text-amber-400">{totalDiscovered} discovered</span>}
          </div>
        )}
        {sourcesInfo && <span className="text-sm font-bold text-zinc-300">{sourcesInfo}</span>}
      </div>

      {/* ── Main Content — Two Column Layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Provider Status + Per-Provider Results */}
        <div className="flex flex-col w-[340px] flex-shrink-0 border-r border-zinc-800 overflow-auto">
          <div className="px-3 py-2 border-b border-zinc-800 flex-shrink-0">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Providers</h3>
          </div>
          {PROVIDERS.map((provider) => {
            const ps = statuses[provider];
            const color = PROVIDER_COLORS[provider] || "#888";
            const isOpen = providerSectionsOpen[provider] ?? false;
            const hasResults = ps.result && ps.result.models.length > 0;

            return (
              <div key={provider} className="border-b border-zinc-800/50">
                <button
                  onClick={() => hasResults && toggleProviderSection(provider)}
                  className={`flex items-center gap-2 w-full px-3 py-2.5 text-left transition-colors ${hasResults ? "hover:bg-zinc-800/50 cursor-pointer" : "cursor-default"}`}
                >
                  {/* Status icon */}
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {ps.status === "done" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {ps.status === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
                    {(ps.status === "searching" || ps.status === "extracting") && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                    {ps.status === "pending" && <div className="w-3 h-3 rounded-full bg-zinc-700" />}
                  </div>

                  {/* Provider name + color dot */}
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-base font-bold text-white flex-1">{PROVIDER_LABELS[provider]}</span>

                  {/* Stats */}
                  {ps.result && (
                    <span className="text-sm text-white font-bold">
                      {ps.result.checked} <span className="text-zinc-500">|</span>{" "}
                      <span className={ps.result.changed > 0 ? "text-amber-400" : "text-zinc-300"}>{ps.result.changed} chg</span>
                    </span>
                  )}
                  {!ps.result && ps.status !== "pending" && (
                    <span className={`text-sm font-bold truncate max-w-[140px] ${ps.status === "error" ? "text-red-400" : "text-zinc-300"}`}>
                      {ps.message}
                    </span>
                  )}

                  {/* Expand arrow */}
                  {hasResults && (
                    isOpen
                      ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded: show all models for this provider */}
                {isOpen && ps.result && (
                  <div className="bg-zinc-900/60 border-t border-zinc-800/50">
                    {ps.result.models.map((m) => {
                      const conf = m.confidence || "single-source";
                      return (
                        <div key={m.model} className={`flex items-center gap-2 px-4 py-2 text-sm border-b border-zinc-800/30 ${m.changed ? "bg-amber-500/5" : ""}`}>
                          <span className={`flex-1 font-bold truncate ${m.changed ? "text-amber-200" : "text-zinc-200"}`}>{m.model}</span>
                          <span className="font-mono font-bold text-zinc-300">{fmtCost(m.current.input)}/{fmtCost(m.current.output)}</span>
                          {m.changed && (
                            <>
                              <span className="text-zinc-600">→</span>
                              <span className="font-mono text-white">{fmtCost(m.found.input)}/{fmtCost(m.found.output)}</span>
                              {conf === "confirmed" && <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                              {conf === "mismatch" && <ShieldAlert className="w-3 h-3 text-red-400 flex-shrink-0" />}
                              {conf === "single-source" && <ShieldQuestion className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                            </>
                          )}
                          {!m.changed && <CheckCircle className="w-3 h-3 text-emerald-400/50 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: Changes + Discovered */}
        <div className="flex-1 overflow-auto">
          {/* No data state */}
          {!running && !done && allChanges.length === 0 && discovered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Search className="w-12 h-12 text-zinc-700 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Check Model Pricing</h3>
              <p className="text-base font-bold text-zinc-300 max-w-md">
                Fetches official pricing pages from each provider and cross-checks with pricepertoken.com.
                Select an extraction model and click Start to begin.
              </p>
            </div>
          )}

          {/* All prices up to date */}
          {done && allChanges.length === 0 && discovered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mb-3" />
              <h3 className="text-xl font-bold text-white">All Prices Up to Date</h3>
              <p className="text-base font-bold text-zinc-200 mt-1">No differences found across {doneProviders} providers ({totalChecked} models checked)</p>
            </div>
          )}

          {/* Price Changes Section */}
          {allChanges.length > 0 && (
            <div className="border-b border-zinc-800">
              <button
                onClick={() => setChangesOpen(!changesOpen)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {changesOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                  <span className="text-base font-bold text-white">Price Changes</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-sm font-bold">{allChanges.length}</span>
                  <span className="text-sm font-bold text-zinc-200 ml-2">
                    <span className="text-emerald-400">{allChanges.filter(c => c.confidence === "confirmed").length} confirmed</span>
                    {allChanges.filter(c => c.confidence === "mismatch").length > 0 && (
                      <>, <span className="text-red-400">{allChanges.filter(c => c.confidence === "mismatch").length} mismatch</span></>
                    )}
                    {allChanges.filter(c => c.confidence === "single-source").length > 0 && (
                      <>, <span className="text-amber-400">{allChanges.filter(c => c.confidence === "single-source").length} single source</span></>
                    )}
                  </span>
                </div>
                {confirmedUnapplied > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); applyAll(); }}
                    disabled={applyingAll}
                    className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {applyingAll ? "Applying..." : `Apply Confirmed (${confirmedUnapplied})`}
                  </button>
                )}
              </button>

              {changesOpen && (
                <div className="px-4 pb-3">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left px-3 py-2.5 text-sm font-bold text-white uppercase">Model</th>
                        <th className="text-left px-3 py-2.5 text-sm font-bold text-white uppercase">Provider</th>
                        <th className="text-right px-3 py-2.5 text-sm font-bold text-white uppercase">Current In/Out</th>
                        <th className="text-right px-3 py-2.5 text-sm font-bold text-white uppercase">Found In/Out</th>
                        <th className="text-right px-3 py-2.5 text-sm font-bold text-white uppercase">Diff</th>
                        <th className="text-center px-3 py-2.5 text-sm font-bold text-white uppercase">Confidence</th>
                        <th className="text-right px-3 py-2.5 text-sm font-bold text-white uppercase w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allChanges.map((c) => {
                        const isApplied = applied.has(c.model);
                        const isSkipped = skipped.has(c.model);
                        const inputPct = pctDiff(c.current.input, c.found.input);
                        const outputPct = pctDiff(c.current.output, c.found.output);
                        const cheaper = c.found.input <= c.current.input && c.found.output <= c.current.output;
                        const conf = c.confidence || "single-source";
                        const rowTint = conf === "confirmed" ? "" : conf === "mismatch" ? "bg-red-500/5" : "bg-amber-500/5";
                        const provColor = PROVIDER_COLORS[c.provider] || "#888";

                        return (
                          <tr key={c.model} className={`border-t border-zinc-800/50 ${rowTint} ${isApplied ? "opacity-50" : ""}`}>
                            <td className="px-3 py-2.5 font-bold text-white">{c.model}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: provColor + "33", color: provColor }}>
                                {c.provider}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-200">{fmtCost(c.current.input)}/{fmtCost(c.current.output)}</td>
                            <td className="px-3 py-2 text-right">
                              <span className="font-mono text-white">{fmtCost(c.found.input)}/{fmtCost(c.found.output)}</span>
                              {conf === "mismatch" && c.crossFound && (
                                <div className="text-[10px] text-red-400/70 font-mono mt-0.5">
                                  Cross: {fmtCost(c.crossFound.input)}/{fmtCost(c.crossFound.output)}
                                </div>
                              )}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono text-sm ${cheaper ? "text-emerald-400" : "text-red-400"}`}>
                              {inputPct}/{outputPct}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {conf === "confirmed" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs font-bold">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Confirmed
                                </span>
                              ) : conf === "mismatch" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-bold">
                                  <ShieldAlert className="w-3.5 h-3.5" /> Mismatch
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs font-bold">
                                  <ShieldQuestion className="w-3.5 h-3.5" /> Single Source
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {isApplied ? (
                                <span className="text-emerald-400 text-xs font-bold">Applied</span>
                              ) : isSkipped ? (
                                <span className="text-zinc-500 text-xs font-bold">Skipped</span>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => applyOne(c)}
                                    className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 rounded text-xs font-bold transition-all">
                                    Apply
                                  </button>
                                  <button onClick={() => setSkipped(prev => new Set([...prev, c.model]))}
                                    className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-400 rounded text-xs font-bold transition-all">
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
              )}
            </div>
          )}

          {/* Discovered Models Section */}
          {discovered.length > 0 && (
            <div className="border-b border-zinc-800">
              <button
                onClick={() => setDiscoveredOpen(!discoveredOpen)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {discoveredOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-base font-bold text-amber-300">New Models Discovered</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-sm font-bold">{discovered.length}</span>
                </div>
                {unaddedDiscovered > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); addAllDiscovered(); }}
                    className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 rounded-lg text-xs font-bold transition-all"
                  >
                    Add All ({unaddedDiscovered})
                  </button>
                )}
              </button>

              {discoveredOpen && (
                <div className="px-4 pb-3">
                  <p className="text-sm font-bold text-zinc-300 mb-3">
                    Models found on pricing pages not in your rate database. Add them to track billing + use in Forge Trials.
                  </p>
                  {/* Group by provider */}
                  {Object.entries(discoveredByProvider).map(([provider, models]) => {
                    const provColor = PROVIDER_COLORS[provider] || "#888";
                    return (
                      <div key={provider} className="mb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: provColor }} />
                          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: provColor }}>
                            {PROVIDER_LABELS[provider] || provider} ({models.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {models.map((d) => {
                            const isAdded = addedModels.has(d.model);
                            return (
                              <div key={`${d.provider}-${d.model}`}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${isAdded ? "border-emerald-500/30 bg-emerald-500/5 opacity-60" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"}`}
                              >
                                <span className={`text-base font-bold flex-1 truncate ${isAdded ? "text-emerald-400" : "text-amber-200"}`}>
                                  {d.model}
                                </span>
                                <span className="font-mono text-sm font-bold text-white">{fmtCost(d.input)}/{fmtCost(d.output)}</span>
                                {isAdded ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                ) : (
                                  <button onClick={() => addDiscoveredModel(d)}
                                    className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 rounded text-xs font-bold transition-all flex-shrink-0">
                                    Add
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer info */}
          {(running || done) && (
            <div className="px-4 py-3 text-sm font-bold text-zinc-300">
              Data: rates-custom.json + models-discovered.json | Sources: official docs + pricepertoken.com
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
