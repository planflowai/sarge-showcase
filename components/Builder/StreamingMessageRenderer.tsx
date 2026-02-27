"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Check, X, Loader2, FileCode, FilePlus } from "lucide-react";
import { cn } from "@sarge/core";

/**
 * Infer a meaningful filename from code content instead of generic "artifact.html"
 */
function inferFilename(code: string, ext: string, language: string): string {
  if (ext === "html" || language === "html" || language === "htm") {
    if (code.includes("<!DOCTYPE html>") || code.includes("<html")) return "index.html";
    if (code.includes("<nav") || code.includes("navbar")) return "navbar.html";
    if (code.includes("<form") && (code.includes("login") || code.includes("sign"))) return "login.html";
    if (code.includes("<form")) return "form.html";
    if (code.includes("<footer")) return "footer.html";
    if (code.includes("<header")) return "header.html";
    return "index.html";
  }
  if (ext === "css" || language === "css" || language === "scss") {
    if (code.match(/^:root\s*\{|--[a-z]/m)) return "variables.css";
    if (code.match(/dark|theme|color-scheme/i)) return "theme.css";
    return "styles.css";
  }
  if (ext === "tsx" || ext === "ts" || language === "tsx" || language === "typescript") {
    const fnMatch = code.match(/export\s+default\s+function\s+(\w+)/);
    if (fnMatch) return `${fnMatch[1]}.tsx`;
    const constMatch = code.match(/(?:export\s+)?(?:const|function)\s+(\w+)/);
    if (constMatch && constMatch[1][0] === constMatch[1][0].toUpperCase()) return `${constMatch[1]}.tsx`;
    return "Component.tsx";
  }
  if (ext === "jsx" || ext === "js" || language === "javascript" || language === "jsx") {
    const fnMatch = code.match(/export\s+default\s+function\s+(\w+)/);
    if (fnMatch) return `${fnMatch[1]}.jsx`;
    if (code.includes("addEventListener") || code.includes("document.querySelector")) return "main.js";
    return "script.js";
  }
  if (ext === "json" || language === "json") {
    if (code.includes('"name"') && code.includes('"version"')) return "package.json";
    if (code.includes('"compilerOptions"')) return "tsconfig.json";
    return "data.json";
  }
  if (ext === "py" || language === "python") return "main.py";
  return `file.${ext}`;
}

interface ParsedEdit {
  filePath: string;
  content: string;
  language: string;
  isNew: boolean;
  lineCount: number;
}

interface ParsedContent {
  explanationBefore: string;
  edits: ParsedEdit[];
  explanationAfter: string;
  isComplete: boolean;
}

function parseStreamingContent(content: string): ParsedContent {
  const result: ParsedContent = {
    explanationBefore: "",
    edits: [],
    explanationAfter: "",
    isComplete: false,
  };

  if (!content) return result;

  // Check for FILE: path pattern (project mode)
  const fileEditRegex = /FILE:\s*([^\n]+)\n```(\w+)?[\r\n]+([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let hasFileEdits = false;

  while ((match = fileEditRegex.exec(content)) !== null) {
    hasFileEdits = true;
    if (result.edits.length === 0) {
      result.explanationBefore = content.substring(lastIndex, match.index).trim();
    }
    result.edits.push({
      filePath: match[1].trim(),
      content: match[3] || "",
      language: match[2] || "text",
      isNew: false,
      lineCount: (match[3] || "").split("\n").length,
    });
    lastIndex = match.index + match[0].length;
  }

  if (hasFileEdits) {
    result.explanationAfter = content.substring(lastIndex).trim();
    result.isComplete = true;
    return result;
  }

  // Generic code blocks
  const codeBlockRegex = /```(\w+)?[ \t]*[\r\n]+([\s\S]*?)```/g;
  lastIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const code = match[2] || "";
    if (code.length < 50 && !code.includes("\n")) continue;

    if (result.edits.length === 0) {
      result.explanationBefore = content.substring(lastIndex, match.index).trim();
    }

    const language = match[1] || "html";
    let ext = "html";
    if (language === "typescript" || language === "tsx" || language === "ts") ext = "tsx";
    else if (language === "javascript" || language === "jsx" || language === "js") ext = "jsx";
    else if (language === "css" || language === "scss" || language === "less") ext = "css";
    else if (language === "json") ext = "json";
    else if (language === "python" || language === "py") ext = "py";

    result.edits.push({
      filePath: inferFilename(code, ext, language),
      content: code,
      language,
      isNew: true,
      lineCount: code.split("\n").length,
    });
    lastIndex = match.index + match[0].length;
  }

  if (result.edits.length > 0) {
    result.explanationAfter = content.substring(lastIndex).trim();
    result.isComplete = true;
  } else {
    // Check for unclosed code block (still streaming)
    const openFenceMatch = content.match(/```(\w+)?[ \t]*[\r\n]+([\s\S]*)$/);
    if (openFenceMatch && !openFenceMatch[2].includes("```")) {
      result.explanationBefore = content.substring(0, content.lastIndexOf("```")).trim();
      const lang = openFenceMatch[1] || "html";
      const code = openFenceMatch[2] || "";
      let ext = lang === "css" ? "css" : lang === "tsx" || lang === "typescript" ? "tsx" : "html";

      result.edits.push({
        filePath: inferFilename(code, ext, lang),
        content: code,
        language: lang,
        isNew: true,
        lineCount: code.split("\n").length,
      });
      result.isComplete = false;
    } else {
      result.explanationBefore = content;
    }
  }

  return result;
}

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
  status: "streaming" | "pending" | "applied" | "rejected";
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
    <div className="flex items-center gap-2 py-1 text-sm">
      {/* Status icon */}
      {status === "streaming" ? (
        <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin flex-shrink-0" />
      ) : status === "applied" ? (
        <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
      ) : status === "rejected" ? (
        <X className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
      ) : edit.isNew ? (
        <FilePlus className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
      ) : (
        <FileCode className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
      )}

      {/* File name */}
      <span className={cn(
        "font-mono text-xs",
        status === "rejected" ? "text-zinc-500 line-through" : "text-zinc-200"
      )}>
        {edit.isNew ? "Create" : "Edit"}: {fileName}
      </span>

      {/* Line count */}
      <span className="text-[10px] text-emerald-500">+{edit.lineCount}</span>

      {/* Status label or actions */}
      {status === "streaming" && (
        <span className="text-[10px] text-blue-400 animate-pulse ml-auto">Writing...</span>
      )}
      {status === "applied" && (
        <span className="text-[10px] text-emerald-400 ml-auto">Applied</span>
      )}
      {status === "rejected" && (
        <span className="text-[10px] text-red-400 ml-auto">Rejected</span>
      )}
      {status === "pending" && (
        <span className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
          >
            {isApplying ? "Applying..." : "Apply"}
          </button>
          <button
            onClick={onReject}
            className="text-[10px] font-medium text-zinc-500 hover:text-red-400"
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
  const [editStatuses, setEditStatuses] = useState<Record<string, "streaming" | "pending" | "applied" | "rejected">>({});

  const parsed = useMemo(() => parseStreamingContent(content), [content]);

  // Update statuses when streaming completes
  useEffect(() => {
    if (!isStreaming && parsed.edits.length > 0) {
      setEditStatuses((prev) => {
        const next = { ...prev };
        let changed = false;
        parsed.edits.forEach((edit) => {
          if (!prev[edit.filePath]) {
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
      await onApply(edit.filePath, edit.content);
      setEditStatuses((prev) => ({ ...prev, [edit.filePath]: "applied" }));
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
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: "300ms" }} />
          </span>
          <span className="text-xs text-zinc-500">Thinking...</span>
        </div>
      )}
    </div>
  );
}
