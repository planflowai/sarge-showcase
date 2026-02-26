"use client";

import { useState } from "react";
import { Check, X, Loader2, Copy, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@sarge/core";
import { HelperResponse, HELPER_TYPES, HelperType } from "../stores/builderHelpersStore";

interface HelperBubbleProps {
  response: HelperResponse;
  helperType?: HelperType;
  onApply?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function HelperBubble({
  response,
  helperType = "reviewer",
  onApply,
  onDismiss,
  className,
}: HelperBubbleProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const typeInfo = HELPER_TYPES[helperType];

  // Color classes based on helper type
  const colorClasses: Record<string, { bg: string; border: string; header: string }> = {
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-500/5",
      border: "border-emerald-200 dark:border-emerald-500/30",
      header: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-500/5",
      border: "border-purple-200 dark:border-purple-500/30",
      header: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
    },
    pink: {
      bg: "bg-pink-50 dark:bg-pink-500/5",
      border: "border-pink-200 dark:border-pink-500/30",
      header: "bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-500/5",
      border: "border-orange-200 dark:border-orange-500/30",
      header: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-500/5",
      border: "border-blue-200 dark:border-blue-500/30",
      header: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
    },
  };

  const colors = colorClasses[typeInfo.color] || colorClasses.blue;

  const handleCopy = () => {
    navigator.clipboard.writeText(response.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        colors.bg,
        colors.border,
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 cursor-pointer",
          colors.header
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{response.helperIcon || typeInfo.icon}</span>
          <span className="text-xs font-medium">
            {response.helperName}
          </span>
          <span className="text-[10px] opacity-70">
            ({response.helperModel})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {response.status === "streaming" && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-3">
          {response.status === "pending" ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing...</span>
            </div>
          ) : response.status === "error" ? (
            <div className="text-sm text-red-600 dark:text-red-400">
              {response.content || "An error occurred"}
            </div>
          ) : (
            <>
              {/* Response content */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
                <ReactMarkdown
                  components={{
                    // Style code blocks
                    code: ({ children, className }) => {
                      const isInline = !className?.includes("language-");
                      return isInline ? (
                        <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded text-xs">
                          {children}
                        </code>
                      ) : (
                        <code className="block bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs overflow-x-auto">
                          {children}
                        </code>
                      );
                    },
                    // Style lists
                    ul: ({ children }) => (
                      <ul className="list-disc pl-4 space-y-1 text-sm">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-4 space-y-1 text-sm">{children}</ol>
                    ),
                    // Style headings
                    h1: ({ children }) => (
                      <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
                    ),
                    // Style paragraphs
                    p: ({ children }) => (
                      <p className="text-sm mb-2 last:mb-0">{children}</p>
                    ),
                    // Style strong/bold
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                  }}
                >
                  {response.content}
                </ReactMarkdown>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {onDismiss && (
                    <button
                      onClick={onDismiss}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <X className="h-3 w-3" />
                      Dismiss
                    </button>
                  )}
                  {onApply && (
                    <button
                      onClick={onApply}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                    >
                      <Check className="h-3 w-3" />
                      Apply Suggestions
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
