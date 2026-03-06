"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Cpu,
  ShieldCheck,
  Database,
  Send,
} from "lucide-react";

interface StepResult {
  step: number;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  details: string;
  duration_ms?: number;
}

interface PipelineReport {
  timestamp: string;
  duration_seconds: number;
  total_cost: string;
  steps: StepResult[];
  passed: number;
  failed: number;
  skipped: number;
  summary: string;
}

// Human-readable descriptions for each step
const STEP_INFO: { name: string; description: string; proves: string }[] = [
  { name: "Intake Submission",    description: "Submits a test client form",       proves: "Client form saves to database" },
  { name: "Prompt Assembly",      description: "Converts form into AI prompt",     proves: "Form data becomes a build instruction" },
  { name: "Project Creation",     description: "Creates a project folder on disk", proves: "File system writes work" },
  { name: "Build Execution",      description: "AI generates a full HTML page",    proves: "Cloud model responds and produces code" },
  { name: "Conversation History", description: "AI remembers prior context",       proves: "Multi-turn chat works with history" },
  { name: "Edit Mode",            description: "AI makes surgical code edits",     proves: "Edit blocks apply without full rewrite" },
  { name: "Compiler",             description: "Audits the generated HTML",        proves: "Lighthouse scores (perf, a11y, SEO) returned" },
  { name: "Certificate Check",    description: "Generates a quality badge",        proves: "PDF certificate created if scores qualify" },
  { name: "PII Injection",        description: "Replaces placeholders with data",  proves: "{{phone}}, {{email}} tokens get real values" },
  { name: "Supabase Logging",     description: "Verifies database records exist",  proves: "Build history, scores, billing all logged" },
  { name: "Revision Submission",  description: "Submits a change request",         proves: "Client revisions save and link to project" },
  { name: "Email Send",           description: "Sends a test notification",        proves: "Resend API delivers email" },
  { name: "Build from Intake",    description: "Re-generates from saved intake",   proves: "Stored intake can trigger a new build" },
  { name: "Preview Approval",     description: "Approves preview for deployment",  proves: "Status transitions work (preview → deployed)" },
  { name: "Rollback",             description: "Reverts deployment to preview",    proves: "Rollback undoes approval correctly" },
  { name: "Auto-Approval Check",  description: "Tests automatic approval routing", proves: "Cron-based auto-approve endpoint responds" },
];

// Group steps into logical phases
const PHASES: { label: string; icon: React.ElementType; color: string; steps: number[] }[] = [
  { label: "Setup",          icon: FileText,    color: "text-blue-400",    steps: [1, 2, 3] },
  { label: "AI Build",       icon: Cpu,         color: "text-violet-400",  steps: [4, 5, 6] },
  { label: "Quality",        icon: ShieldCheck, color: "text-amber-400",   steps: [7, 8, 9] },
  { label: "Database",       icon: Database,    color: "text-cyan-400",    steps: [10] },
  { label: "Client Workflow", icon: Send,       color: "text-emerald-400", steps: [11, 12, 13, 14, 15, 16] },
];

const TOTAL_STEPS = STEP_INFO.length;

export function PipelineDiagnostics() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<PipelineReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const runTest = useCallback(async () => {
    setRunning(true);
    setReport(null);
    setError(null);
    setCurrentStep(1);
    setExpandedSteps(new Set());

    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < TOTAL_STEPS ? prev + 1 : prev));
    }, 4000);

    try {
      const res = await fetch("/api/pipeline-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      clearInterval(interval);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data: PipelineReport = await res.json();
      setReport(data);
      setCurrentStep(TOTAL_STEPS);

      // Auto-expand any failed steps
      const failedSteps = new Set<number>();
      data.steps.forEach(s => { if (s.status === "FAIL") failedSteps.add(s.step); });
      setExpandedSteps(failedSteps);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Pipeline test failed");
    } finally {
      setRunning(false);
    }
  }, []);

  const copyReport = useCallback(() => {
    if (!report) return;
    const lines: string[] = [];
    lines.push(`SARGE Pipeline Diagnostics — ${new Date(report.timestamp).toLocaleString()}`);
    lines.push("═".repeat(60));
    lines.push(`Result: ${report.summary}`);
    lines.push(`Duration: ${report.duration_seconds}s · Cost: ${report.total_cost}`);
    lines.push(`Passed: ${report.passed} · Failed: ${report.failed} · Skipped: ${report.skipped}`);
    lines.push("");
    for (const step of report.steps) {
      const icon = step.status === "PASS" ? "✓" : step.status === "FAIL" ? "✗" : "–";
      const dur = step.duration_ms !== undefined
        ? step.duration_ms < 1000 ? `${step.duration_ms}ms` : `${(step.duration_ms / 1000).toFixed(1)}s`
        : "";
      lines.push(`${icon} ${step.step.toString().padStart(2)}. ${step.name.padEnd(24)} ${step.status.padEnd(5)} ${dur.padStart(7)}  ${step.details}`);
    }
    lines.push("");
    lines.push("Generated by SARGE — The Foundry");
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [report]);

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const getStepResult = (stepNum: number): StepResult | undefined => {
    return report?.steps.find(s => s.step === stepNum);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-violet-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Pipeline Diagnostics</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              16 real tests using dummy data. Every step makes a live API call.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <Button
              onClick={copyReport}
              variant="outline"
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            >
              {copied ? (
                <><Check className="h-4 w-4 mr-2 text-emerald-400" /> Copied!</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" /> Copy Report</>
              )}
            </Button>
          )}
          <Button
            onClick={runTest}
            disabled={running}
            className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40"
          >
            {running ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
            ) : (
              <><Activity className="h-4 w-4 mr-2" /> Run All Tests</>
            )}
          </Button>
        </div>
      </div>

      {/* Progress bar during run */}
      {running && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            <span className="text-sm font-bold text-white">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <span className="text-sm text-zinc-400">
              {STEP_INFO[currentStep - 1]?.name || "..."}
            </span>
            <span className="text-sm text-zinc-500 ml-auto">
              {STEP_INFO[currentStep - 1]?.description}
            </span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <div
              className="bg-violet-500 h-2 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-bold text-red-400">{error}</p>
        </div>
      )}

      {/* Summary card */}
      {report && (
        <div className={`rounded-lg p-5 border ${
          report.failed === 0
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-red-500/30 bg-red-500/5"
        }`}>
          <div className="flex items-center gap-4">
            {report.failed === 0 ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle className="h-8 w-8 text-red-400 flex-shrink-0" />
            )}
            <div>
              <p className={`text-lg font-bold ${report.failed === 0 ? "text-emerald-400" : "text-red-400"}`}>
                {report.failed === 0 ? "All Systems Operational" : `${report.failed} Step${report.failed !== 1 ? "s" : ""} Failed`}
              </p>
              <div className="flex items-center gap-4 mt-1 text-sm text-zinc-400">
                <span className="text-emerald-400 font-semibold">{report.passed} passed</span>
                {report.failed > 0 && <span className="text-red-400 font-semibold">{report.failed} failed</span>}
                {report.skipped > 0 && <span className="text-zinc-500">{report.skipped} skipped</span>}
                <span>·</span>
                <span>{report.duration_seconds}s</span>
                <span>·</span>
                <span>{report.total_cost}</span>
                <span>·</span>
                <span>{new Date(report.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase groups with steps */}
      {(report || !running) && (
        <div className="space-y-4">
          {PHASES.map((phase) => {
            const PhaseIcon = phase.icon;
            const phaseResults = phase.steps.map(s => getStepResult(s)).filter(Boolean) as StepResult[];
            const phasePassed = phaseResults.filter(r => r.status === "PASS").length;
            const phaseFailed = phaseResults.filter(r => r.status === "FAIL").length;
            const hasResults = phaseResults.length > 0;

            return (
              <div key={phase.label} className="rounded-lg border border-zinc-700 overflow-hidden">
                {/* Phase header */}
                <div className="flex items-center gap-3 px-5 py-3 bg-zinc-800/70">
                  <PhaseIcon className={`h-5 w-5 ${phase.color}`} />
                  <h3 className="text-base font-bold text-white uppercase tracking-wider flex-1">{phase.label}</h3>
                  {hasResults && (
                    <div className="flex items-center gap-3 text-sm">
                      {phasePassed > 0 && (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> {phasePassed}
                        </span>
                      )}
                      {phaseFailed > 0 && (
                        <span className="text-red-400 font-semibold flex items-center gap-1">
                          <XCircle className="h-4 w-4" /> {phaseFailed}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Steps */}
                <div className="divide-y divide-zinc-700/50">
                  {phase.steps.map(stepNum => {
                    const info = STEP_INFO[stepNum - 1];
                    const result = getStepResult(stepNum);
                    const isExpanded = expandedSteps.has(stepNum);
                    const isActive = running && currentStep === stepNum;

                    return (
                      <div
                        key={stepNum}
                        className={`px-5 py-3 transition-colors ${
                          result?.status === "FAIL" ? "bg-red-950/10" :
                          result?.status === "PASS" ? "bg-zinc-900" :
                          isActive ? "bg-violet-950/10" : "bg-zinc-900"
                        }`}
                      >
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => result && toggleStep(stepNum)}
                        >
                          {/* Status icon */}
                          <div className="flex-shrink-0 w-6">
                            {isActive ? (
                              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                            ) : result ? (
                              result.status === "PASS" ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                              ) : result.status === "FAIL" ? (
                                <XCircle className="h-5 w-5 text-red-400" />
                              ) : (
                                <MinusCircle className="h-5 w-5 text-zinc-500" />
                              )
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-zinc-600" />
                            )}
                          </div>

                          {/* Step info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{info.name}</span>
                              <span className="text-sm text-zinc-500">—</span>
                              <span className="text-sm text-zinc-400">{info.description}</span>
                            </div>
                          </div>

                          {/* Duration */}
                          {result?.duration_ms !== undefined && (
                            <span className="text-sm text-zinc-500 font-mono flex-shrink-0 w-16 text-right">
                              {result.duration_ms < 1000
                                ? `${result.duration_ms}ms`
                                : `${(result.duration_ms / 1000).toFixed(1)}s`}
                            </span>
                          )}

                          {/* Expand chevron */}
                          {result && (
                            <div className="flex-shrink-0 text-zinc-500">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          )}
                        </div>

                        {/* Expanded details */}
                        {result && isExpanded && (
                          <div className="mt-3 ml-9 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-zinc-500 font-semibold uppercase">Proves:</span>
                              <span className="text-zinc-300">{info.proves}</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs">
                              <span className="text-zinc-500 font-semibold uppercase flex-shrink-0">Result:</span>
                              <span className={`${
                                result.status === "PASS" ? "text-emerald-400" :
                                result.status === "FAIL" ? "text-red-400" : "text-zinc-400"
                              } break-words whitespace-pre-wrap`}>
                                {result.details}
                              </span>
                            </div>
                          </div>
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
  );
}
