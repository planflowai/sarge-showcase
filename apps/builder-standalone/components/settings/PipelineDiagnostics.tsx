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

const STEP_NAMES = [
  "Intake Submission",
  "Prompt Assembly",
  "Project Creation",
  "Build Execution",
  "Conversation History",
  "Edit Mode",
  "Compiler",
  "Certificate Check",
  "PII Injection",
  "Supabase Logging",
  "Revision Submission",
  "Email Send",
  "Build from Intake",
  "Preview Approval",
  "Rollback",
  "Auto-Approval Check",
];

const TOTAL_STEPS = STEP_NAMES.length;

export function PipelineDiagnostics() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<PipelineReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const runTest = useCallback(async () => {
    setRunning(true);
    setReport(null);
    setError(null);
    setCurrentStep(1);

    // Simulate step progress while waiting
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
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Pipeline test failed");
    } finally {
      setRunning(false);
    }
  }, []);

  const copyReport = useCallback(() => {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [report]);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "PASS")
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    if (status === "FAIL")
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    return <MinusCircle className="h-4 w-4 text-zinc-500 shrink-0" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Pipeline Diagnostics
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Runs all 16 pipeline steps with dummy data using the cheapest
            available cloud model.
          </p>
        </div>
        <Button
          onClick={runTest}
          disabled={running}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40"
          size="sm"
        >
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Run Pipeline Test
            </>
          )}
        </Button>
      </div>

      {/* Progress indicator */}
      {running && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            <span className="text-sm text-zinc-300">
              Step {currentStep} of {TOTAL_STEPS}:{" "}
              {STEP_NAMES[currentStep - 1] || "..."}
            </span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-1.5">
            <div
              className="bg-violet-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-3">
          {/* Summary card */}
          <div
            className={`rounded-lg p-4 border ${
              report.failed === 0
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-red-500/10 border-red-500/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm font-semibold ${
                    report.failed === 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {report.summary}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {report.duration_seconds}s &middot; {report.total_cost}{" "}
                  &middot; {new Date(report.timestamp).toLocaleString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyReport}
                className="h-7 text-xs text-zinc-400 hover:text-zinc-100"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Report
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Step results */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg divide-y divide-zinc-700/50">
            {report.steps.map((step) => (
              <div
                key={step.step}
                className="flex items-start gap-3 px-4 py-3"
              >
                <StatusIcon status={step.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">
                      {step.step}.
                    </span>
                    <span className="text-sm text-zinc-200 font-medium">
                      {step.name}
                    </span>
                    {step.duration_ms !== undefined && (
                      <span className="text-xs text-zinc-500">
                        {step.duration_ms < 1000
                          ? `${step.duration_ms}ms`
                          : `${(step.duration_ms / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 break-words">
                    {step.details}
                  </p>
                </div>
                <span
                  className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${
                    step.status === "PASS"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : step.status === "FAIL"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-zinc-500/10 text-zinc-400"
                  }`}
                >
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
