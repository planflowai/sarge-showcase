'use client';

import { useEffect, useState } from 'react';
import { useResumeTailorStore } from '@/lib/stores/resumeTailorStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Radio } from 'lucide-react';

interface StageTailorProps {
  providerStore: any;
}

export function StageTailor({ providerStore }: StageTailorProps) {
  const store = useResumeTailorStore();
  const [isInitializing, setIsInitializing] = useState(false);

  // Auto-start streaming on mount if stage is 2
  useEffect(() => {
    if (store.stage === 2 && !store.isStreaming && !store.tailoredResume) {
      startTailoring();
    }
  }, []);

  const startTailoring = async () => {
    if (!store.keywordResult) {
      store.setError('Missing keyword results. Please go back and analyze again.');
      return;
    }

    store.setIsStreaming(true);
    store.setError(null);
    setIsInitializing(true);

    try {
      const systemPrompt = `You are a professional resume writer. Your job is to rearrange and rewrite the provided resume to better match a target job.

RULES:
- REARRANGE ONLY: reorganize existing content to front-load matched keywords
- NO FABRICATION: never add skills, jobs, or achievements that aren't in the original
- Remove hollow buzzwords ("synergize", "leverage", "passionate about")
- Reorder bullet points so matched keywords appear near the top of each section
- Reorder sections if it helps (e.g. move a relevant section higher)
- Output a complete, single-column plain text resume
- Use clean formatting: name at top, sections with ALL CAPS headers, bullet points with dashes
- Keep it under 2 pages worth of text (~800 words max)
- Output ONLY the resume — no preamble, no explanation, no markdown headers`;

      const keywords = store.keywordResult.matched.join(', ');
      const jobTitle = store.keywordResult.jobTitle;

      const prompt = `KEYWORDS TO FRONT-LOAD: ${keywords}
JOB TITLE: ${jobTitle}

ORIGINAL RESUME:
${store.masterResume}`;

      const tailorModel = store.tailorModel || providerStore.currentModel;
      const source =
        providerStore.currentProvider === 'ollama' ? 'local' : 'cloud';

      const response = await fetch('/api/test/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: tailorModel,
          prompt,
          systemPrompt,
          source,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Stream error: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      setIsInitializing(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                store.appendTailoredResume(data.message.content);
              }
            } catch {
              // Partial JSON, skip
            }
          }
        }
      }

      // Process final buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.message?.content) {
            store.appendTailoredResume(data.message.content);
          }
        } catch {
          // Ignore final partial
        }
      }

      store.finalizeTailoredResume();
      store.setStage(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Streaming failed';
      store.setError(message);
    } finally {
      store.setIsStreaming(false);
      setIsInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-zinc-100">
        Tailored Resume
      </h2>

      {/* Streaming or Display Area */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        {store.isStreaming || isInitializing ? (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-4 w-4 text-indigo-400 animate-pulse" />
              <span className="text-sm text-indigo-400 font-medium">
                Generating your tailored resume...
              </span>
            </div>
            <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {store.tailoredResumeStreaming || (isInitializing ? 'Initializing...' : '')}
            </pre>
          </div>
        ) : (
          <div className="p-6">
            <Textarea
              value={store.tailoredResume}
              onChange={(e) => store.setTailoredResume(e.target.value)}
              placeholder="Your tailored resume will appear here..."
              className="min-h-96 font-mono text-sm resize-none"
            />
            <p className="text-xs text-zinc-500 mt-2">
              {store.tailoredResume.length} characters
            </p>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-400">
          Review your tailored resume above. You can edit it directly. When ready,
          we'll generate a customized cover letter for this role.
        </p>
      </div>

      {/* Action Buttons */}
      {!store.isStreaming && !isInitializing && (
        <div className="flex justify-between">
          <Button
            onClick={() => store.setStage(1)}
            variant="outline"
            size="lg"
          >
            ← Back to Keywords
          </Button>
          <Button
            onClick={() => store.setStage(3)}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Generate Cover Letter →
          </Button>
        </div>
      )}
    </div>
  );
}
