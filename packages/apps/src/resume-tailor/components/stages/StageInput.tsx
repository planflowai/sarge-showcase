'use client';

import { useResumeTailorStore } from '@/lib/stores/resumeTailorStore';
import { useProviderStore } from '@/lib/stores/providerStore';
import { providers } from '@/lib/providers';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';

export function StageInput() {
  const store = useResumeTailorStore();
  const providerStore = useProviderStore();
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const canAnalyze = store.masterResume.trim() && store.jobPosting.trim();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    // Accept .txt, .pdf (as text), .docx is harder to parse, so we'll focus on txt/pdf
    if (!file.name.match(/\.(txt|pdf|doc|docx)$/i)) {
      setLocalError('Please drop a text file (.txt, .pdf, .doc, .docx)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        store.setMasterResume(text);
        setLocalError(null);
      }
    };
    reader.onerror = () => {
      setLocalError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    store.setIsLoading(true);
    store.setError(null);
    setLocalError(null);

    try {
      // Determine model to use for extraction
      const extractionModel = store.analysisModel || (
        providerStore.currentProvider === 'anthropic'
          ? 'claude-haiku-4-5-20251001'
          : providerStore.currentModel
      );

      const systemPrompt = `You are a resume keyword analyzer. Your ONLY task is to extract keywords and compare them.

TASK:
1. Extract 10-20 technical keywords from the job posting (languages, tools, frameworks, skills)
2. Check which keywords appear in the resume
3. Return ONLY this JSON object with NO other text, NO markdown, NO explanations

OUTPUT FORMAT (exactly):
{"keywords": ["keyword1", "keyword2", ...], "matched": ["matched1", ...], "missing": ["missing1", ...], "jobTitle": "Job Title Here", "companyName": "Company Name or empty string", "matchScore": <number>, "matchTotal": <number>}

EXAMPLE:
{"keywords": ["Python", "AWS", "Docker", "PostgreSQL"], "matched": ["Python", "Docker"], "missing": ["AWS", "PostgreSQL"], "jobTitle": "Backend Engineer", "companyName": "TechCorp", "matchScore": 2, "matchTotal": 4}

Respond with ONLY the JSON object. Nothing else.`;

      const userMessage = `JOB POSTING:\n${store.jobPosting}\n\n---\n\nMY RESUME:\n${store.masterResume}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerStore.currentProvider,
          model: extractionModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const raw = data.content ?? data.message?.content ?? '';

      // Remove markdown code blocks if present
      let jsonStr = raw.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }
      jsonStr = jsonStr.trim();

      // Extract JSON if it's wrapped in text (common with Grok)
      if (!jsonStr.startsWith('{')) {
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      if (!jsonStr.startsWith('{')) {
        throw new Error('API response does not contain valid JSON. Response: ' + raw.substring(0, 200));
      }

      const result = JSON.parse(jsonStr);

      // Validate response has required fields
      if (!result.keywords || !Array.isArray(result.keywords)) {
        throw new Error('Invalid response format: missing keywords array');
      }

      store.setKeywordResult(result);
      store.setStage(1);
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Analysis failed';

      // Provide more helpful error messages
      if (message.includes('Unexpected token')) {
        message = 'API returned invalid JSON. Please try again or switch models.';
      } else if (message.includes('JSON')) {
        message = 'Failed to parse API response. Please check your model configuration.';
      }

      store.setError(message);
      setLocalError(message);
      console.error('Resume Tailor analysis error:', err);
    } finally {
      store.setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-100 mb-4">
          Paste Your Resume & Job Posting
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          I'll analyze the job posting, extract keywords, and show you how many match your resume.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resume Input */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed transition-colors ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-zinc-700 hover:border-zinc-600'
          } p-4`}
        >
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Your Master Resume
          </label>
          <Textarea
            value={store.masterResume}
            onChange={(e) => store.setMasterResume(e.target.value)}
            placeholder="Paste your resume here or drag & drop a .txt/.pdf file..."
            className="min-h-64 resize-none"
          />
          <p className="text-xs text-zinc-500 mt-2">
            {store.masterResume.length} characters
            {isDragOver && ' • Drop to upload'}
          </p>
        </div>

        {/* Job Posting Input */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Job Posting
          </label>
          <Textarea
            value={store.jobPosting}
            onChange={(e) => store.setJobPosting(e.target.value)}
            placeholder="Paste the job description here..."
            className="min-h-64 resize-none"
          />
          <p className="text-xs text-zinc-500 mt-2">
            {store.jobPosting.length} characters
          </p>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-zinc-300">Model Selection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Analysis Model Dropdown */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Analysis Model (keyword extraction)
            </label>
            <select
              value={store.analysisModel}
              onChange={(e) => store.setAnalysisModel(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a1a1aa' d='M1 4l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                paddingRight: '28px',
              }}
            >
              <option value="">Default (Haiku for Anthropic)</option>
              {providers.map((provider) => (
                <optgroup key={provider.id} label={provider.name}>
                  {provider.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1">
              {store.analysisModel
                ? `Selected: ${providers.flatMap(p => p.models).find(m => m.id === store.analysisModel)?.name || store.analysisModel}`
                : 'Will use Haiku for faster keyword extraction'}
            </p>
          </div>

          {/* Tailor Model Dropdown */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Tailor Model (resume & cover letter)
            </label>
            <select
              value={store.tailorModel}
              onChange={(e) => store.setTailorModel(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a1a1aa' d='M1 4l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                paddingRight: '28px',
              }}
            >
              <option value="">Current Model ({providerStore.currentModel})</option>
              {providers.map((provider) => (
                <optgroup key={provider.id} label={provider.name}>
                  {provider.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1">
              {store.tailorModel
                ? `Selected: ${providers.flatMap(p => p.models).find(m => m.id === store.tailorModel)?.name || store.tailorModel}`
                : `Using: ${providerStore.currentModel}`}
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleAnalyze}
          disabled={!canAnalyze || store.isLoading}
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {store.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Analyzing...
            </>
          ) : (
            'Analyze Job Posting →'
          )}
        </Button>
      </div>
    </div>
  );
}
