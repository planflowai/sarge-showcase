"use client";

import { useState } from "react";
import { useDebateStore } from "@/lib/stores/debateStore";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";
import { ExecutiveSummaryModal } from "./ExecutiveSummaryModal";

function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
    </span>
  );
}

export function DebateBanner() {
  const debate = useDebateStore((s) => s.debate);
  const openDebate = useDebateStore((s) => s.openDebate);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  if (!debate) return null;

  const isComplete = debate.status === 'completed';

  return (
    <>
      <div className="border-b border-zinc-700 bg-zinc-800 px-4 py-2 flex items-center justify-between">
        {isComplete ? (
          <>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-sm text-zinc-300">Debate Complete - Summary Ready</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowSummaryModal(true)} className="h-7 text-xs">
                View Summary
              </Button>
              <Button size="sm" variant="ghost" onClick={openDebate} className="h-7 text-xs">
                View Full Debate
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400 animate-pulse" />
              <span className="text-sm text-zinc-300">
                Debate Running - Round {debate.currentRound}/{debate.rounds}
              </span>
              <AnimatedDots />
            </div>
            <Button size="sm" onClick={openDebate} className="h-7 text-xs">
              View
            </Button>
          </>
        )}
      </div>

      {/* Executive Summary Modal */}
      {debate.executiveSummary && (
        <ExecutiveSummaryModal
          open={showSummaryModal}
          onOpenChange={setShowSummaryModal}
          summary={debate.executiveSummary}
          topic={debate.topic}
        />
      )}
    </>
  );
}
