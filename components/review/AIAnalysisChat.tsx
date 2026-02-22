"use client";

import { useState } from "react";
import type { BatchHistoryEntry } from "@/lib/stores/testModeStore";
import { Send } from "lucide-react";
import { getAnalysisPrompts } from "@/lib/review/analysisPrompts";

interface AIAnalysisChatProps {
  selectedBatch: BatchHistoryEntry;
  allBatches: BatchHistoryEntry[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIAnalysisChat({ selectedBatch, allBatches }: AIAnalysisChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAnalyzing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAnalyzing(true);

    try {
      // Build context for the AI
      const prompts = getAnalysisPrompts();
      const batchContext = buildBatchContext(selectedBatch);
      const systemPrompt = `${prompts.base}\n\n${batchContext}`;

      // Call AI API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
        }),
      });

      const data = await res.json();
      const assistantMessage = data.response || 'Error: No response from AI';

      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error analyzing batch. Please try again.' },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      {/* Compact Header */}
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">🤖 AI Chat</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{messages.length} messages</span>
      </div>

      {/* Compact Messages */}
      <div className="h-40 overflow-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 py-4">
            <p className="mb-2">Ask about this batch</p>
            <div className="flex flex-wrap justify-center gap-1">
              <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800">"Why did it fail?"</span>
              <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800">"Best agent?"</span>
              <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800">"Compare batches"</span>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))
        )}

        {isAnalyzing && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="animate-spin h-3 w-3 border-2 border-violet-600 border-t-transparent rounded-full" />
                Analyzing...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact Input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this batch..."
            disabled={isAnalyzing}
            className="flex-1 px-3 py-1.5 rounded text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-1 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAnalyzing}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-all flex items-center gap-1"
          >
            <Send className="h-3 w-3" />
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}

// Helper function to build batch context for AI
function buildBatchContext(batch: BatchHistoryEntry): string {
  const pass3 = batch.passLogs.find(p => p.pass === 'pass3-pill-prompt');
  const pass2 = batch.passLogs.find(p => p.pass === 'pass2-pill');

  if (!pass3) return 'No batch data available.';

  const context = `
CURRENT BATCH DATA:
===================
Batch ID: ${batch.batchId}
Source: ${batch.source.toUpperCase()}
Date: ${new Date(batch.savedAt).toLocaleString()}
Total Tests: ${batch.testCount}

PASS 3 (PROTECTED) RESULTS:
- Catch Rate: ${pass3.summary.catchRate}%
- Tests Caught: ${pass3.summary.caughtTotal}/${pass3.summary.totalTests}
- Total Echoes: ${pass3.summary.echoTotal}
- Average Echoes/Test: ${pass3.summary.avgEchoesPerTest}

${pass2 ? `PASS 2 (NO PROTECTION) RESULTS:
- Catch Rate: ${pass2.summary.catchRate}%
- Tests Caught: ${pass2.summary.caughtTotal}/${pass2.summary.totalTests}
- Total Echoes: ${pass2.summary.echoTotal}
- Protection Improvement: ${pass3.summary.catchRate - pass2.summary.catchRate}%
` : ''}

TEST DETAILS:
${pass3.tests.slice(0, 5).map((test, idx) => `
Test #${idx + 1}:
- Question: "${test.question}"
- Poison: "${test.poison}"
- Injected: Round ${test.poisonRound} via ${test.poisonAgent?.toUpperCase() || 'N/A'}
- Echoes: ${test.echoCount || 0}
- Verdict: ${test.judgeResponse?.verdict?.toUpperCase() || 'PENDING'}
- Kill Round: ${(test.killRound ?? 0) > 0 ? `Round ${test.killRound} by ${test.killAgent?.toUpperCase() || 'N/A'}` : 'Not caught'}
`).join('\n')}

${pass3.tests.length > 5 ? `... and ${pass3.tests.length - 5} more tests` : ''}
  `.trim();

  return context;
}
