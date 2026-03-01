"use client";

import ReactMarkdown from "react-markdown";
import { Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebateStore } from "@/lib/stores/debateStore";

interface ExecutiveSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: string;
  topic: string;
}

export function ExecutiveSummaryModal({
  open,
  onOpenChange,
  summary,
  topic,
}: ExecutiveSummaryModalProps) {
  const endDebate = useDebateStore((s) => s.endDebate);
  const [copied, setCopied] = useState(false);

  const handleCopySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [summary]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className="flex flex-col bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
        style={{
          maxWidth: "90vw",
          width: "90vw",
          maxHeight: "90vh",
          height: "90vh",
          padding: 0,
          gap: 0,
          display: "flex",
        }}
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-10 py-5 pr-14">
          <DialogTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Executive Summary
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
            {topic.length > 200 ? topic.slice(0, 200) + "..." : topic}
          </DialogDescription>
        </DialogHeader>

        {/* Content - Full width scrollable area */}
        <div className="flex-1 overflow-y-auto px-10 py-8 min-h-0">
          <div className="mx-auto max-w-5xl w-full">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-5 text-base leading-relaxed text-zinc-800 dark:text-zinc-200">{children}</p>,
                h1: ({ children }) => <h1 className="mb-5 mt-8 text-2xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-3">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-4 mt-7 text-xl font-bold text-zinc-900 dark:text-zinc-100">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-3 mt-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{children}</h3>,
                ul: ({ children }) => <ul className="mb-5 space-y-2 pl-6 list-disc text-base text-zinc-800 dark:text-zinc-200">{children}</ul>,
                ol: ({ children }) => <ol className="mb-5 space-y-2 pl-6 list-decimal text-base text-zinc-800 dark:text-zinc-200">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => <blockquote className="my-5 border-l-4 border-indigo-500 pl-5 italic text-zinc-700 dark:text-zinc-300">{children}</blockquote>,
                strong: ({ children }) => <strong className="font-bold text-zinc-900 dark:text-zinc-100">{children}</strong>,
                hr: () => <hr className="my-6 border-zinc-200 dark:border-zinc-800" />,
                code: ({ children }) => <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-sm font-mono text-zinc-800 dark:text-zinc-200">{children}</code>,
              }}
            >
              {summary}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer with Copy button */}
        <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 px-10 py-4 flex justify-end">
          <Button
            onClick={handleCopySummary}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 h-10 gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Summary"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
