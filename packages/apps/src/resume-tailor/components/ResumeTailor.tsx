'use client';

import { useEffect } from 'react';
import { useResumeTailorStore } from '../resumeTailorStore';
import { useProviderStore } from '@sarge/core';
import { StageIndicator } from './StageIndicator';
import { StageInput } from './stages/StageInput';
import { StageAnalysis } from './stages/StageAnalysis';
import { StageTailor } from './stages/StageTailor';
import { StageCoverLetter } from './stages/StageCoverLetter';
import { StageJobSearch } from './stages/StageJobSearch';

export function ResumeTailor() {
  const store = useResumeTailorStore();
  const providerStore = useProviderStore();

  // Hydrate stores on mount
  useEffect(() => {
    store.setStage(store.stage); // Ensure stage is valid
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950">
      {/* Header */}
      <div className="px-8 py-6 border-b border-zinc-800">
        <h1 className="text-3xl font-bold text-zinc-100 mb-1">Resume Tailor</h1>
        <p className="text-sm text-zinc-400">
          Match your resume to any job posting in 3 AI-powered steps
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="px-8 py-6 border-b border-zinc-800 bg-zinc-900/50">
        <StageIndicator currentStage={store.stage} />
      </div>

      {/* Error Banner */}
      {store.error && (
        <div className="px-8 py-4 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-red-400">⚠️</div>
            <p className="text-sm text-red-300">{store.error}</p>
          </div>
          <button
            onClick={() => store.setError(null)}
            className="text-xs text-red-400 hover:text-red-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {store.stage === 0 && <StageInput />}
          {store.stage === 1 && (
            <StageAnalysis providerStore={providerStore} />
          )}
          {store.stage === 2 && (
            <StageTailor providerStore={providerStore} />
          )}
          {(store.stage === 3 || store.stage === 4) && (
            <StageCoverLetter providerStore={providerStore} />
          )}
          {store.stage === 5 && (
            <StageJobSearch providerStore={providerStore} />
          )}
        </div>
      </div>
    </div>
  );
}
