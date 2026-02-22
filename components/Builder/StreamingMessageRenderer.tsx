"use client";

import { useMemo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import EditCard from "./EditCard";
import { cn } from "@/lib/utils";

interface ParsedContent {
  explanationBefore: string;
  edits: {
    filePath: string;
    content: string;
    language: string;
    isNew: boolean;
    linesAdded: number;
    linesRemoved: number;
  }[];
  explanationAfter: string;
  isComplete: boolean;
}

// Parse streaming content to extract file edits and explanations
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

    const filePath = match[1].trim();
    const language = match[2] || "text";
    const code = match[3] || "";

    result.edits.push({
      filePath,
      content: code,
      language,
      isNew: !filePath.includes("/") || filePath.includes("new") || filePath.includes("create"),
      linesAdded: code.split("\n").length,
      linesRemoved: 0,
    });

    lastIndex = match.index + match[0].length;
  }

  if (hasFileEdits) {
    result.explanationAfter = content.substring(lastIndex).trim();
    result.isComplete = true;
    return result;
  }

  // More robust regex for code blocks - handles various formats:
  // ```language\n, ```language \n, ```\n, etc.
  // Using [\s\S] to match across lines, non-greedy
  const codeBlockRegex = /```(\w+)?[ \t]*[\r\n]+([\s\S]*?)```/g;
  lastIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Skip very small code blocks that are likely inline examples
    const code = match[2] || "";
    if (code.length < 50 && !code.includes("\n")) {
      continue; // Skip tiny inline-like code
    }

    // Capture explanation before this code block
    if (result.edits.length === 0) {
      result.explanationBefore = content.substring(lastIndex, match.index).trim();
    }

    const language = match[1] || "html";

    // Generate a pseudo file path based on language and content
    let ext = "html";
    if (language === "typescript" || language === "tsx" || language === "ts") ext = "tsx";
    else if (language === "javascript" || language === "jsx" || language === "js") ext = "jsx";
    else if (language === "css" || language === "scss" || language === "less") ext = "css";
    else if (language === "json") ext = "json";
    else if (language === "python" || language === "py") ext = "py";
    else if (language === "html" || language === "htm") ext = "html";

    // Try to infer a better filename from the content
    let filename = `artifact.${ext}`;
    if (code.includes("<!DOCTYPE html>") || code.includes("<html")) {
      filename = "index.html";
    } else if (code.includes("export default function") || code.includes("const Component")) {
      filename = "Component.tsx";
    } else if (code.match(/^:root\s*\{|^body\s*\{|^\*\s*\{|^html\s*\{/m)) {
      filename = "styles.css";
    }

    result.edits.push({
      filePath: filename,
      content: code,
      language,
      isNew: true,
      linesAdded: code.split("\n").length,
      linesRemoved: 0,
    });

    lastIndex = match.index + match[0].length;
  }

  if (result.edits.length > 0) {
    result.explanationAfter = content.substring(lastIndex).trim();
    result.isComplete = true;
  } else {
    // No code blocks yet - check if we're in the middle of streaming a code block
    // Match opening fence that hasn't been closed yet
    const openFenceMatch = content.match(/```(\w+)?[ \t]*[\r\n]+([\s\S]*)$/);
    if (openFenceMatch && !openFenceMatch[2].includes("```")) {
      // Streaming a code block - show as streaming edit
      const beforeFence = content.substring(0, content.lastIndexOf("```")).trim();
      result.explanationBefore = beforeFence;

      const lang = openFenceMatch[1] || "html";
      const code = openFenceMatch[2] || "";

      let ext = lang === "css" ? "css" : lang === "tsx" || lang === "typescript" ? "tsx" : "html";

      result.edits.push({
        filePath: `artifact.${ext}`,
        content: code,
        language: lang,
        isNew: true,
        linesAdded: code.split("\n").length,
        linesRemoved: 0,
      });
      result.isComplete = false;
    } else {
      // Just explanation text, no code blocks
      result.explanationBefore = content;
    }
  }

  return result;
}

interface StreamingMessageRendererProps {
  content: string;
  isStreaming: boolean;
  onOpenInEditor?: (code: string, language?: string) => void;
  onOpenPreview?: (code: string) => void;
  projectPath?: string | null;
  onApply?: (filePath: string, content: string) => Promise<void>;
  onReject?: (filePath: string) => void;
  onViewDiff?: (filePath: string, content: string) => void;
  autoApply?: boolean;  // Auto-apply file changes
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

  // Update edit statuses when streaming completes
  // Note: We use functional updates and don't include editStatuses in deps to avoid infinite loops
  useEffect(() => {
    if (!isStreaming && parsed.edits.length > 0) {
      setEditStatuses((prev) => {
        const newStatuses: Record<string, "streaming" | "pending" | "applied" | "rejected"> = { ...prev };
        let hasChanges = false;
        parsed.edits.forEach((edit) => {
          // Only set to pending if not already set to something else
          if (!prev[edit.filePath]) {
            newStatuses[edit.filePath] = "pending";
            hasChanges = true;
          }
        });
        return hasChanges ? newStatuses : prev;
      });
    }
  }, [isStreaming, parsed.edits]);

  // Set streaming status for current edits
  // Note: We use functional updates and don't include editStatuses in deps to avoid infinite loops
  useEffect(() => {
    if (isStreaming && parsed.edits.length > 0) {
      const lastEdit = parsed.edits[parsed.edits.length - 1];
      setEditStatuses((prev) => {
        // Only update if not already set or currently streaming
        if (!prev[lastEdit.filePath] || prev[lastEdit.filePath] === "streaming") {
          // Check if this would actually change anything
          if (prev[lastEdit.filePath] === "streaming") {
            return prev; // No change needed
          }
          return {
            ...prev,
            [lastEdit.filePath]: "streaming",
          };
        }
        return prev; // No change needed
      });
    }
  }, [isStreaming, parsed.edits]);

  const handleApply = async (edit: typeof parsed.edits[0]) => {
    if (onApply) {
      await onApply(edit.filePath, edit.content);
      setEditStatuses((prev) => ({ ...prev, [edit.filePath]: "applied" }));
    } else if (onOpenPreview) {
      // Non-project mode - just open in preview
      onOpenPreview(edit.content);
      setEditStatuses((prev) => ({ ...prev, [edit.filePath]: "applied" }));
    }
  };

  const handleReject = (edit: typeof parsed.edits[0]) => {
    setEditStatuses((prev) => ({ ...prev, [edit.filePath]: "rejected" }));
    onReject?.(edit.filePath);
  };

  // Simple markdown renderer for explanation text (no code blocks)
  // Code blocks are shown as EditCards, not inline
  const markdownComponents: Components = {
    code({ className, children, node, ...props }) {
      // Check if this is a block code (inside pre) or inline
      // If it's block code with substantial content, skip it (shown via EditCards)
      const isBlock = node?.position?.start?.line !== node?.position?.end?.line;
      const content = String(children || "");

      // If it's a multi-line code block, don't render - it's shown as an EditCard
      if (isBlock && content.includes("\n")) {
        return null;
      }

      // Inline code only
      return (
        <code className={cn("px-1.5 py-0.5 rounded bg-zinc-700 text-sm font-mono text-zinc-300", className)} {...props}>
          {children}
        </code>
      );
    },
    pre({ children }) {
      // Skip pre tags completely - we handle code blocks via EditCards
      return null;
    },
    p: ({ children }) => <p className="mb-2 leading-relaxed text-sm">{children}</p>,
    ul: ({ children }) => <ul className="mb-2 space-y-1 pl-4 text-sm list-disc">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 space-y-1 pl-4 text-sm list-decimal">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  };

  // If no edits detected and not streaming, maybe the parsing failed
  // Try a simpler detection and create edit cards from any code blocks found
  if (parsed.edits.length === 0 && !isStreaming) {
    // Check if there are code blocks we missed
    const simpleCodeBlockRegex = /```(\w*)\s*([\s\S]*?)```/g;
    const foundBlocks: typeof parsed.edits = [];
    let simpleMatch;
    let textParts: string[] = [];
    let lastEnd = 0;

    while ((simpleMatch = simpleCodeBlockRegex.exec(content)) !== null) {
      // Get text before this code block
      if (simpleMatch.index > lastEnd) {
        textParts.push(content.substring(lastEnd, simpleMatch.index));
      }
      lastEnd = simpleMatch.index + simpleMatch[0].length;

      const lang = simpleMatch[1] || "html";
      const code = simpleMatch[2]?.trim() || "";

      // Only count as a code block if it has substantial content
      if (code.length > 30 || code.includes("\n")) {
        let ext = "html";
        if (lang === "css" || lang === "scss") ext = "css";
        else if (lang === "tsx" || lang === "typescript" || lang === "ts") ext = "tsx";
        else if (lang === "jsx" || lang === "javascript" || lang === "js") ext = "jsx";
        else if (lang === "json") ext = "json";

        let filename = `artifact.${ext}`;
        if (code.includes("<!DOCTYPE") || code.includes("<html")) filename = "index.html";
        else if (code.match(/^:root|^body\s*\{|^\*\s*\{/m)) filename = "styles.css";

        foundBlocks.push({
          filePath: filename,
          content: code,
          language: lang,
          isNew: true,
          linesAdded: code.split("\n").length,
          linesRemoved: 0,
        });
      }
    }

    // Get remaining text after last code block
    if (lastEnd < content.length) {
      textParts.push(content.substring(lastEnd));
    }

    // If we found code blocks with the simple regex, show them as edit cards
    if (foundBlocks.length > 0) {
      const explanationText = textParts.join("").trim();
      return (
        <div className="space-y-3">
          {explanationText && (
            <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
              <ReactMarkdown components={markdownComponents}>
                {explanationText}
              </ReactMarkdown>
            </div>
          )}
          {foundBlocks.map((edit, idx) => (
            <EditCard
              key={`fallback-${edit.filePath}-${idx}`}
              filePath={edit.filePath}
              isNew={true}
              isStreaming={false}
              linesAdded={edit.linesAdded}
              linesRemoved={0}
              status="pending"
              onApply={() => handleApply(edit)}
              onReject={() => handleReject(edit)}
              onViewDiff={() => onViewDiff?.(edit.filePath, edit.content)}
              summary={`${edit.linesAdded} lines of ${edit.language}`}
              autoApply={autoApply}
            />
          ))}
        </div>
      );
    }

    // No code blocks at all - just show text
    return (
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Explanation before edits */}
      {parsed.explanationBefore && (
        <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
          <ReactMarkdown components={markdownComponents}>
            {parsed.explanationBefore}
          </ReactMarkdown>
        </div>
      )}

      {/* Edit cards */}
      {parsed.edits.map((edit, idx) => (
        <EditCard
          key={`${edit.filePath}-${idx}`}
          filePath={edit.filePath}
          isNew={edit.isNew}
          isStreaming={isStreaming && idx === parsed.edits.length - 1 && !parsed.isComplete}
          linesAdded={edit.linesAdded}
          linesRemoved={edit.linesRemoved}
          status={editStatuses[edit.filePath] || (isStreaming ? "streaming" : "pending")}
          onApply={() => handleApply(edit)}
          onReject={() => handleReject(edit)}
          onViewDiff={() => onViewDiff?.(edit.filePath, edit.content)}
          summary={edit.content.length > 0 ? `${edit.content.split("\n").length} lines of ${edit.language}` : undefined}
          autoApply={autoApply}
        />
      ))}

      {/* Explanation after edits */}
      {parsed.explanationAfter && (
        <div className="prose prose-sm prose-invert max-w-none text-zinc-300 mt-3">
          <ReactMarkdown components={markdownComponents}>
            {parsed.explanationAfter}
          </ReactMarkdown>
        </div>
      )}

      {/* Streaming indicator when no code yet */}
      {isStreaming && parsed.edits.length === 0 && !parsed.explanationBefore && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: "300ms" }} />
          </span>
          <span className="text-xs text-zinc-500">Thinking...</span>
        </div>
      )}
    </div>
  );
}
