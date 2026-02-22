"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleRowProps {
  title: string;
  content: string;
  defaultExpanded?: boolean;
  highlight?: boolean;
  className?: string;
}

export function CollapsibleRow({
  title,
  content,
  defaultExpanded = false,
  highlight = false,
  className,
}: CollapsibleRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        highlight
          ? "border-indigo-500 bg-indigo-950/20 dark:bg-indigo-950/20"
          : "border-zinc-700 bg-zinc-900/50 dark:bg-zinc-900/50",
        className
      )}
    >
      <div className="flex w-full items-center justify-between gap-2 p-3 transition-colors hover:bg-zinc-800/50">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-zinc-400" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-400" />
          )}
          <span className="text-sm font-medium text-zinc-200 truncate">{title}</span>
        </button>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
          title="Copy content"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-zinc-700 p-4 max-h-96 overflow-y-auto">
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                h1: ({ children }) => <h1 className="mb-3 mt-4">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 mt-4">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-2 mt-3">{children}</h3>,
                ul: ({ children }) => <ul className="mb-3 space-y-1.5 pl-4">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 space-y-1.5 pl-4">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-zinc-600 pl-3 italic text-zinc-400">{children}</blockquote>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
