"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

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

function ProgressCard({ step }: { step: ProgressStep }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200",
        step.status === "completed"
          ? "border-[#FF6700]/30 bg-[#FF6700]/5"
          : step.status === "in_progress"
          ? "border-[#FF6700]/40 bg-[#FF6700]/10"
          : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 opacity-50"
      )}
    >
      {/* Forge status indicator */}
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {step.status === "completed" ? (
          <span className="text-sm font-bold" style={{ color: "#FF6700" }}>✓</span>
        ) : step.status === "in_progress" ? (
          <div className="ember-ring micro">
            <div className="ring"></div>
            <div className="core"></div>
          </div>
        ) : (
          <div className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        )}
      </div>

      {/* Label and detail */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-medium truncate",
          step.status === "completed" || step.status === "in_progress"
            ? "text-zinc-200"
            : "text-zinc-500 dark:text-zinc-400"
        )} style={step.status === "in_progress" ? { color: "#FF6700" } : undefined}>
          {step.label}
        </p>
        {step.detail && step.status === "in_progress" && (
          <p className="text-[10px] truncate" style={{ color: "#FF6700", opacity: 0.7 }}>
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
        <div className="ember-ring micro">
          <div className="ring"></div>
          <div className="core"></div>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#FF6700" }}>
          Forging...
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
      { id: "context", label: "Stoking the forge", status: "in_progress", icon: "search" },
      { id: "analyze", label: "Reading the blueprints", status: "pending", icon: "analyze" },
      { id: "generate", label: "Pouring metal", status: "pending", icon: "generate" },
      { id: "preview", label: "Quenching", status: "pending", icon: "preview" },
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
