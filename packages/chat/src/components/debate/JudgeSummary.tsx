"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, Download, Share2, RotateCcw, Maximize2, X } from "lucide-react";
import { cn } from "@sarge/core";

interface JudgeSummaryProps {
  summary: string;
  onCopy?: () => void;
  onExportPDF?: () => void;
  onSendToChat?: () => void;
  onSendToMultiChat?: () => void;
  onAnotherRound?: () => void;
  onClear?: () => void;
}

export function JudgeSummary({
  summary,
  onCopy,
  onExportPDF,
  onSendToChat,
  onSendToMultiChat,
  onAnotherRound,
  onClear,
}: JudgeSummaryProps) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch {
      /* ignore */
    }
  }, [summary, onCopy]);

  const content = (
    <div className="prose prose-invert max-w-none dark:prose-invert prose-headings:font-semibold prose-p:text-zinc-200">
      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold text-zinc-50 mt-4 mb-3" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-semibold text-zinc-100 mt-4 mb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold text-zinc-100 mt-3 mb-2" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-zinc-200 mb-3 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside text-zinc-200 mb-3 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol
              className="list-decimal list-inside text-zinc-200 mb-3 space-y-1"
              {...props}
            />
          ),
          li: ({ node, ...props }) => <li className="text-zinc-200" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-amber-500 pl-4 py-2 text-zinc-300 italic"
              {...props}
            />
          ),
          code: ({ node, inline, ...props }: any) =>
            inline ? (
              <code
                className="bg-zinc-800 px-2 py-1 rounded text-amber-300 text-sm"
                {...props}
              />
            ) : (
              <code className="block bg-zinc-800 p-3 rounded text-amber-300 text-sm mb-3 overflow-auto" {...props} />
            ),
        }}
      >
        {summary}
      </ReactMarkdown>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-sm z-50 overflow-auto">
        <div className="max-w-[95vw] mx-auto px-6 py-8">
          {/* Close button */}
          <button
            onClick={() => {
              onClear?.();
              setIsFullscreen(false);
            }}
            className="fixed top-4 right-4 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="mb-8">{content}</div>

          {/* Action buttons */}
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex-wrap justify-center">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold transition-colors"
                title="Export as PDF"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            )}
            {onSendToChat && (
              <button
                onClick={onSendToChat}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold transition-colors"
                title="Send to chat"
              >
                <Share2 className="w-4 h-4" />
                Send to Chat
              </button>
            )}
            {onSendToMultiChat && (
              <button
                onClick={onSendToMultiChat}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold transition-colors"
                title="Send to multi-chat"
              >
                <Share2 className="w-4 h-4" />
                Send to Multi-Chat
              </button>
            )}
            {onAnotherRound && (
              <button
                onClick={onAnotherRound}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
                title="Run another round"
              >
                <RotateCcw className="w-4 h-4" />
                Another Round
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Judge's Verdict
        </h2>
        <button
          onClick={() => setIsFullscreen(true)}
          className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-6 overflow-auto max-h-[60vh]">{content}</div>

      {/* Action buttons */}
      <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex gap-3 flex-wrap">
        <button
          onClick={handleCopy}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors",
            copied
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600"
          )}
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
        {onExportPDF && (
          <button
            onClick={onExportPDF}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-semibold transition-colors"
            title="Export as PDF"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        )}
        {onSendToChat && (
          <button
            onClick={onSendToChat}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-semibold transition-colors"
            title="Send to chat"
          >
            <Share2 className="w-4 h-4" />
            Send to Chat
          </button>
        )}
        {onSendToMultiChat && (
          <button
            onClick={onSendToMultiChat}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-semibold transition-colors"
            title="Send to multi-chat"
          >
            <Share2 className="w-4 h-4" />
            Send to Multi-Chat
          </button>
        )}
        {onAnotherRound && (
          <button
            onClick={onAnotherRound}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors ml-auto"
            title="Run another round"
          >
            <RotateCcw className="w-4 h-4" />
            Another Round
          </button>
        )}
        {onClear && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-semibold transition-colors"
            title="Close debate"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        )}
      </div>
    </div>
  );
}
