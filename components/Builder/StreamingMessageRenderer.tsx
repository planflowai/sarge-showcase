"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { parseStreamingContent, type ParsedEdit } from "@/lib/parseStreamingContent";

// ─── Simple inline file line (replaces EditCard) ───

function FileLine({
  edit,
  status,
  isStreaming,
  onApply,
  onReject,
  autoApply,
}: {
  edit: ParsedEdit;
  status: "streaming" | "pending" | "applied" | "rejected" | "error";
  isStreaming: boolean;
  onApply: () => Promise<void>;
  onReject: () => void;
  autoApply: boolean;
}) {
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = useCallback(async () => {
    setIsApplying(true);
    try {
      await onApply();
    } catch (err) {
      console.error('[StreamingMessageRenderer] Apply failed:', err);
    } finally {
      setIsApplying(false);
    }
  }, [onApply]);

  // Auto-apply
  useEffect(() => {
    if (autoApply && status === "pending" && !isApplying) {
      handleApply();
    }
  }, [autoApply, status, isApplying, handleApply]);

  const fileName = edit.filePath.split("/").pop() || edit.filePath;

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      {/* Forge status icon */}
      <div className="flex-shrink-0 w-[36px] h-[36px] flex items-center justify-center">
        {status === "streaming" ? (
          <div className="forge-hammer mini">
            <div className="hammer"><div className="head"></div><div className="handle"></div></div>
            <div className="anvil"></div>
            <div className="spark"></div><div className="spark"></div><div className="spark"></div>
            <div className="spark"></div><div className="spark"></div><div className="spark"></div>
            <div className="anvil-glow"></div>
          </div>
        ) : status === "applied" ? (
          <div className="forge-done mini">
            <div className="circle"><div className="check"></div></div>
            <div className="done-sparks">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
          </div>
        ) : status === "error" ? (
          <div className="forge-failed mini">
            <div className="circle"><div className="x-mark"></div></div>
            <div className="smoke">
              <div className="smoke-puff"></div>
              <div className="smoke-puff"></div>
              <div className="smoke-puff"></div>
            </div>
          </div>
        ) : status === "rejected" ? (
          <div className="forge-failed mini">
            <div className="circle"><div className="x-mark"></div></div>
            <div className="smoke">
              <div className="smoke-puff"></div>
              <div className="smoke-puff"></div>
              <div className="smoke-puff"></div>
            </div>
          </div>
        ) : (
          <div className="ember-ring mini">
            <div className="ring"></div>
            <div className="core"></div>
          </div>
        )}
      </div>

      {/* File name */}
      <span className={cn(
        "font-mono text-sm",
        status === "rejected" ? "text-zinc-500 line-through" : "text-zinc-200"
      )}>
        {edit.isNew ? "Create" : "Edit"}: {fileName}
      </span>

      {/* Line count */}
      <span className="text-xs" style={{ color: "#FF6700" }}>+{edit.lineCount}</span>

      {/* Status label or actions */}
      {status === "streaming" && isStreaming && (
        <span className="text-sm ml-auto" style={{ color: "#FF6700" }}>Forging...</span>
      )}
      {status === "streaming" && !isStreaming && (
        <span className="text-sm ml-auto" style={{ color: "#FF6700" }}>Forged ⚒️</span>
      )}
      {status === "applied" && (
        <span className="text-sm ml-auto" style={{ color: "#FF6700" }}>Forged ⚒️</span>
      )}
      {status === "rejected" && (
        <span className="text-sm text-red-400 ml-auto">Rejected</span>
      )}
      {status === "error" && (
        <span className="text-sm ml-auto" style={{ color: "#dc2626" }}>Cracked</span>
      )}
      {status === "pending" && (
        <span className="flex items-center gap-3 ml-auto">
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="text-xs font-semibold disabled:opacity-50"
            style={{ color: "#FF6700" }}
          >
            {isApplying ? "Forging..." : "Apply"}
          </button>
          <button
            onClick={onReject}
            className="text-xs font-semibold text-zinc-500 hover:text-red-400"
          >
            Reject
          </button>
        </span>
      )}
    </div>
  );
}

// ─── Main component ───

interface StreamingMessageRendererProps {
  content: string;
  isStreaming: boolean;
  onOpenInEditor?: (code: string, language?: string) => void;
  onOpenPreview?: (code: string) => void;
  projectPath?: string | null;
  onApply?: (filePath: string, content: string) => Promise<void>;
  onReject?: (filePath: string) => void;
  onViewDiff?: (filePath: string, content: string) => void;
  autoApply?: boolean;
}

export default function StreamingMessageRenderer({
  content,
  isStreaming,
  onOpenInEditor,
  onOpenPreview,
  projectPath,
  onApply,
  onReject,
  onViewDiff,
  autoApply = false,
}: StreamingMessageRendererProps) {
  const [editStatuses, setEditStatuses] = useState<Record<string, "streaming" | "pending" | "applied" | "rejected" | "error">>({});

  const parsed = useMemo(() => parseStreamingContent(content), [content]);

  // Update statuses when streaming completes
  useEffect(() => {
    if (!isStreaming && parsed.edits.length > 0) {
      setEditStatuses((prev) => {
        const next = { ...prev };
        let changed = false;
        parsed.edits.forEach((edit) => {
          if (!prev[edit.filePath] || prev[edit.filePath] === "streaming") {
            next[edit.filePath] = "pending";
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [isStreaming, parsed.edits]);

  // Set streaming status for current edit
  useEffect(() => {
    if (isStreaming && parsed.edits.length > 0) {
      const lastEdit = parsed.edits[parsed.edits.length - 1];
      setEditStatuses((prev) => {
        if (!prev[lastEdit.filePath] || prev[lastEdit.filePath] === "streaming") {
          if (prev[lastEdit.filePath] === "streaming") return prev;
          return { ...prev, [lastEdit.filePath]: "streaming" };
        }
        return prev;
      });
    }
  }, [isStreaming, parsed.edits]);

  const handleApply = async (edit: ParsedEdit) => {
    if (onApply) {
      try {
        await onApply(edit.filePath, edit.content);
        setEditStatuses((prev) => ({ ...prev, [edit.filePath]: "applied" }));
      } catch (err) {
        console.error('[StreamingMessageRenderer] File write failed:', edit.filePath, err);
        setEditStatuses((prev) => ({ ...prev, [edit.filePath]: "error" }));
      }
    } else if (onOpenPreview) {
      onOpenPreview(edit.content);
      setEditStatuses((prev) => ({ ...prev, [edit.filePath]: "applied" }));
    }
  };

  const handleReject = (edit: ParsedEdit) => {
    setEditStatuses((prev) => ({ ...prev, [edit.filePath]: "rejected" }));
    onReject?.(edit.filePath);
  };

  // Simple markdown components — no code block rendering (those are shown as file lines)
  const markdownComponents: Components = {
    code({ className, children, node, ...props }) {
      const isBlock = node?.position?.start?.line !== node?.position?.end?.line;
      const text = String(children || "");
      if (isBlock && text.includes("\n")) return null;
      return (
        <code className={cn("px-1.5 py-0.5 rounded bg-zinc-700 text-sm font-mono text-zinc-300", className)} {...props}>
          {children}
        </code>
      );
    },
    pre() { return null; },
    p: ({ children }) => <p className="mb-2 leading-relaxed text-sm">{children}</p>,
    ul: ({ children }) => <ul className="mb-2 space-y-1 pl-4 text-sm list-disc">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 space-y-1 pl-4 text-sm list-decimal">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  };

  // Deduplicate edits by filePath — only keep the latest version of each file
  const uniqueEdits = useMemo(() => {
    const seen = new Map<string, ParsedEdit>();
    for (const edit of parsed.edits) {
      seen.set(edit.filePath, edit); // later entries overwrite earlier ones
    }
    return Array.from(seen.values());
  }, [parsed.edits]);

  // No edits detected — just render markdown
  if (uniqueEdits.length === 0 && !isStreaming) {
    return (
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Explanation text */}
      {parsed.explanationBefore && (
        <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
          <ReactMarkdown components={markdownComponents}>
            {parsed.explanationBefore}
          </ReactMarkdown>
        </div>
      )}

      {/* File lines — clean, one per file */}
      {uniqueEdits.length > 0 && (
        <div className="border-l-2 border-zinc-700 pl-3 my-2">
          {uniqueEdits.map((edit, idx) => (
            <FileLine
              key={`${edit.filePath}-${idx}`}
              edit={edit}
              status={editStatuses[edit.filePath] || (isStreaming ? "streaming" : "pending")}
              isStreaming={isStreaming && idx === uniqueEdits.length - 1 && !parsed.isComplete}
              onApply={() => handleApply(edit)}
              onReject={() => handleReject(edit)}
              autoApply={autoApply}
            />
          ))}
        </div>
      )}

      {/* Summary text after edits */}
      {parsed.explanationAfter && (
        <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
          <ReactMarkdown components={markdownComponents}>
            {parsed.explanationAfter}
          </ReactMarkdown>
        </div>
      )}

      {/* Streaming indicator when no content yet */}
      {isStreaming && uniqueEdits.length === 0 && !parsed.explanationBefore && (
        <div className="flex items-center gap-3">
          <div className="ember-ring micro">
            <div className="ring"></div>
            <div className="core"></div>
          </div>
          <span className="text-xs" style={{ color: "#FF6700" }}>Stoking the forge...</span>
        </div>
      )}
    </div>
  );
}
