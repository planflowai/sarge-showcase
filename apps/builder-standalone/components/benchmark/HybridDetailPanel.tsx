"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Eye, Code, BarChart3, Loader2, ChevronDown, ChevronRight,
  CheckCircle, AlertTriangle, Flame, Clock, DollarSign, Layers,
  ScrollText, Shield, Scale, Lock, ArrowUpCircle, RotateCcw, Copy,
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
const NAV_FIX_SCRIPT = `<script>document.addEventListener('DOMContentLoaded',function(){document.body.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;e.preventDefault();e.stopPropagation();var h=a.getAttribute('href')||'';if(h.startsWith('#')){var t=document.querySelector(h);if(t)t.scrollIntoView({behavior:'smooth'})}else if(h){window.parent.postMessage({type:'open-url',url:h},'*')}},true)},false);<\/script>`;

/** Small copy button — shows "Copied" for 2s */
function CopyBtn({ text, label, copiedKey, copiedSection, onCopy }: {
  text: string;
  label?: string;
  copiedKey: string;
  copiedSection: string | null;
  onCopy: (key: string) => void;
}) {
  const isCopied = copiedSection === copiedKey;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        onCopy(copiedKey);
      }}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm font-bold transition-all ${
        isCopied
          ? "bg-emerald-900/30 text-emerald-400 border border-emerald-600/30"
          : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 hover:border-zinc-600"
      }`}
    >
      <Copy className="w-3 h-3" />
      {isCopied ? "Copied \u2713" : (label || "Copy")}
    </button>
  );
}

export function HybridDetailPanel({ running, chainResult, events, scenarioId }: Props) {
  const [tab, setTab] = useState<Tab>("preview");
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [compilerOpen, setCompilerOpen] = useState(true);
  const [violationsOpen, setViolationsOpen] = useState(false);
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
  const [collapsedSteps, setCollapsedSteps] = useState<Set<number>>(new Set());
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = useCallback((key: string) => {
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  }, []);

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
    if (latestStreaming) {
      const lower = latestStreaming.toLowerCase();
      if (latestStreaming.length >= 2000 && lower.includes("<body")) {
        return latestStreaming;
      }
    }
    return latestComplete || latestStreaming || "";
  }, [events]);

  const displayHtml = finalHtml || liveHtml;

  const previewHtml = useMemo(() => {
    if (!displayHtml) return "";
    let code = displayHtml;
    if (!code.toLowerCase().includes("<!doctype") && !code.toLowerCase().includes("<html")) {
      code = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:1rem}</style></head><body>${code}</body></html>`;
    }
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

  // ── Fade transition on step handoff ──
  useEffect(() => {
    if (!running) {
      prevStepRef.current = null;
      setIframeOpacity(1);
      return;
    }
    const step = events.length > 0 ? events[events.length - 1].stepIndex : undefined;
    const stepNum = step ?? 0;
    if (prevStepRef.current !== null && prevStepRef.current !== stepNum) {
      setIframeOpacity(0.5);
    }
    prevStepRef.current = stepNum;
  }, [running, events]);

  useEffect(() => {
    if (iframeOpacity < 1 && liveHtml !== prevLiveHtmlRef.current) {
      setIframeOpacity(1);
    }
    prevLiveHtmlRef.current = liveHtml;
  }, [iframeOpacity, liveHtml]);

  // ── postMessage bridge ──
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractScores(report: any): AuditScores {
    const violations: AuditScores["violations"] = [];

    const scores = report.scores || {};
    let perf = typeof scores.performance === "number" ? scores.performance : 0;
    let acc = typeof scores.accessibility === "number" ? scores.accessibility : 0;
    let seo = typeof scores.seo === "number" ? scores.seo : 0;
    let bp = typeof scores.bestPractices === "number" ? scores.bestPractices
      : typeof scores["best-practices"] === "number" ? (scores["best-practices"] as number) : 0;

    const cats = report.categories;
    if (cats) {
      if (!perf && cats.performance?.score != null) perf = Math.round(cats.performance.score * 100);
      if (!acc && cats.accessibility?.score != null) acc = Math.round(cats.accessibility.score * 100);
      if (!seo && cats.seo?.score != null) seo = Math.round(cats.seo.score * 100);
      if (!bp && cats["best-practices"]?.score != null) bp = Math.round(cats["best-practices"].score * 100);
    }

    const results = Array.isArray(report.results) ? report.results : [];
    if (!perf || !seo || !bp) {
      for (const r of results) {
        if (r.tool !== "lighthouse") continue;
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

  // Build log entries from events (filtered)
  const buildLogEntries = useMemo(() =>
    events.filter(e => e.type === "hybrid:build-log" || e.type === "hybrid:guardian" || e.type === "hybrid:jury"),
    [events]
  );

  /** Derive build log entry color from message content */
  const getLogColor = useCallback((ev: HybridEvent): string => {
    const msg = ev.message || "";
    if (ev.type === "hybrid:guardian") {
      return msg.includes("PASSED") || msg.includes("\u2705") ? "text-green-400" : "text-red-400";
    }
    if (ev.type === "hybrid:jury") {
      return msg.includes("APPROVED") || msg.includes("\u2705") ? "text-sky-400" : "text-amber-400";
    }
    if (msg.startsWith("\u2705")) return "text-green-400";
    if (msg.startsWith("\u274c")) return "text-red-400";
    if (msg.startsWith("\u26a0\ufe0f")) return "text-amber-400";
    if (msg.startsWith("\ud83d\udd04")) return "text-amber-400";
    if (msg.startsWith("\u2b06\ufe0f")) return "text-sky-400";
    if (msg.startsWith("\ud83d\udd12")) return "text-zinc-300";
    if (msg.startsWith("\ud83c\udfc1")) return "text-green-400";
    return "text-white";
  }, []);

  // Build log as plain text (for copy)
  const buildLogText = useMemo(() =>
    buildLogEntries.map(ev => `${new Date(ev.timestamp).toLocaleTimeString()} ${ev.message}`).join("\n"),
    [buildLogEntries]
  );

  // Build log total duration
  const buildLogDuration = useMemo(() => {
    if (buildLogEntries.length < 2) return "";
    const first = buildLogEntries[0].timestamp;
    const last = buildLogEntries[buildLogEntries.length - 1].timestamp;
    const sec = Math.round((last - first) / 1000);
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return min > 0 ? `${min} min ${rem} sec` : `${sec} sec`;
  }, [buildLogEntries]);

  // Truth Anchor as plain text (for copy)
  const truthAnchorText = useMemo(() => {
    if (!truthAnchor) return "";
    const lines = [
      `Truth Anchor — ${truthAnchor.siteType}`,
      `Format: ${truthAnchor.outputFormat}`,
      truthAnchor.requiredSections.length > 0 ? `Sections: ${truthAnchor.requiredSections.join(", ")}` : "",
      truthAnchor.requiredFeatures.length > 0 ? `Features: ${truthAnchor.requiredFeatures.join(", ")}` : "",
      truthAnchor.requiredPages.length > 0 ? `Pages: ${truthAnchor.requiredPages.join(", ")}` : "",
      truthAnchor.styleRequirements.length > 0 ? `Style: ${truthAnchor.styleRequirements.join(", ")}` : "",
      `Hash: ${truthAnchor.hash}`,
      `Locked: ${new Date(truthAnchor.timestamp).toLocaleString()}`,
    ].filter(Boolean);
    return lines.join("\n");
  }, [truthAnchor]);

  // Full report as plain text
  const fullReportText = useMemo(() => {
    const sections: string[] = [];

    if (truthAnchor) sections.push(`=== TRUTH ANCHOR ===\n${truthAnchorText}`);

    if (buildLogEntries.length > 0) sections.push(`=== BUILD LOG (${buildLogEntries.length} entries) ===\n${buildLogText}`);

    if (chainResult?.steps) {
      const breakdown = chainResult.steps.map((step, si) => {
        const prevScore = si > 0 ? chainResult.steps[si - 1].score.total : 0;
        const delta = si > 0 ? step.score.total - prevScore : 0;
        const deltaStr = si > 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : "";
        let line = `Step ${si + 1}: ${step.role} — ${step.modelId} — Score: ${step.score.total}${deltaStr} — ${(step.timeMs / 1000).toFixed(1)}s — $${step.cost.toFixed(4)}`;
        if ((step.attempts ?? 1) > 1) line += ` — ${step.attempts} attempts`;
        if (step.escalatedTo) line += ` — escalated to ${step.escalatedTo}`;
        return line;
      }).join("\n");
      sections.push(`=== BREAKDOWN ===\n${breakdown}`);
    }

    if (assessment) sections.push(`=== AI ASSESSMENT ===\n${assessment}`);

    if (compiler.before) {
      const s = compiler.after || compiler.before;
      const compilerText = `Performance: ${s.performance}\nAccessibility: ${s.accessibility}\nSEO: ${s.seo}\nBest Practices: ${s.bestPractices}\nResult: ${s.passed ? "PASSED" : "NEEDS REVIEW"}`;
      sections.push(`=== COMPILER ===\n${compilerText}`);
      if (compiler.before.violations.length > 0) {
        const violText = compiler.before.violations.map(v => `[${v.severity}] ${v.rule}: ${v.message}`).join("\n");
        sections.push(`=== VIOLATIONS (${compiler.before.violations.length}) ===\n${violText}`);
      }
    }

    return sections.join("\n\n");
  }, [truthAnchor, truthAnchorText, buildLogEntries, buildLogText, chainResult, assessment, compiler]);

  // Auto-scroll ref for build log
  const buildLogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (buildLogRef.current) {
      buildLogRef.current.scrollTop = buildLogRef.current.scrollHeight;
    }
  }, [buildLogEntries.length]);

  const toggleStep = useCallback((si: number) => {
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      if (next.has(si)) next.delete(si);
      else next.add(si);
      return next;
    });
  }, []);

  // ── No result yet: show placeholder ──
  if (!chainResult && !running) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-300">
        <Layers className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-bold">No chain results yet</p>
        <p className="text-sm mt-1">Configure and run a hybrid chain to see results here</p>
      </div>
    );
  }

  // ── Running state — show live preview if step HTML available ──
  if (running && !chainResult) {
    if (previewHtml) {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 flex-shrink-0">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 flex-shrink-0" />
            <span className="text-sm font-bold text-white">
              Step {(currentStepIndex ?? 0) + 1} running...
            </span>
            <span className="text-sm text-zinc-400 truncate flex-1">{currentMessage}</span>
            <span className="text-sm font-bold text-emerald-400 animate-pulse">LIVE</span>
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-same-origin allow-forms"
              className="w-full h-full border-0 bg-[#1A1A2E]"
              style={{ opacity: iframeOpacity, transition: "opacity 0.3s ease" }}
              title="Hybrid Live Preview"
            />
          </div>
          {buildLogEntries.length > 0 && (
            <div ref={buildLogRef} className="max-h-32 overflow-y-auto border-t border-zinc-800 bg-zinc-950/80 px-3 py-1.5 flex-shrink-0">
              {buildLogEntries.map((ev, i) => (
                <div
                  key={i}
                  className={`font-mono py-0.5 ${getLogColor(ev)}`}
                  style={{ fontSize: "14px" }}
                >
                  {ev.type === "hybrid:guardian" && <Shield className="w-3.5 h-3.5 inline mr-1" />}
                  {ev.type === "hybrid:jury" && <Scale className="w-3.5 h-3.5 inline mr-1" />}
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
        {buildLogEntries.length > 0 && (
          <div ref={buildLogRef} className="max-h-40 overflow-y-auto border-t border-zinc-800 bg-zinc-950/80 px-3 py-1.5 flex-shrink-0">
            {buildLogEntries.map((ev, i) => (
              <div
                key={i}
                className={`font-mono py-0.5 ${getLogColor(ev)}`}
                style={{ fontSize: "14px" }}
              >
                {ev.type === "hybrid:guardian" && <Shield className="w-3.5 h-3.5 inline mr-1" />}
                {ev.type === "hybrid:jury" && <Scale className="w-3.5 h-3.5 inline mr-1" />}
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
          <span className={`px-2 py-0.5 rounded-lg text-sm font-[900] uppercase tracking-widest border ${gradeColor}`}>
            {grade}
          </span>
        )}
        <div className="flex-1" />
        {chainResult && (
          <>
            <div className="flex items-center gap-1 text-sm text-zinc-200">
              <Clock className="w-3.5 h-3.5" />
              {(chainResult.totalTimeMs / 1000).toFixed(1)}s
            </div>
            <div className="flex items-center gap-1 text-sm font-mono text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
              {chainResult.totalCost.toFixed(4)}
            </div>
            <CopyBtn
              text={fullReportText}
              label="Full Report"
              copiedKey="full-report"
              copiedSection={copiedSection}
              onCopy={handleCopy}
            />
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
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold transition-all border ${
              tab === id
                ? "bg-[#FF6700]/15 text-[#FFD700] border-[#FF6700]/40"
                : "text-zinc-300 hover:text-zinc-300 border-transparent"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
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
                className="w-full h-full border-0 bg-[#1A1A2E] opacity-0 transition-opacity duration-300"
                title="Hybrid Preview"
                onLoad={(e) => (e.currentTarget.style.opacity = "1")}
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
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyBtn
                  text={finalHtml || ""}
                  copiedKey="code"
                  copiedSection={copiedSection}
                  onCopy={handleCopy}
                />
              </div>
              <pre className="text-sm font-mono text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 overflow-auto max-h-[calc(100vh-300px)] whitespace-pre-wrap break-words">
                {finalHtml || "No HTML generated yet."}
              </pre>
            </div>
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
              const isCollapsed = collapsedSteps.has(si);

              return (
                <div key={si} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3">
                  <button
                    onClick={() => toggleStep(si)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />}
                    <span className="text-sm font-bold text-zinc-200">S{si + 1}</span>
                    <span className="text-sm font-bold text-white">{step.role}</span>
                    <span
                      className="text-sm font-bold px-1.5 py-0.5 rounded border"
                      style={{
                        borderColor: (PROVIDER_COLORS[step.provider] || "#6B7280") + "40",
                        color: PROVIDER_COLORS[step.provider] || "#D4D4D8",
                      }}
                    >
                      {step.modelId}
                    </span>
                    {(step.attempts ?? 1) > 1 && (
                      <span className="flex items-center gap-1 text-sm font-bold px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-600/30">
                        <RotateCcw className="w-3 h-3" />
                        {step.attempts} attempts
                      </span>
                    )}
                    {step.escalatedTo && (
                      <span className="flex items-center gap-1 text-sm font-bold px-1.5 py-0.5 rounded bg-sky-900/30 text-sky-400 border border-sky-600/30">
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
                  </button>
                  {!isCollapsed && (
                    <>
                      {/* Score bar */}
                      <div className="h-3.5 bg-zinc-800 rounded-full overflow-hidden mb-2 mt-2">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                          style={{ width: `${step.score.total}%` }}
                        />
                      </div>
                      {/* Meta */}
                      <div className="flex items-center gap-3 text-sm text-zinc-200">
                        <span><Clock className="w-3.5 h-3.5 inline mr-0.5" />{(step.timeMs / 1000).toFixed(1)}s</span>
                        <span className="font-mono text-green-300"><DollarSign className="w-3.5 h-3.5 inline" />{step.cost.toFixed(4)}</span>
                        <span className="font-bold">
                          {step.provider === "ollama" || step.provider === "lmstudio" ? "LOCAL" : "CLOUD"}
                        </span>
                      </div>

                      {/* Changelog — per-step diff */}
                      {cl && (
                        <div className="mt-2 pt-2 border-t border-zinc-800 text-sm space-y-0.5">
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
                              ? <><CheckCircle className="w-3.5 h-3.5" /> Regression check: PASSED — all previous sections present</>
                              : <><AlertTriangle className="w-3.5 h-3.5" /> Regression check: FAILED — {cl.regressionDetails.join("; ")}</>
                            }
                          </div>
                        </div>
                      )}
                    </>
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
                <Shield className="w-4 h-4 text-[#FF6700]" />
                <span className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Build Log</span>
                {running && <span className="text-sm font-bold text-emerald-400 animate-pulse">LIVE</span>}
                <span className="text-sm text-zinc-500">{buildLogEntries.length} entries{buildLogDuration ? ` \u00b7 ${buildLogDuration}` : ""}</span>
                <div className="flex-1" />
                <CopyBtn
                  text={buildLogText}
                  copiedKey="buildlog"
                  copiedSection={copiedSection}
                  onCopy={handleCopy}
                />
              </div>
              {/* Log entries */}
              <div className="p-3 max-h-[calc(100vh-320px)] overflow-y-auto font-mono space-y-0.5">
                {buildLogEntries.length === 0 ? (
                  <div className="text-zinc-300 py-4 text-center text-sm">
                    {running ? "Waiting for events..." : "No build log entries. Run a chain to generate."}
                  </div>
                ) : (
                  buildLogEntries.map((ev, i) => (
                      <div
                        key={i}
                        className={`py-0.5 leading-relaxed ${getLogColor(ev)}`}
                        style={{ fontSize: "14px" }}
                      >
                        {ev.type === "hybrid:guardian" && (
                          <Shield className="w-3.5 h-3.5 inline mr-1 flex-shrink-0" />
                        )}
                        {ev.type === "hybrid:jury" && (
                          <Scale className="w-3.5 h-3.5 inline mr-1 flex-shrink-0" />
                        )}
                        {ev.message}
                        <span className="text-zinc-500 ml-2" style={{ fontSize: "12px" }}>
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

      {/* ── AI Assessment (collapsible — collapsed by default) ── */}
      {chainResult && (
        <div className="border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => setAssessmentOpen(!assessmentOpen)}
            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-zinc-800/40 transition-colors"
          >
            {assessmentOpen ? <ChevronDown className="w-4 h-4 text-zinc-300" /> : <ChevronRight className="w-4 h-4 text-zinc-300" />}
            <Flame className="w-4 h-4 text-[#FF6700]" />
            <span className="text-sm font-bold text-zinc-300">AI Assessment</span>
            {assessmentLoading && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
            {!assessmentOpen && assessment && !assessmentLoading && (
              <span className="text-sm text-zinc-500 truncate ml-1">
                {assessment.split("\n")[0]?.slice(0, 60) || "Ready"}
              </span>
            )}
            {assessmentOpen && assessment && (
              <div className="ml-auto flex-shrink-0">
                <CopyBtn
                  text={assessment}
                  copiedKey="assessment"
                  copiedSection={copiedSection}
                  onCopy={handleCopy}
                />
              </div>
            )}
          </button>
          {assessmentOpen && (
            <div className="px-4 pb-3 max-h-64 overflow-y-auto">
              {assessmentLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center text-zinc-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Generating assessment...</span>
                </div>
              ) : assessment ? (
                <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                  {assessment}
                </div>
              ) : (
                <div className="text-sm text-zinc-300 py-2">Waiting for assessment...</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Truth Anchor (collapsible — collapsed by default) ── */}
      {truthAnchor && (
        <div className="border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => setTruthAnchorOpen(!truthAnchorOpen)}
            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-zinc-800/40 transition-colors"
          >
            {truthAnchorOpen ? <ChevronDown className="w-4 h-4 text-zinc-300" /> : <ChevronRight className="w-4 h-4 text-zinc-300" />}
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-zinc-300">Truth Anchor</span>
            {!truthAnchorOpen && (
              <span className="text-sm text-zinc-500 truncate ml-1">
                {truthAnchor.siteType} · {truthAnchor.requiredSections.length} sections · {truthAnchor.hash.slice(0, 8)}
              </span>
            )}
            {truthAnchorOpen && (
              <div className="ml-auto flex-shrink-0">
                <CopyBtn
                  text={truthAnchorText}
                  copiedKey="truthanchor"
                  copiedSection={copiedSection}
                  onCopy={handleCopy}
                />
              </div>
            )}
            {!truthAnchorOpen && <span className="ml-auto text-sm font-mono text-zinc-500">{truthAnchor.hash.slice(0, 8)}...</span>}
          </button>
          {truthAnchorOpen && (
            <div className="px-4 pb-3">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{truthAnchor.siteType}</span>
                  <span className="text-zinc-500">&middot;</span>
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
                <div className="text-zinc-500 font-mono pt-1 border-t border-zinc-800" style={{ fontSize: "12px" }}>
                  Hash: {truthAnchor.hash} &middot; Locked: {new Date(truthAnchor.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Compiler (collapsible — expanded by default) ── */}
      {chainResult && (
        <div className="border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => setCompilerOpen(!compilerOpen)}
            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-zinc-800/40 transition-colors"
          >
            {compilerOpen ? <ChevronDown className="w-4 h-4 text-zinc-200" /> : <ChevronRight className="w-4 h-4 text-zinc-200" />}
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-zinc-300">Compiler</span>
            {compiler.loading && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
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
                  <span className="text-sm">Running audit...</span>
                </div>
              ) : compiler.error ? (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                  {compiler.error}
                </div>
              ) : compiler.before ? (
                <div className="space-y-3">
                  {/* Score cards */}
                  {compiler.after ? (
                    <div>
                      <div className="text-sm font-bold text-zinc-200 uppercase mb-1.5">Before &rarr; After</div>
                      <div className="grid grid-cols-4 gap-2">
                        {(["performance", "accessibility", "seo", "bestPractices"] as const).map((key) => {
                          const label = key === "bestPractices" ? "Best Practices" : key.charAt(0).toUpperCase() + key.slice(1);
                          const before = compiler.before![key];
                          const after = compiler.after![key];
                          const afterColor = after >= 90 ? "text-emerald-400" : after >= 70 ? "text-amber-400" : "text-red-400";
                          const beforeColor = before >= 90 ? "text-emerald-400" : before >= 70 ? "text-amber-400" : "text-red-400";
                          return (
                            <div key={key} className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-2 text-center">
                              <div className="text-sm font-bold text-zinc-300 uppercase mb-1">{label}</div>
                              <div className="flex items-center justify-center gap-1">
                                <span className={`text-sm font-bold ${beforeColor} line-through opacity-50`}>{before}</span>
                                <span className="text-zinc-300">&rarr;</span>
                                <span className={`text-lg font-[900] ${afterColor}`}>{after}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {(["performance", "accessibility", "seo", "bestPractices"] as const).map((key) => {
                        const label = key === "bestPractices" ? "Best Practices" : key.charAt(0).toUpperCase() + key.slice(1);
                        const score = compiler.before![key];
                        const color = score >= 90 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-red-400";
                        const bgColor = score >= 90 ? "border-emerald-800/30" : score >= 70 ? "border-amber-800/30" : "border-red-800/30";
                        return (
                          <div key={key} className={`bg-zinc-900/40 border ${bgColor} rounded-lg p-2 text-center`}>
                            <div className="text-sm font-bold text-zinc-300 uppercase mb-1">{label}</div>
                            <div className={`text-lg font-[900] ${color}`}>{score}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Violations (collapsible — collapsed by default) */}
                  {compiler.before.violations.length > 0 && (
                    <div>
                      <button
                        onClick={() => setViolationsOpen(!violationsOpen)}
                        className="flex items-center gap-2 w-full text-left py-1"
                      >
                        {violationsOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-zinc-200 uppercase">
                          Violations
                        </span>
                        <span className="text-sm text-zinc-400">
                          &middot; {compiler.before.violations.length} found
                        </span>
                      </button>
                      {violationsOpen && (
                        <div className="space-y-1 max-h-48 overflow-y-auto mt-1">
                          {compiler.before.violations.slice(0, 15).map((v, vi) => (
                            <div key={vi} className="flex items-start gap-2 text-sm bg-zinc-900/40 border border-zinc-800 rounded px-2 py-1">
                              <span className={`font-bold flex-shrink-0 px-1 py-px rounded text-sm uppercase ${
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
                          {compiler.before.violations.length > 15 && (
                            <div className="text-sm text-zinc-300 px-2">
                              +{compiler.before.violations.length - 15} more
                            </div>
                          )}
                        </div>
                      )}
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
