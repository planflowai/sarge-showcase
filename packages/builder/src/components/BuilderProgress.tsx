"use client";

import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, Circle, Loader2, Sparkles, Code2, Eye, Zap, Clock, FileCode, Cpu } from "lucide-react";
import { cn } from "@sarge/core";

interface BuilderProgressProps {
  isGenerating: boolean;
  hasCode: boolean;
  codeLength: number;
  tokenCount?: number;
  startTime?: number;
}

interface ProgressStep {
  id: string;
  label: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  icon: React.ReactNode;
}

export default function BuilderProgress({
  isGenerating,
  hasCode,
  codeLength,
  tokenCount = 0,
  startTime,
}: BuilderProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showCompleted, setShowCompleted] = useState(true);

  // Calculate stats
  const lineCount = useMemo(() => {
    if (codeLength === 0) return 0;
    // Rough estimate: average 40 chars per line
    return Math.max(1, Math.round(codeLength / 40));
  }, [codeLength]);

  const charsPerSecond = useMemo(() => {
    if (elapsedTime === 0 || codeLength === 0) return 0;
    return Math.round(codeLength / elapsedTime);
  }, [codeLength, elapsedTime]);

  // Build steps based on generation state
  const steps: ProgressStep[] = useMemo(() => {
    const result: ProgressStep[] = [];

    if (isGenerating) {
      // Step 1: Understanding request
      result.push({
        id: "thinking",
        label: "Analyzing Request",
        description: codeLength === 0 ? "Processing your instructions..." : "Request understood",
        status: codeLength === 0 ? "in_progress" : "completed",
        icon: <Cpu className="h-4 w-4" />,
      });

      // Step 2: Generating code
      result.push({
        id: "generating",
        label: "Generating Code",
        description: codeLength > 0
          ? `Writing ${codeLength.toLocaleString()} characters (~${lineCount} lines)`
          : "Waiting to start...",
        status: codeLength > 0 ? "in_progress" : "pending",
        icon: <Code2 className="h-4 w-4" />,
      });

      // Step 3: Building preview
      result.push({
        id: "preview",
        label: "Live Preview",
        description: codeLength > 0
          ? "Rendering in real-time"
          : "Waiting for code...",
        status: codeLength > 0 ? "in_progress" : "pending",
        icon: <Eye className="h-4 w-4" />,
      });

      // Step 4: Finalizing
      result.push({
        id: "finalize",
        label: "Finalize",
        description: "Complete generation",
        status: "pending",
        icon: <Sparkles className="h-4 w-4" />,
      });

    } else if (hasCode) {
      // All complete
      result.push({
        id: "thinking",
        label: "Analyzed Request",
        description: "Instructions processed",
        status: "completed",
        icon: <Cpu className="h-4 w-4" />,
      });

      result.push({
        id: "generating",
        label: "Code Generated",
        description: `${codeLength.toLocaleString()} characters (~${lineCount} lines)`,
        status: "completed",
        icon: <Code2 className="h-4 w-4" />,
      });

      result.push({
        id: "preview",
        label: "Preview Ready",
        description: "Rendered successfully",
        status: "completed",
        icon: <Eye className="h-4 w-4" />,
      });

      result.push({
        id: "finalize",
        label: "Build Complete",
        description: "Ready to use",
        status: "completed",
        icon: <Sparkles className="h-4 w-4" />,
      });
    }

    return result;
  }, [isGenerating, hasCode, codeLength, lineCount]);

  // Elapsed time counter
  useEffect(() => {
    if (!isGenerating || !startTime) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating, startTime]);

  // Keep completed state visible longer (30 seconds instead of 5)
  useEffect(() => {
    if (!isGenerating) {
      // Keep showing completed state for longer so user sees what happened
      const timer = setTimeout(() => {
        setShowCompleted(false);
      }, 30000); // 30 seconds - enough time to see the result
      return () => clearTimeout(timer);
    } else {
      setShowCompleted(true);
      setElapsedTime(0);
    }
  }, [isGenerating]);

  // Don't render if no steps or hiding completed
  if (steps.length === 0 || (!isGenerating && !showCompleted)) {
    return null;
  }

  // Calculate progress percentage
  const completedSteps = steps.filter(s => s.status === "completed").length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-900/80 dark:to-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
      {/* Main progress bar */}
      <div className="h-1 bg-zinc-200 dark:bg-zinc-800">
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            isGenerating
              ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse"
              : "bg-gradient-to-r from-green-500 to-emerald-500"
          )}
          style={{ width: `${isGenerating ? Math.max(progressPercent, 10) : 100}%` }}
        />
      </div>

      <div className="px-4 py-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isGenerating ? (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
                <Loader2 className="h-5 w-5 text-indigo-600 dark:text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {isGenerating ? "Building Your Code" : "Build Complete"}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {isGenerating
                  ? `${progressPercent}% complete`
                  : "All tasks finished successfully"
                }
              </p>
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-2">
            {elapsedTime > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
                <Clock className="h-3 w-3" />
                <span className="font-mono">{elapsedTime}s</span>
              </div>
            )}
            {codeLength > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
                <FileCode className="h-3 w-3" />
                <span className="font-mono">{codeLength.toLocaleString()}</span>
              </div>
            )}
            {isGenerating && charsPerSecond > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-xs text-indigo-700 dark:text-indigo-400">
                <Zap className="h-3 w-3" />
                <span className="font-mono">{charsPerSecond}/s</span>
              </div>
            )}
          </div>
        </div>

        {/* Steps grid - 2x2 layout */}
        <div className="grid grid-cols-2 gap-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
                step.status === "completed"
                  ? "bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/20"
                  : step.status === "in_progress"
                  ? "bg-indigo-50 dark:bg-indigo-500/5 border-indigo-200 dark:border-indigo-500/30 shadow-sm"
                  : "bg-white dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700"
              )}
            >
              {/* Step icon */}
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0",
                  step.status === "completed"
                    ? "bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500"
                    : step.status === "in_progress"
                    ? "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-500"
                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                )}
              >
                {step.status === "in_progress" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  step.icon
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.status === "completed"
                        ? "text-green-700 dark:text-green-400"
                        : step.status === "in_progress"
                        ? "text-indigo-700 dark:text-indigo-400"
                        : "text-zinc-600 dark:text-zinc-300"
                    )}
                  >
                    {step.label}
                  </span>
                  {step.status === "in_progress" && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "text-xs mt-0.5 truncate",
                    step.status === "completed"
                      ? "text-green-600 dark:text-green-400/70"
                      : step.status === "in_progress"
                      ? "text-indigo-600 dark:text-indigo-400/70"
                      : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
