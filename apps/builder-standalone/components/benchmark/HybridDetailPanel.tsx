"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Eye, Code, BarChart3, Loader2, ChevronDown, ChevronRight,
  CheckCircle, AlertTriangle, Flame, Clock, DollarSign, Layers,
  ScrollText, Shield, Scale, Lock, ArrowUpCircle, RotateCcw,
} from "lucide-react";
import type { HybridChainResult, HybridEvent, StepChangelog, TruthAnchor } from "@sarge/benchmark";
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

type Tab = "preview" | "code" | "breakdown" | "buildlog";

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

// Injected into preview iframes: intercepts ALL link clicks.
// Hash links smooth-scroll in place. All others send postMessage to parent which opens new tab.
// This works with sandbox="allow-scripts allow-same-origin allow-forms" (no allow-popups needed).
const NAV_FIX_SCRIPT = `<script>document.addEventListener('DOMContentLoaded',function(){document.body.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;e.preventDefault();e.stopPropagation();var h=a.getAttribute('href')||'';if(h.startsWith('#')){var t=document.querySelector(h);if(t)t.scrollIntoView({behavior:'smooth'})}else if(h){window.parent.postMessage({type:'open-url',url:h},'*')}},true)},false);<\/script>`;

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
  const prevLiveHtmlRef = useRef("");

  const [truthAnchorOpen, setTruthAnchorOpen] = useState(false);

  const scenario = ALL_HYBRID_SCENARIOS.find((s) => s.id === scenarioId);
  const finalHtml = chainResult?.steps?.[chainResult.steps.length - 1]?.extractedCode || "";

  // Extract Truth Anchor from events (emitted at hybrid:start)
  const truthAnchor: TruthAnchor | null = useMemo(() => {
    for (const ev of events) {
      if (ev.type === "hybrid:start" && ev.truthAnchor) return ev.truthAnchor;
    }
    return chainResult?.truthAnchor || null;
  }, [events, chainResult]);
  const finalScore = chainResult?.finalScore;
  const grade = finalScore ? getLetterGrade(finalScore.total) : null;
  const gradeColor = grade ? getGradeColor(grade) : "";

  // Live preview: preserve completed step's output until next step streams enough content
  const liveHtml = useMemo(() => {
    let latestStreaming = "";
    let latestComplete = "";
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (!latestStreaming && ev.type === "hybrid:step-streaming" && ev.partialHtml) {
        latestStreaming = ev.partialHtml;
      }
      if (!latestComplete && ev.type === "hybrid:step-complete" && ev.stepResult?.extractedCode) {
        latestComplete = ev.stepResult.extractedCode;
      }
      if (latestStreaming && latestComplete) break;
    }
    // Only use streaming if substantial (2000+ chars with <body>) — prevents
    // discarding Step 1's valid output while Step 2 is still warming up
    if (latestStreaming) {
      const lower = latestStreaming.toLowerCase();
      if (latestStreaming.length >= 2000 && lower.includes("<body")) {
        return latestStreaming;
      }
    }
    return latestComplete || latestStreaming || "";
  }, [events]);

  // Use final chain HTML if available, otherwise live/streaming HTML
  const displayHtml = finalHtml || liveHtml;

  // Preview HTML — inject nav-fix script to prevent parent navigation
  const previewHtml = useMemo(() => {
    if (!displayHtml) return "";
    let code = displayHtml;
    if (!code.toLowerCase().includes("<!doctype") && !code.toLowerCase().includes("<html")) {
      code = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:1rem}</style></head><body>${code}</body></html>`;
    }
    // Inject nav-fix before </body> or at end
    const bodyClose = code.toLowerCase().lastIndexOf("</body>");
    if (bodyClose !== -1) {
      code = code.slice(0, bodyClose) + NAV_FIX_SCRIPT + code.slice(bodyClose);
    } else {
      code += NAV_FIX_SCRIPT;
    }
    return code;
  }, [displayHtml]);

  // ── Auto-trigger assessment after chain completes ──
  useEffect(() => {
    if (!chainResult) return;
    // Skip if final step returned no usable output
    if (!finalHtml || finalHtml.length < 50) {
      if (chainResult) {
        setAssessment("Step failed — no output to assess.");
        setAssessmentLoading(false);
      }
      return;
    }
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
    if (!chainResult) return;
    // Skip if final step returned no usable output
    if (!finalHtml || finalHtml.length < 50) {
      if (chainResult) {
        setCompiler({ loading: false, before: null, after: null, fixedHtml: null, error: "Step failed — no output to compile." });
      }
      return;
    }
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

  // Fade back to full once new step's content actually arrives in display
  useEffect(() => {
    if (iframeOpacity < 1 && liveHtml !== prevLiveHtmlRef.current) {
      setIframeOpacity(1);
    }
    prevLiveHtmlRef.current = liveHtml;
  }, [iframeOpacity, liveHtml]);

  // ── postMessage bridge — iframe links open in new tab ──
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "open-url" && typeof e.data.url === "string") {
        window.open(e.data.url, "_blank", "noopener");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── Score extraction helper ──
  // runAudit returns: { scores: { performance, accessibility, seo, bestPractices }, results: AuditResult[] }
  // Each AuditResult has: { tool, violations: AuditViolation[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractScores(report: any): AuditScores {
    const violations: AuditScores["violations"] = [];

    // Primary: scores at report.scores (from runAudit)
    const scores = report.scores || {};
    let perf = typeof scores.performance === "number" ? scores.performance : 0;
    let acc = typeof scores.accessibility === "number" ? scores.accessibility : 0;
    let seo = typeof scores.seo === "number" ? scores.seo : 0;
    let bp = typeof scores.bestPractices === "number" ? scores.bestPractices
      : typeof scores["best-practices"] === "number" ? (scores["best-practices"] as number) : 0;

    // Fallback: raw Lighthouse categories format (scores are 0-1 decimals)
    const cats = report.categories;
    if (cats) {
      if (!perf && cats.performance?.score != null) perf = Math.round(cats.performance.score * 100);
      if (!acc && cats.accessibility?.score != null) acc = Math.round(cats.accessibility.score * 100);
      if (!seo && cats.seo?.score != null) seo = Math.round(cats.seo.score * 100);
      if (!bp && cats["best-practices"]?.score != null) bp = Math.round(cats["best-practices"].score * 100);
    }

    // Fallback: scan results[] for Lighthouse entry with embedded scores
    const results = Array.isArray(report.results) ? report.results : [];
    if (!perf || !seo || !bp) {
      for (const r of results) {
        if (r.tool !== "lighthouse") continue;
        // Lighthouse result may carry a scores sub-object
        const ls = r.scores;
        if (ls) {
          if (!perf && typeof ls.performance === "number") perf = ls.performance;
          if (!seo && typeof ls.seo === "number") seo = ls.seo;
          if (!bp) {
            if (typeof ls.bestPractices === "number") bp = ls.bestPractices;
            else if (typeof ls["best-practices"] === "number") bp = ls["best-practices"] as number;
          }
        }
      }
    }

    // Collect violations from results[] array
    for (const result of results) {
      if (!Array.isArray(result.violations)) continue;
      for (const v of result.violations) {
        violations.push({
          rule: String(v.ruleId || v.id || v.rule || "unknown"),
          severity: String(v.impact || v.severity || "warning"),
          message: String(v.description || v.message || ""),
          element: v.element ? String(v.element) : undefined,
        });
      }
    }

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

  // Build log entries from events (filtered) — must be above early returns (React hooks rule)
  const buildLogEntries = useMemo(() =>
    events.filter(e => e.type === "hybrid:build-log" || e.type === "hybrid:guardian" || e.type === "hybrid:jury"),
    [events]
  );

  /** Derive build log entry color from message content (user-language emoji rules) */
  const getLogColor = useCallback((ev: HybridEvent): string => {
    const msg = ev.message || "";
    if (ev.type === "hybrid:guardian") {
      return msg.includes("PASSED") || msg.includes("✅") ? "text-green-400" : "text-red-400";
    }
    if (ev.type === "hybrid:jury") {
      return msg.includes("APPROVED") || msg.includes("✅") ? "text-sky-400" : "text-amber-400";
    }
    if (msg.startsWith("✅")) return "text-green-400";
    if (msg.startsWith("❌")) return "text-red-400";
    if (msg.startsWith("⚠️")) return "text-amber-400";
    if (msg.startsWith("🔄")) return "text-amber-400";
    if (msg.startsWith("⬆️")) return "text-sky-400";
    if (msg.startsWith("🔒")) return "text-zinc-300";
    if (msg.startsWith("🏁")) return "text-green-400";
    return "text-white";
  }, []);

  // Auto-scroll ref for build log
  const buildLogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (buildLogRef.current) {
      buildLogRef.current.scrollTop = buildLogRef.current.scrollHeight;
    }
  }, [buildLogEntries.length]);

  // ── No result yet: show placeholder ──
  if (!chainResult && !running) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-300">
        <Layers className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-bold">No chain results yet</p>
        <p className="text-xs mt-1">Configure and run a hybrid chain to see results here</p>
      </div>
    );
  }

  // ── Running state — show live preview if step HTML available ──
  if (running && !chainResult) {
    if (previewHtml) {
      // A step completed — show live preview with running indicator + live build log
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
          <div className="flex-1 min-h-0">
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-same-origin allow-forms"
              className="w-full h-full border-0 bg-white"
              style={{ opacity: iframeOpacity, transition: "opacity 0.3s ease" }}
              title="Hybrid Live Preview"
            />
          </div>
          {/* Live build log ticker */}
          {buildLogEntries.length > 0 && (
            <div ref={buildLogRef} className="max-h-32 overflow-y-auto border-t border-zinc-800 bg-zinc-950/80 px-3 py-1.5 flex-shrink-0">
              {buildLogEntries.map((ev, i) => (
                <div
                  key={i}
                  className={`font-mono py-0.5 ${getLogColor(ev)}`}
                  style={{ fontSize: "13px" }}
                >
                  {ev.type === "hybrid:guardian" && <Shield className="w-3 h-3 inline mr-1" />}
                  {ev.type === "hybrid:jury" && <Scale className="w-3 h-3 inline mr-1" />}
                  {ev.message}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    // No step HTML yet — show spinner + live build log
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1">
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
        {/* Live build log ticker */}
        {buildLogEntries.length > 0 && (
          <div ref={buildLogRef} className="max-h-40 overflow-y-auto border-t border-zinc-800 bg-zinc-950/80 px-3 py-1.5 flex-shrink-0">
            {buildLogEntries.map((ev, i) => (
              <div
                key={i}
                className={`font-mono py-0.5 ${getLogColor(ev)}`}
                style={{ fontSize: "13px" }}
              >
                {ev.type === "hybrid:guardian" && <Shield className="w-3 h-3 inline mr-1" />}
                {ev.type === "hybrid:jury" && <Scale className="w-3 h-3 inline mr-1" />}
                {ev.message}
              </div>
            ))}
          </div>
        )}
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
          { id: "buildlog" as Tab, icon: ScrollText, label: "Build Log" },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
              tab === id
                ? "bg-[#FF6700]/15 text-[#FFD700] border-[#FF6700]/40"
                : "text-zinc-300 hover:text-zinc-300 border-transparent"
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
                sandbox="allow-scripts allow-same-origin allow-forms"
                className="w-full h-full border-0 bg-white"
                title="Hybrid Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-300 text-sm">
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
              const cl = step.changelog;

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
                    {/* Strike / attempt badges */}
                    {(step.attempts ?? 1) > 1 && (
                      <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-600/30">
                        <RotateCcw className="w-3 h-3" />
                        {step.attempts} attempts
                      </span>
                    )}
                    {step.escalatedTo && (
                      <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded bg-sky-900/30 text-sky-400 border border-sky-600/30">
                        <ArrowUpCircle className="w-3 h-3" />
                        {step.escalatedTo}
                      </span>
                    )}
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
                  <div className="flex items-center gap-3 text-zinc-200" style={{ fontSize: "13px" }}>
                    <span><Clock className="w-3 h-3 inline mr-0.5" />{(step.timeMs / 1000).toFixed(1)}s</span>
                    <span className="font-mono text-green-300"><DollarSign className="w-3 h-3 inline" />{step.cost.toFixed(4)}</span>
                    <span className="font-bold">
                      {step.provider === "ollama" || step.provider === "lmstudio" ? "LOCAL" : "CLOUD"}
                    </span>
                  </div>

                  {/* Changelog — per-step diff */}
                  {cl && (
                    <div className="mt-2 pt-2 border-t border-zinc-800 text-xs space-y-0.5">
                      {cl.sectionsAdded.length > 0 && (
                        <div className="text-emerald-400">
                          + Added: {cl.sectionsAdded.join(", ")} ({cl.sectionsAdded.length} new section{cl.sectionsAdded.length > 1 ? "s" : ""})
                        </div>
                      )}
                      {cl.cssRulesAdded > 0 && (
                        <div className="text-emerald-400">+ Added: {cl.cssRulesAdded} CSS rules</div>
                      )}
                      {cl.cssRulesRemoved > 0 && (
                        <div className="text-red-400">- Removed: {cl.cssRulesRemoved} CSS rules</div>
                      )}
                      {cl.jsFunctionsAdded > 0 && (
                        <div className="text-emerald-400">+ Added: {cl.jsFunctionsAdded} JS function{cl.jsFunctionsAdded > 1 ? "s" : ""}</div>
                      )}
                      {cl.jsFunctionsRemoved > 0 && (
                        <div className="text-red-400">- Removed: {cl.jsFunctionsRemoved} JS function{cl.jsFunctionsRemoved > 1 ? "s" : ""}</div>
                      )}
                      {cl.sectionsRemoved.length > 0 && (
                        <div className="text-red-400">
                          - Removed: {cl.sectionsRemoved.join(", ")}
                        </div>
                      )}
                      {cl.sectionsAdded.length === 0 && cl.cssRulesAdded === 0 && cl.jsFunctionsAdded === 0 && (
                        <div className="text-zinc-300">~ Modified: content updated (no structural changes detected)</div>
                      )}
                      <div className={`flex items-center gap-1 mt-1 ${
                        cl.regressionCheck === "PASSED" ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {cl.regressionCheck === "PASSED"
                          ? <><CheckCircle className="w-3 h-3" /> Regression check: PASSED — all previous sections present</>
                          : <><AlertTriangle className="w-3 h-3" /> Regression check: FAILED — {cl.regressionDetails.join("; ")}</>
                        }
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Build Log */}
        {tab === "buildlog" && (
          <div className="p-4">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/80">
                <Shield className="w-3.5 h-3.5 text-[#FF6700]" />
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Build Log</span>
                {running && <span className="text-xs font-bold text-emerald-400 animate-pulse">LIVE</span>}
              </div>
              {/* Log entries */}
              <div className="p-3 max-h-[calc(100vh-320px)] overflow-y-auto font-mono space-y-0.5">
                {buildLogEntries.length === 0 ? (
                  <div className="text-zinc-300 py-4 text-center" style={{ fontSize: "13px" }}>
                    {running ? "Waiting for events..." : "No build log entries. Run a chain to generate."}
                  </div>
                ) : (
                  buildLogEntries.map((ev, i) => (
                      <div
                        key={i}
                        className={`py-0.5 leading-relaxed ${getLogColor(ev)}`}
                        style={{ fontSize: "13px" }}
                      >
                        {ev.type === "hybrid:guardian" && (
                          <Shield className="w-3 h-3 inline mr-1 flex-shrink-0" />
                        )}
                        {ev.type === "hybrid:jury" && (
                          <Scale className="w-3 h-3 inline mr-1 flex-shrink-0" />
                        )}
                        {ev.message}
                        <span className="text-zinc-500 ml-2">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
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
            {assessmentOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-300" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />}
            <Flame className="w-3.5 h-3.5 text-[#FF6700]" />
            <span className="text-xs font-bold text-zinc-300">AI Assessment</span>
            {assessmentLoading && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
          </button>
          {assessmentOpen && (
            <div className="px-4 pb-3 max-h-64 overflow-y-auto">
              {assessmentLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center text-zinc-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Generating assessment...</span>
                </div>
              ) : assessment ? (
                <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                  {assessment}
                </div>
              ) : (
                <div className="text-xs text-zinc-300 py-2">Waiting for assessment...</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Truth Anchor (collapsible) ── */}
      {truthAnchor && (
        <div className="border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => setTruthAnchorOpen(!truthAnchorOpen)}
            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-zinc-800/40 transition-colors"
          >
            {truthAnchorOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-300" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />}
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-zinc-300">Truth Anchor</span>
            <span className="ml-auto text-xs font-mono text-zinc-500">{truthAnchor.hash.slice(0, 8)}...</span>
          </button>
          {truthAnchorOpen && (
            <div className="px-4 pb-3">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 space-y-2" style={{ fontSize: "13px" }}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{truthAnchor.siteType}</span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-zinc-400">{truthAnchor.outputFormat}</span>
                </div>
                {truthAnchor.requiredSections.length > 0 && (
                  <div>
                    <span className="text-zinc-400 font-bold">Sections: </span>
                    <span className="text-white">{truthAnchor.requiredSections.join(", ")}</span>
                  </div>
                )}
                {truthAnchor.requiredFeatures.length > 0 && (
                  <div>
                    <span className="text-zinc-400 font-bold">Features: </span>
                    <span className="text-white">{truthAnchor.requiredFeatures.join(", ")}</span>
                  </div>
                )}
                {truthAnchor.requiredPages.length > 0 && (
                  <div>
                    <span className="text-zinc-400 font-bold">Pages: </span>
                    <span className="text-white">{truthAnchor.requiredPages.join(", ")}</span>
                  </div>
                )}
                {truthAnchor.styleRequirements.length > 0 && (
                  <div>
                    <span className="text-zinc-400 font-bold">Style: </span>
                    <span className="text-white">{truthAnchor.styleRequirements.join(", ")}</span>
                  </div>
                )}
                <div className="text-zinc-500 font-mono text-xs pt-1 border-t border-zinc-800">
                  Hash: {truthAnchor.hash} · Locked: {new Date(truthAnchor.timestamp).toLocaleTimeString()}
                </div>
              </div>
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
                <div className="flex items-center gap-2 py-4 justify-center text-zinc-300">
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
                                <span className="text-zinc-300">→</span>
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
