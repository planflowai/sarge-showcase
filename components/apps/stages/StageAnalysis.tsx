'use client';

import { useResumeTailorStore } from '@/lib/stores/resumeTailorStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

interface StageAnalysisProps {
  providerStore: any;
}

export function StageAnalysis({ providerStore }: StageAnalysisProps) {
  const store = useResumeTailorStore();
  const result = store.keywordResult;

  if (!result) {
    return (
      <div className="text-center text-zinc-400">
        <p>No analysis results found. Please go back and analyze again.</p>
      </div>
    );
  }

  const percentage = Math.round(
    (result.matchScore / result.matchTotal) * 100
  );

  return (
    <div className="space-y-8">
      {/* Score Banner */}
      <div className="rounded-lg bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 p-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-indigo-400">
                {result.matchScore}
              </div>
              <div className="text-lg text-zinc-400 mt-1">
                / {result.matchTotal} keywords matched
              </div>
            </div>
            <div className="w-px h-20 bg-zinc-700" />
            <div className="text-center">
              <div className="text-5xl font-bold text-emerald-400">
                {percentage}%
              </div>
              <div className="text-lg text-zinc-400 mt-1">Match Rate</div>
            </div>
          </div>

          <div className="space-y-1 text-sm text-zinc-400">
            {result.jobTitle && (
              <p>
                Position: <span className="text-zinc-200 font-medium">{result.jobTitle}</span>
              </p>
            )}
            {result.companyName && (
              <p>
                Company: <span className="text-zinc-200 font-medium">{result.companyName}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Keywords Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Matched Keywords */}
        <div>
          <h3 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <Check className="h-5 w-5" /> Matched ({result.matched.length})
          </h3>
          <div className="space-y-2">
            {result.matched.map((keyword) => (
              <Badge
                key={keyword}
                variant="secondary"
                className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1.5"
              >
                ✓ {keyword}
              </Badge>
            ))}
          </div>
        </div>

        {/* Missing Keywords */}
        <div>
          <h3 className="text-lg font-semibold text-orange-400 mb-4 flex items-center gap-2">
            <X className="h-5 w-5" /> Missing ({result.missing.length})
          </h3>
          <div className="space-y-2">
            {result.missing.map((keyword) => (
              <Badge
                key={keyword}
                variant="secondary"
                className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-3 py-1.5"
              >
                ✗ {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-400">
          The next step will rearrange your existing resume to front-load the missing keywords,
          making your application stronger for this specific role.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button
          onClick={() => store.setStage(0)}
          variant="outline"
          size="lg"
        >
          ← Back to Edit
        </Button>
        <Button
          onClick={() => store.setStage(2)}
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Tailor Resume →
        </Button>
      </div>
    </div>
  );
}
