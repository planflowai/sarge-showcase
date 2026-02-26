"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  FileSearch,
  Brain,
  Code2,
  FileEdit,
  Check,
  Loader2,
  Sparkles,
  Eye,
  FileCode,
  Zap
} from "lucide-react";
import { cn } from "@sarge/core";

export type ProgressStep = {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed";
  icon: "search" | "analyze" | "generate" | "write" | "preview" | "detect";
  detail?: string;
};

interface ProgressCardsProps {
  steps: ProgressStep[];
  isVisible: boolean;
}

const stepIcons = {
  search: FileSearch,
  analyze: Brain,
  generate: Code2,
  write: FileEdit,
  preview: Eye,
  detect: FileCode,
};

function ProgressCard({ step }: { step: ProgressStep }) {
  const Icon = stepIcons[step.icon];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200",
        step.status === "completed"
          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
          : step.status === "in_progress"
          ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
          : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 opacity-50"
      )}
    >
      {/* Status indicator */}
      <div className="flex-shrink-0">
        {step.status === "completed" ? (
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        ) : step.status === "in_progress" ? (
          <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
            <Loader2 className="w-3 h-3 text-white animate-spin" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        )}
      </div>

      {/* Icon */}
      <Icon className={cn(
        "w-4 h-4 flex-shrink-0",
        step.status === "completed"
          ? "text-emerald-600 dark:text-emerald-400"
          : step.status === "in_progress"
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-zinc-400 dark:text-zinc-500"
      )} />

      {/* Label and detail */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-medium truncate",
          step.status === "completed"
            ? "text-emerald-700 dark:text-emerald-300"
            : step.status === "in_progress"
            ? "text-indigo-700 dark:text-indigo-300"
            : "text-zinc-500 dark:text-zinc-400"
        )}>
          {step.label}
        </p>
        {step.detail && step.status === "in_progress" && (
          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 truncate">
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProgressCards({ steps, isVisible }: ProgressCardsProps) {
  if (!isVisible || steps.length === 0) return null;

  return (
    <div className="space-y-1.5 py-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Working...
        </span>
      </div>

      {/* Progress cards */}
      <div className="space-y-1">
        {steps.map((step) => (
          <ProgressCard key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}

/**
 * Hook to manage progress steps during AI generation
 * All callbacks are memoized to prevent infinite loops in useEffect dependencies
 */
export function useProgressSteps() {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Track which steps have been started to prevent duplicate calls
  const startedStepsRef = useRef<Set<string>>(new Set());

  const startProgress = useCallback(() => {
    startedStepsRef.current = new Set(['context']);
    setIsVisible(true);
    setSteps([
      { id: "context", label: "Reading context...", status: "in_progress", icon: "search" },
      { id: "analyze", label: "Analyzing request", status: "pending", icon: "analyze" },
      { id: "generate", label: "Generating code", status: "pending", icon: "generate" },
      { id: "preview", label: "Building preview", status: "pending", icon: "preview" },
    ]);
  }, []);

  const updateStep = useCallback((stepId: string, updates: Partial<ProgressStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }, []);

  const completeStep = useCallback((stepId: string) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status: "completed" as const } : step
    ));
  }, []);

  const startStep = useCallback((stepId: string, detail?: string) => {
    // Prevent calling startStep multiple times for the same step
    if (startedStepsRef.current.has(stepId)) {
      return;
    }
    startedStepsRef.current.add(stepId);

    setSteps(prev => prev.map(step => ({
      ...step,
      status: step.id === stepId ? "in_progress" :
              step.status === "in_progress" ? "completed" : step.status,
      detail: step.id === stepId ? detail : step.detail,
    })));
  }, []);

  const addStep = useCallback((step: ProgressStep) => {
    setSteps(prev => [...prev, step]);
  }, []);

  const finishProgress = useCallback(() => {
    // Mark all remaining steps as completed
    setSteps(prev => prev.map(step => ({ ...step, status: "completed" as const })));
    // Hide after a short delay
    setTimeout(() => {
      setIsVisible(false);
      setSteps([]);
      startedStepsRef.current = new Set();
    }, 500);
  }, []);

  const resetProgress = useCallback(() => {
    setIsVisible(false);
    setSteps([]);
    startedStepsRef.current = new Set();
  }, []);

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(() => ({
    steps,
    isVisible,
    startProgress,
    updateStep,
    completeStep,
    startStep,
    addStep,
    finishProgress,
    resetProgress,
  }), [steps, isVisible, startProgress, updateStep, completeStep, startStep, addStep, finishProgress, resetProgress]);
}
