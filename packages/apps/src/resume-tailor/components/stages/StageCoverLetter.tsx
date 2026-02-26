'use client';

import { useEffect, useState } from 'react';
import { useResumeTailorStore } from '../../resumeTailorStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Radio, Download, Copy, RotateCcw } from 'lucide-react';
import { exportResumeToPDF, exportCoverLetterToPDF } from '../../export/resumePdf';
import { exportResumeToDocx, exportCoverLetterToDocx } from '../../export/resumeDocx';

interface StageCoverLetterProps {
  providerStore: any;
}

export function StageCoverLetter({ providerStore }: StageCoverLetterProps) {
  const store = useResumeTailorStore();
  const [isInitializing, setIsInitializing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'resume' | 'letter' | null>(null);

  // Don't auto-start — wait for user to click "Generate Cover Letter"
  useEffect(() => {
    // Only auto-start if coming back from Job Search (stage 5) to regenerate
    if (store.stage === 3 && !store.isStreaming && !store.coverLetter && store.jobSearchResults.length === 0) {
      // Don't auto-start, let user click button
    }
  }, []);

  const startCoverLetter = async () => {
    if (!store.keywordResult) {
      store.setError('Missing keyword results. Please go back and analyze again.');
      return;
    }

    store.setIsStreaming(true);
    store.setError(null);
    setIsInitializing(true);

    try {
      const systemPrompt = `You are a professional cover letter writer. Write a cover letter using the Problem-Solution format.

RULES:
- 3 paragraphs only, under 300 words total
- Paragraph 1 (Problem): Name the specific challenge or opportunity the company faces. Show you understand their world.
- Paragraph 2 (Solution): Explain how your specific experience and matched skills solve that problem. Reference 2-3 concrete achievements from the resume.
- Paragraph 3 (Close): Express enthusiasm, request a conversation, provide a clear call to action.
- Sound human: no corporate jargon, no clichés like "I am writing to express my interest"
- Do not start with "I"
- Do not use bullet points
- Output ONLY the letter body — no subject line, no date header, no "Dear [Name]" salutation`;

      const keywords = store.keywordResult.matched.join(', ');
      const jobTitle = store.keywordResult.jobTitle;
      const companyName = store.keywordResult.companyName || 'the company';

      const prompt = `JOB TITLE: ${jobTitle}
COMPANY: ${companyName}
KEYWORDS MATCHED: ${keywords}

TAILORED RESUME:
${store.tailoredResume}`;

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
                store.appendCoverLetter(data.message.content);
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
            store.appendCoverLetter(data.message.content);
          }
        } catch {
          // Ignore final partial
        }
      }

      store.finalizeCoverLetter();
      store.setStage(4);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Streaming failed';
      store.setError(message);
    } finally {
      store.setIsStreaming(false);
      setIsInitializing(false);
    }
  };

  const handleCopyResume = async () => {
    try {
      await navigator.clipboard.writeText(store.tailoredResume);
      setCopyFeedback('resume');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      store.setError('Failed to copy resume');
    }
  };

  const handleCopyCoverLetter = async () => {
    try {
      await navigator.clipboard.writeText(store.coverLetter);
      setCopyFeedback('letter');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      store.setError('Failed to copy cover letter');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const jobTitle = store.keywordResult?.jobTitle || 'resume';
      exportResumeToPDF(store.tailoredResume, jobTitle);
      exportCoverLetterToPDF(store.coverLetter, jobTitle);
    } catch (err) {
      store.setError('Failed to download PDF');
    }
  };

  const handleDownloadDocx = async () => {
    try {
      const jobTitle = store.keywordResult?.jobTitle || 'resume';
      await exportResumeToDocx(store.tailoredResume, jobTitle);
      await exportCoverLetterToDocx(store.coverLetter, jobTitle);
    } catch (err) {
      store.setError('Failed to download DOCX');
    }
  };

  const handleFindJobs = async () => {
    if (!store.keywordResult) {
      store.setError('Missing keyword results. Please go back and analyze again.');
      return;
    }

    store.setIsSearching(true);
    store.setError(null);

    try {
      const jobTitle = store.keywordResult.jobTitle;
      const keywords = store.keywordResult.matched.join(', ');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerStore.currentProvider,
          model: providerStore.currentModel,
          messages: [
            {
              role: 'system',
              content: `You are a job search assistant. Find 10-15 real job postings that match the criteria. Return results as JSON array.

Return ONLY valid JSON array, no markdown, no explanation:
[{"id": "1", "title": "...", "company": "...", "location": "...", "postedDate": "...", "url": "https://..."}]`,
            },
            {
              role: 'user',
              content: `Find job postings similar to: ${jobTitle}
Keywords: ${keywords}

Search for real, recent positions with these skills. Include the actual URL where the job can be found.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Job search failed');
      }

      const data = await response.json();
      const raw = data.content ?? data.message?.content ?? '';

      // Parse JSON response (may be wrapped in markdown)
      let jsonStr = raw.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }
      jsonStr = jsonStr.trim();

      // Extract JSON if wrapped in text
      if (!jsonStr.startsWith('[')) {
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      if (!jsonStr.startsWith('[')) {
        throw new Error('Invalid response format');
      }

      const jobs = JSON.parse(jsonStr);
      if (!Array.isArray(jobs)) {
        throw new Error('Response is not an array');
      }

      store.setJobSearchResults(jobs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Job search failed';
      store.setError(message);
      console.error('Job search error:', err);
    } finally {
      store.setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-zinc-100">
        Cover Letter
      </h2>

      {/* Streaming or Display Area */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        {store.isStreaming || isInitializing ? (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-4 w-4 text-indigo-400 animate-pulse" />
              <span className="text-sm text-indigo-400 font-medium">
                Generating your cover letter...
              </span>
            </div>
            <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {store.coverLetterStreaming || (isInitializing ? 'Initializing...' : '')}
            </pre>
          </div>
        ) : !store.coverLetter ? (
          <div className="p-8 flex flex-col items-center justify-center min-h-96 gap-4">
            <div className="text-center">
              <p className="text-zinc-300 mb-4">Your tailored resume is ready!</p>
              <p className="text-sm text-zinc-400 mb-6">
                Generate a customized cover letter using the Problem-Solution format.
              </p>
              <Button
                onClick={startCoverLetter}
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Generate Cover Letter
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <Textarea
              value={store.coverLetter}
              onChange={(e) => store.setCoverLetter(e.target.value)}
              placeholder="Your cover letter will appear here..."
              className="min-h-96 text-sm resize-none"
            />
            <p className="text-xs text-zinc-500 mt-2">
              {store.coverLetter.length} characters (~{Math.ceil(store.coverLetter.split(/\s+/).length / 200)} min read)
            </p>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-400">
          You can edit both documents above. When ready, download them and apply to the job!
        </p>
      </div>

      {/* Download Section (only show when not streaming) */}
      {!store.isStreaming && !isInitializing && store.coverLetter && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PDF Download */}
            <button
              onClick={handleDownloadPDF}
              className="flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-3 text-sm font-medium text-indigo-300 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>

            {/* DOCX Download */}
            <button
              onClick={handleDownloadDocx}
              className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-3 text-sm font-medium text-blue-300 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download DOCX
            </button>
          </div>

          {/* Copy to Clipboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleCopyResume}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                copyFeedback === 'resume'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300'
              }`}
            >
              <Copy className="h-4 w-4" />
              {copyFeedback === 'resume' ? 'Resume Copied!' : 'Copy Resume'}
            </button>

            <button
              onClick={handleCopyCoverLetter}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                copyFeedback === 'letter'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300'
              }`}
            >
              <Copy className="h-4 w-4" />
              {copyFeedback === 'letter' ? 'Cover Letter Copied!' : 'Copy Letter'}
            </button>
          </div>

          {/* Find Similar Jobs */}
          <button
            onClick={() => {
              store.setJobSearchResults([]);
              store.setStage(5);
              // Trigger job search
              handleFindJobs();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-3 text-sm font-medium text-emerald-300 transition-colors"
          >
            <span>🔍</span>
            Find Similar Jobs
          </button>

          {/* Start Over */}
          <button
            onClick={() => store.reset()}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Start Over
          </button>
        </div>
      )}

      {/* Back Button (only during streaming) */}
      {(store.isStreaming || isInitializing) && (
        <div>
          <Button variant="outline" size="lg" disabled>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Generating...
          </Button>
        </div>
      )}
    </div>
  );
}
