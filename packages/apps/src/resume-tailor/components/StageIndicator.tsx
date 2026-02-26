'use client';

import { TailorStage } from '../resumeTailorStore';
import { CheckCircle2, Circle } from 'lucide-react';

interface StageIndicatorProps {
  currentStage: TailorStage;
}

const STAGES = [
  { id: 0, label: 'Input' },
  { id: 1, label: 'Analysis' },
  { id: 2, label: 'Tailor' },
  { id: 3, label: 'Cover Letter' },
  { id: 4, label: 'Download' },
  { id: 5, label: 'Jobs' },
];

export function StageIndicator({ currentStage }: StageIndicatorProps) {
  return (
    <div className="flex items-center justify-between max-w-2xl">
      {STAGES.map((stage, index) => {
        const isCompleted = stage.id < currentStage;
        const isCurrent = stage.id === currentStage;

        return (
          <div key={stage.id} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : (
                <Circle
                  className={
                    isCurrent ? 'h-6 w-6 text-indigo-500' : 'h-6 w-6 text-zinc-600'
                  }
                  fill={isCurrent ? '#6366f1' : 'none'}
                />
              )}
              <span
                className={
                  isCurrent
                    ? 'text-xs font-semibold text-indigo-400 mt-1'
                    : isCompleted
                    ? 'text-xs font-semibold text-emerald-400 mt-1'
                    : 'text-xs font-semibold text-zinc-500 mt-1'
                }
              >
                {stage.label}
              </span>
            </div>

            {/* Connector Line (hidden after last stage) */}
            {index < STAGES.length - 1 && (
              <div className="flex-1 mx-2">
                <div
                  className={
                    isCompleted
                      ? 'h-1 bg-emerald-500'
                      : 'h-1 bg-zinc-700'
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
