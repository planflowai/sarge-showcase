"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Eye, Code, BarChart3, Loader2, ChevronDown, ChevronRight,
  CheckCircle, AlertTriangle, Flame, Clock, DollarSign, Layers,
} from "lucide-react";
import type { HybridChainResult, HybridEvent } from "@sarge/benchmark";
import { ALL_HYBRID_SCENARIOS, getLetterGrade, getGradeColor } from "@sarge/benchmark";

const PROVIDER_COLORS: Record<string, string> = {
  ollama: "#6B7280", lmstudio: "#6B7280",
  anthropic: "#D97706", openai: "#10B981", google: "#3B82F6",
  xai: "#8B5CF6", deepseek: "#06B6D4", mistral: "#F97316",
  groq: "#EF4444", together: "#EC4899", perplexity: "#6366F1",
  huggingface: "#FF9D00",
};

interface Props {
  running: boolean;
  chainResult: HybridChainResult | null;
  events: HybridEvent[];
  scenarioId: string;
}

type Tab = "preview" | "code" | "breakdown";

interface AuditScores {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  violations: { rule: string; severity: string; message: string; element?: string }[];
  passed: boolean;
}

interface CompilerState {
  loading: boolean;
  before: AuditScores | null;
  after: AuditScores | null;
  fixedHtml: string | null;
  error: string | null;
}

export function HybridDetailPanel({ running, chainResult, events, scenarioId }: Props) {
  const [tab, setTab] = useState<Tab>("preview");
  const [assessmentOpen, setAssessmentOpen] = useState(true);
  const [compilerOpen, setCompilerOpen] = useState(true);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [compiler, setCompiler] = useState<CompilerState>({
    loading: false, before: null, after: null, fixedHtml: null, error: null,
  });
  const [iframeOpacity, setIframeOpacity] = useState(1);
  const assessFetchedRef = useRef<string | null>(null);
  const compileFetchedRef = useRef<string | null>(null);
  const prevStepRef = useRef<number | null>(null);

  const scenario = ALL_HYBRID_SCENARIOS.find((s) => s.id === scenarioId);
  const finalHtml = chainResult?.steps?.[chainResult.steps.length - 1]?.extractedCode || "";
  const finalScore = chainResult?.finalScore;
  const grade = finalScore ? getLetterGrade(finalScore.total) : null;
  const gradeColor = grade ? getGradeColor(grade) : "";

  // Live preview: prioritize streaming partial HTML > step-complete HTML
  const liveHtml = useMemo(() => {
    // Scan backwards: streaming events update most frequently
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.type === "hybrid:step-streaming" && ev.partialHtml) {
        return ev.partialHtml;
      }
      if (ev.type === "hybrid:step-complete" && ev.stepResult?.extractedCode) {
        return ev.stepResult.extractedCode;
      }
    }
    return "";
  }, [events]);

  // Use final chain HTML if available, otherwise live/streaming HTML
  const displayHtml = finalHtml || liveHtml;

  // Preview HTML
  const previewHtml = useMemo(() => {
    if (!displayHtml) return "";
    const code = displayHtml;
    if (code.toLowerCase().includes("<!doctype") || code.toLowerCase().includes("<html")) {
      return code;
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:1rem}</style></head><body>${code}</body></html>`;
  }, [displayHtml]);

  // ── Auto-trigger assessment after chain completes ──
  useEffect(() => {
    if (!chainResult || !finalHtml || finalHtml.length < 50) return;
    const key = `${chainResult.chainId}-${chainResult.timestamp}`;
    if (assessFetchedRef.current === key) return;
    assessFetchedRef.current = key;

    setAssessmentLoading(true);
    setAssessment(null);

    const stepResults = chainResult.steps.map((s) => ({
      stepIndex: s.stepIndex,
      modelId: s.modelId,
      role: s.role,
      score: s.score.total,
      timeMs: s.timeMs,
      cost: s.cost,
    }));

    fetch("/api/benchmark/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: finalHtml,
        stepResults,
        scenario: scenario?.name || scenarioId,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setAssessment(data.assessment || data.error || "No assessment returned.");
      })
      .catch((err) => {
        setAssessment(`Assessment failed: ${err.message}`);
      })
      .finally(() => setAssessmentLoading(false));
  }, [chainResult, finalHtml, scenarioId, scenario?.name]);

  // ── Auto-trigger compiler after assessment ──
  const runCompiler = useCallback(async (html: string) => {
    setCompiler({ loading: true, before: null, after: null, fixedHtml: null, error: null });

    try {
      const res = await fetch("/api/benchmark/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const data = await res.json();

      if (data.error) {
        setCompiler({ loading: false, before: null, after: null, fixedHtml: null, error: data.error });
        return;
      }

      const before = extractScores(data);
      const needsFix = before.performance < 80 || before.accessibility < 80 || before.seo < 80 || before.bestPractices < 80;

      if (needsFix && before.violations.length > 0) {
        // AI fix loop
        try {
          const fixRes = await fetch("/api/benchmark/compile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ html, fix: true, violations: before.violations }),
          });
          const fixData = await fixRes.json();

          if (fixData.afterReport) {
            const after = extractScores(fixData.afterReport);
            setCompiler({ loading: false, before, after, fixedHtml: fixData.fixedHtml || null, error: null });
          } else {
            setCompiler({ loading: false, before, after: null, fixedHtml: null, error: null });
          }
        } catch {
          setCompiler({ loading: false, before, after: null, fixedHtml: null, error: null });
        }
      } else {
        setCompiler({ loading: false, before, after: null, fixedHtml: null, error: null });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCompiler({ loading: false, before: null, after: null, fixedHtml: null, error: msg });
    }
  }, []);

  useEffect(() => {
    if (!chainResult || !finalHtml || finalHtml.length < 50) return;
    const key = `${chainResult.chainId}-${chainResult.timestamp}`;
    if (compileFetchedRef.current === key) return;
    compileFetchedRef.current = key;
    runCompiler(finalHtml);
  }, [chainResult, finalHtml, runCompiler]);

  // ── Fade transition on step handoff — never flash white/black ──
  useEffect(() => {
    if (!running) {
      prevStepRef.current = null;
      setIframeOpacity(1);
      return;
    }
    const step = events.length > 0 ? events[events.length - 1].stepIndex : undefined;
    const stepNum = step ?? 0;
    if (prevStepRef.current !== null && prevStepRef.current !== stepNum) {
      // New step started — fade to 50%
      setIframeOpacity(0.5);
    }
    prevStepRef.current = stepNum;
  }, [running, events]);

  // Fade back to full once streaming content is established
  useEffect(() => {
    if (iframeOpacity < 1 && liveHtml.length >= 200) {
      setIframeOpacity(1);
    }
  }, [iframeOpacity, liveHtml]);

  // ── Score extraction helper ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractScores(report: any): AuditScores {
    const results = report.results || report;
    const lh = (results.lighthouse || {}) as Record<string, unknown>;
    const violations: AuditScores["violations"] = [];

    // Extract violations from htmlValidate and axeCore
    const htmlV = (results.htmlValidate || {}) as Record<string, unknown>;
    const axe = (results.axeCore || {}) as Record<string, unknown>;

    if (Array.isArray(htmlV.violations)) {
      htmlV.violations.forEach((v: Record<string, unknown>) => {
        violations.push({
          rule: String(v.ruleId || v.rule || "unknown"),
          severity: String(v.severity || "warning"),
          message: String(v.message || ""),
          element: v.element ? String(v.element) : undefined,
        });
      });
    }
    if (Array.isArray(axe.violations)) {
      axe.violations.forEach((v: Record<string, unknown>) => {
        violations.push({
          rule: String(v.id || v.rule || "unknown"),
          severity: String(v.impact || v.severity || "warning"),
          message: String(v.description || v.message || ""),
        });
      });
    }

    const perf = typeof lh.performance === "number" ? lh.performance : 0;
    const acc = typeof lh.accessibility === "number" ? lh.accessibility : 0;
    const seo = typeof lh.seo === "number" ? lh.seo : 0;
    const bp = typeof lh.bestPractices === "number" ? lh.bestPractices
      : typeof lh["best-practices"] === "number" ? (lh["best-practices"] as number) : 0;

    return {
      performance: perf,
      accessibility: acc,
      seo,
      bestPractices: bp,
      violations,
      passed: perf >= 80 && acc >= 80 && seo >= 80 && bp >= 80,
    };
  }

  // ── Current running step from events ──
  const currentStepIndex = events.length > 0 ? events[events.length - 1].stepIndex : undefined;
  const currentMessage = events.length > 0 ? events[events.length - 1].message : "";

  // ── No result yet: show placeholder ──
  if (!chainResult && !running) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600">
        <Layers className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-bold">No chain results yet</p>
        <p className="text-xs mt-1">Configure and run a hybrid chain to see results here</p>
      </div>
    );
  }

  // ── Running state — show live preview if step HTML available ──
  if (running && !chainResult) {
    if (previewHtml) {
      // A step completed — show live preview with running indicator
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 flex-shrink-0">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 flex-shrink-0" />
            <span className="text-sm font-bold text-white">
              Step {(currentStepIndex ?? 0) + 1} running...
            </span>
            <span className="text-sm text-zinc-400 truncate flex-1">{currentMessage}</span>
            <span className="text-xs font-bold text-emerald-400 animate-pulse">LIVE</span>
          </div>
          <div className="flex-1">
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              className="w-full h-full border-0 bg-white"
              style={{ opacity: iframeOpacity, transition: "opacity 0.3s ease" }}
              title="Hybrid Live Preview"
            />
          </div>
        </div>
      );
    }
    // No step HTML yet — show spinner
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="relative mb-6">
          <Flame className="w-16 h-16 text-[#FF6700] drop-shadow-[0_0_20px_rgba(255,103,0,0.4)]" />
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 absolute -bottom-1 -right-1" />
        </div>
        <p className="text-lg font-[900] text-white mb-1">
          Running Step {(currentStepIndex ?? 0) + 1}...
        </p>
        <p className="text-sm text-zinc-400 max-w-md text-center">{currentMessage}</p>
        <div className="mt-4 flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#FF6700] animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Results view ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Stats Bar ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 flex-shrink-0">
        <span className="text-sm font-bold text-zinc-200 truncate max-w-[180px]">
          {scenario?.name || scenarioId}
        </span>
        <span className="text-sm text-zinc-200">
          Steps: {chainResult?.steps.length || 0}
        </span>
        {finalScore && (
          <span className={`text-xl font-[900] ${
            finalScore.total >= 90 ? "text-emerald-400" :
            finalScore.total >= 70 ? "text-amber-400" : "text-red-400"
          }`}>
            {finalScore.total}
          </span>
        )}
        {grade && (
          <span className={`px-2 py-0.5 rounded-lg text-xs font-[900] uppercase tracking-widest border ${gradeColor}`}>
            {grade}
          </span>
        )}
        <div className="flex-1" />
        {chainResult && (
          <>
            <div className="flex items-center gap-1 text-sm text-zinc-200">
              <Clock className="w-3 h-3" />
              {(chainResult.totalTimeMs / 1000).toFixed(1)}s
            </div>
            <div className="flex items-center gap-1 text-sm font-mono text-emerald-400">
              <DollarSign className="w-3 h-3" />
              {chainResult.totalCost.toFixed(4)}
            </div>
          </>
        )}
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-zinc-800/50 flex-shrink-0">
        {([
          { id: "preview" as Tab, icon: Eye, label: "Preview" },
          { id: "code" as Tab, icon: Code, label: "Code" },
          { id: "breakdown" as Tab, icon: BarChart3, label: "Breakdown" },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
              tab === id
                ? "bg-[#FF6700]/15 text-[#FFD700] border-[#FF6700]/40"
                : "text-zinc-500 hover:text-zinc-300 border-transparent"
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-auto">
        {/* Preview */}
        {tab === "preview" && (
          <div className="h-full">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="w-full h-full border-0 bg-white"
                title="Hybrid Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                No HTML to preview
              </div>
            )}
          </div>
        )}

        {/* Code */}
        {tab === "code" && (
          <div className="p-4">
            <pre className="text-xs font-mono text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 overflow-auto max-h-[calc(100vh-300px)] whitespace-pre-wrap break-words">
              {finalHtml || "No HTML generated yet."}
            </pre>
          </div>
        )}

        {/* Breakdown */}
        {tab === "breakdown" && chainResult && (
          <div className="p-4 space-y-3">
            {chainResult.steps.map((step, si) => {
              const prevScore = si > 0 ? chainResult.steps[si - 1].score.total : 0;
              const delta = si > 0 ? step.score.total - prevScore : 0;
              const scoreColor = step.score.total >= 90 ? "text-emerald-400" : step.score.total >= 70 ? "text-amber-400" : "text-red-400";
              const barColor = step.score.total >= 90 ? "from-emerald-600 to-emerald-400" : step.score.total >= 70 ? "from-amber-600 to-amber-400" : "from-red-600 to-red-400";

              return (
                <div key={si} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-zinc-200">S{si + 1}</span>
                    <span className="text-sm font-bold text-white">{step.role}</span>
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded border"
                      style={{
                        borderColor: (PROVIDER_COLORS[step.provider] || "#6B7280") + "40",
                        color: PROVIDER_COLORS[step.provider] || "#D4D4D8",
                      }}
                    >
                      {step.modelId}
                    </span>
                    <div className="flex-1" />
                    <span className={`text-lg font-[900] ${scoreColor}`}>{step.score.total}</span>
                    {si > 0 && (
                      <span className={`text-sm font-bold ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-zinc-300"}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                  {/* Score bar */}
                  <div className="h-3.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                      style={{ width: `${step.score.total}%` }}
                    />
                  </div>
                  {/* Meta */}
                  <div className="flex items-center gap-3 text-sm text-zinc-200">
                    <span>{(step.timeMs / 1000).toFixed(1)}s</span>
                    <span className="font-mono text-emerald-400">${step.cost.toFixed(4)}</span>
                    <span>
                      {step.provider === "ollama" || step.provider === "lmstudio" ? "LOCAL" : "CLOUD"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── AI Assessment (collapsible) ── */}
      {chainResult && (
        <div className="border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => setAssessmentOpen(!assessmentOpen)}
            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-zinc-800/40 transition-colors"
          >
            {assessmentOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
            <Flame className="w-3.5 h-3.5 text-[#FF6700]" />
            <span className="text-xs font-bold text-zinc-300">AI Assessment</span>
            {assessmentLoading && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
          </button>
          {assessmentOpen && (
            <div className="px-4 pb-3 max-h-64 overflow-y-auto">
              {assessmentLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Generating assessment...</span>
                </div>
              ) : assessment ? (
                <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                  {assessment}
                </div>
              ) : (
                <div className="text-xs text-zinc-600 py-2">Waiting for assessment...</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Compiler (collapsible) ── */}
      {chainResult && (
        <div className="border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => setCompilerOpen(!compilerOpen)}
            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-zinc-800/40 transition-colors"
          >
            {compilerOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-200" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-200" />}
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-zinc-300">Compiler</span>
            {compiler.loading && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
            {!compiler.loading && compiler.before && (
              <span className={`ml-auto text-sm font-bold px-2 py-0.5 rounded ${
                (compiler.after || compiler.before).passed
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-600/30"
                  : "bg-amber-900/30 text-amber-400 border border-amber-600/30"
              }`}>
                {(compiler.after || compiler.before).passed ? "PASSED" : "NEEDS REVIEW"}
              </span>
            )}
          </button>
          {compilerOpen && (
            <div className="px-4 pb-3">
              {compiler.loading ? (
                <div className="flex items-center gap-2 py-4 justify-center text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Running audit...</span>
                </div>
              ) : compiler.error ? (
                <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                  {compiler.error}
                </div>
              ) : compiler.before ? (
                <div className="space-y-3">
                  {/* Score cards */}
                  {compiler.after ? (
                    // Before / After view
                    <div>
                      <div className="text-sm font-bold text-zinc-200 uppercase mb-1.5">Before → After</div>
                      <div className="grid grid-cols-4 gap-2">
                        {(["performance", "accessibility", "seo", "bestPractices"] as const).map((key) => {
                          const label = key === "bestPractices" ? "Best Practices" : key.charAt(0).toUpperCase() + key.slice(1);
                          const before = compiler.before![key];
                          const after = compiler.after![key];
                          const afterColor = after >= 90 ? "text-emerald-400" : after >= 70 ? "text-amber-400" : "text-red-400";
                          const beforeColor = before >= 90 ? "text-emerald-400" : before >= 70 ? "text-amber-400" : "text-red-400";
                          return (
                            <div key={key} className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-2 text-center">
                              <div className="text-xs font-bold text-zinc-300 uppercase mb-1">{label}</div>
                              <div className="flex items-center justify-center gap-1">
                                <span className={`text-sm font-bold ${beforeColor} line-through opacity-50`}>{before}</span>
                                <span className="text-zinc-600">→</span>
                                <span className={`text-lg font-[900] ${afterColor}`}>{after}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    // Single score view
                    <div className="grid grid-cols-4 gap-2">
                      {(["performance", "accessibility", "seo", "bestPractices"] as const).map((key) => {
                        const label = key === "bestPractices" ? "Best Practices" : key.charAt(0).toUpperCase() + key.slice(1);
                        const score = compiler.before![key];
                        const color = score >= 90 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-red-400";
                        const bgColor = score >= 90 ? "border-emerald-800/30" : score >= 70 ? "border-amber-800/30" : "border-red-800/30";
                        return (
                          <div key={key} className={`bg-zinc-900/40 border ${bgColor} rounded-lg p-2 text-center`}>
                            <div className="text-xs font-bold text-zinc-300 uppercase mb-1">{label}</div>
                            <div className={`text-lg font-[900] ${color}`}>{score}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Violations */}
                  {compiler.before.violations.length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-zinc-200 uppercase mb-1">
                        Violations ({compiler.before.violations.length})
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {compiler.before.violations.slice(0, 10).map((v, vi) => (
                          <div key={vi} className="flex items-start gap-2 text-xs bg-zinc-900/40 border border-zinc-800 rounded px-2 py-1">
                            <span className={`font-bold flex-shrink-0 px-1 py-px rounded text-xs uppercase ${
                              v.severity === "critical" || v.severity === "serious"
                                ? "bg-red-900/40 text-red-400"
                                : v.severity === "moderate"
                                ? "bg-amber-900/40 text-amber-400"
                                : "bg-zinc-700/40 text-zinc-400"
                            }`}>
                              {v.severity}
                            </span>
                            <span className="text-zinc-200 font-mono flex-shrink-0">{v.rule}</span>
                            <span className="text-zinc-300 truncate">{v.message}</span>
                          </div>
                        ))}
                        {compiler.before.violations.length > 10 && (
                          <div className="text-sm text-zinc-300 px-2">
                            +{compiler.before.violations.length - 10} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-zinc-300 py-2">Waiting for compiler...</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
