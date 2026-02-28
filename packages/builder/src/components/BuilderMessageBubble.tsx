"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Copy, Check, Zap, Clock, Brain, ChevronDown, ChevronRight } from "lucide-react";
import type { BuilderMessage } from "../stores/builderChatStore";
import ArtifactCard from "./ArtifactCard";
import StreamingMessageRenderer from "./StreamingMessageRenderer";
import EditProgressPanel from "./EditProgressPanel";
import { cn } from "@sarge/core";
import { formatDate } from "@sarge/core";
import { providers } from "@sarge/core";
import { getOllamaFriendlyName } from "@sarge/core";
import { Button } from "@/components/ui/button";
import { parseFileEditProposals, type FileEditProposal } from "@sarge/core";
import { extractSummaryFromResponse } from "../lib/builderLogger";
import { hasEditBlocks } from "../lib/editBlockParser";

/**
 * LiveStreamingContent: Renders streaming AI response in real-time
 *
 * Shows text before the code fence as plain text, then renders a live growing
 * code block with a pulsing "LIVE" indicator while code streams in.
 * Used ONLY when message.isStreaming === true — replaces ReactMarkdown which
 * struggles with partial/incomplete markdown.
 */
function LiveStreamingContent({ content }: { content: string }) {
  // Find first code fence
  const fenceIdx = content.indexOf("```");

  if (fenceIdx === -1) {
    // No code fence yet — pure text streaming
    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
        {content || " "}
        <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
      </div>
    );
  }

  const textBefore = content.slice(0, fenceIdx).trim();
  const rest = content.slice(fenceIdx);

  // Parse opening fence: ```lang\n
  const openFenceMatch = rest.match(/^```(\w*)?\n?/);
  const lang = openFenceMatch?.[1] || "html";
  const afterOpenFence = openFenceMatch ? rest.slice(openFenceMatch[0].length) : rest.slice(3);

  // Check for closing fence
  const closingFenceIdx = afterOpenFence.indexOf("```");
  const isComplete = closingFenceIdx !== -1;
  const codeText = isComplete ? afterOpenFence.slice(0, closingFenceIdx) : afterOpenFence;
  const textAfter = isComplete ? afterOpenFence.slice(closingFenceIdx + 3).trim() : "";

  const lineCount = codeText ? codeText.split("\n").length : 0;

  return (
    <div className="text-sm leading-relaxed space-y-2">
      {textBefore && (
        <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{textBefore}</p>
      )}

      {/* Live code block */}
      <div className="rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-white dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
              {lang}
            </span>
            {lineCount > 0 && (
              <span className="text-[10px] text-zinc-500">{lineCount} lines</span>
            )}
          </div>
          {!isComplete ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-400 tracking-wide">
                LIVE
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-emerald-500 font-medium">✓ Generated</span>
          )}
        </div>

        {/* Scrollable code — capped at 300px so it doesn't take over the chat */}
        <pre className="p-3 overflow-x-auto overflow-y-auto max-h-72 text-xs leading-relaxed font-mono text-zinc-800 dark:text-zinc-200">
          <code>{codeText}</code>
          {!isComplete && (
            <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
          )}
        </pre>
      </div>

      {textAfter && (
        <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{textAfter}</p>
      )}
    </div>
  );
}

/**
 * ThinkingBlock: Collapsible display for model reasoning/thinking tokens
 * Shows word count when collapsed, full thinking text when expanded
 */
function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const wordCount = thinking.split(/\s+/).length;

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-purple-500 hover:text-purple-400 transition-colors"
      >
        <Brain className={cn("h-3.5 w-3.5", isStreaming && "animate-pulse")} />
        <span className="font-medium">
          {isStreaming ? "Thinking..." : `Thought for ${wordCount} words`}
        </span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="mt-1.5 px-3 py-2 rounded-md bg-purple-500/5 border border-purple-500/10 text-xs text-purple-300/80 whitespace-pre-wrap max-h-60 overflow-y-auto">
          {thinking}
        </div>
      )}
    </div>
  );
}

interface BuilderMessageBubbleProps {
  message: BuilderMessage;
  onOpenInEditor?: (code: string, language?: string) => void;
  onOpenPreview?: (code: string) => void;
  projectPath?: string | null;
  projectName?: string | null;
  onViewDiff?: (filePath: string, originalContent: string, proposedContent: string) => void;
  onChangeTracked?: (change: {
    filePath: string;
    action: 'created' | 'modified' | 'rejected';
    summary: string;
    status: 'applied' | 'rejected';
  }) => void;
  autoApply?: boolean;
  onRefreshFileTree?: () => Promise<void>;
}

/**
 * BuilderMessageBubble: Render a single chat message
 *
 * Extracted from: BuilderChat.tsx (lines 76-445)
 * Responsibility:
 * - Display user or assistant message
 * - Show file action cards for project mode
 * - Show artifact cards for artifact mode
 * - Handle file apply/reject/diff operations
 * - Copy message button, token stats, timestamp
 *
 * No state management — pure component that receives data + callbacks
 */
export default function BuilderMessageBubble({
  message,
  onOpenInEditor,
  onOpenPreview,
  projectPath,
  projectName,
  onViewDiff,
  onChangeTracked,
  autoApply = false,
  onRefreshFileTree,
}: BuilderMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [fileProposals, setFileProposals] = useState<FileEditProposal[]>([]);
  const [originalContents, setOriginalContents] = useState<Record<string, string>>({});

  const isUser = message.role === "user";
  // Detect raw error messages — render as a friendly warning card instead of raw text
  const isError = !isUser && /^Error:/i.test(message.content.trim());
  const providerConfig = providers.find((p) => p.id === message.provider);
  const isProjectMode = !!projectPath;

  // Parse file edit proposals from assistant messages in project mode
  useEffect(() => {
    if (!isUser && isProjectMode && message.content && !message.isStreaming) {
      const proposals = parseFileEditProposals(message.content);
      setFileProposals(proposals);

      // Fetch original content for each file
      if (proposals.length > 0 && projectPath) {
        const fetchOriginals = async () => {
          const contents: Record<string, string> = {};
          for (const proposal of proposals) {
            try {
              const cleanRelativePath = proposal.filePath.replace(/^[\/\\]+/, '');
              const fullPath = `${projectPath}/${cleanRelativePath}`.replace(/\\/g, '/');
              console.log('[BuilderMessageBubble] Fetching original content for:', fullPath);

              const res = await fetch('/api/builder/read-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: fullPath, projectPath }),
              });

              if (res.ok) {
                const data = await res.json();
                contents[proposal.filePath] = data.content || "";
              } else {
                console.log('[BuilderMessageBubble] File not found (new file):', fullPath);
                contents[proposal.filePath] = "";
              }
            } catch (err) {
              console.log('[BuilderMessageBubble] Error reading file:', err);
              contents[proposal.filePath] = "";
            }
          }
          setOriginalContents(contents);
        };
        fetchOriginals();
      }
    }
  }, [message.content, message.isStreaming, isUser, isProjectMode, projectPath]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show friendly model name
  const modelDisplayName =
    providerConfig && message.model
      ? message.provider === "ollama"
        ? getOllamaFriendlyName(message.model)
        : providerConfig.models.find((m) => m.id === message.model)?.name || message.model
      : message.model;

  // Calculate tokens per second
  const tokensPerSec =
    message.tokenCount && message.latencyMs && message.latencyMs > 0
      ? (message.tokenCount / (message.latencyMs / 1000)).toFixed(1)
      : null;

  const latencySec =
    message.latencyMs != null ? (message.latencyMs / 1000).toFixed(1) : null;

  // Strip FILE: blocks from content when showing file proposals separately
  const getDisplayContent = () => {
    if (fileProposals.length === 0) return message.content;
    let content = message.content;
    const fileEditRegex = /FILE:\s*[^\n]+\n```(?:\w+)?\n[\s\S]*?```/g;
    content = content.replace(fileEditRegex, '').trim();
    return content;
  };

  // Handle apply for a file proposal
  const handleApplyFile = async (proposal: FileEditProposal) => {
    if (!projectPath) return;

    const cleanRelativePath = proposal.filePath.replace(/^[\/\\]+/, '');
    const fullPath = `${projectPath}/${cleanRelativePath}`.replace(/\\/g, '/');

    console.log('[BuilderMessageBubble] Writing file:', { projectPath, relativePath: proposal.filePath, fullPath });

    const res = await fetch('/api/builder/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fullPath, content: proposal.content, projectPath }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[BuilderMessageBubble] Write failed:', errorData);
      throw new Error(errorData.error || 'Failed to write file');
    }

    console.log('[BuilderMessageBubble] File written successfully:', fullPath);

    // Auto-append entry to BUILDER_LOG.md
    const isNewFile = !originalContents[proposal.filePath];
    const summary = extractSummaryFromResponse(message.content);
    const action = isNewFile ? 'created' : 'modified';

    // Track change in session history
    onChangeTracked?.({
      filePath: cleanRelativePath,
      action,
      summary,
      status: 'applied',
    });

    try {
      await fetch('/api/builder/update-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          projectName: projectName || 'Project',
          action: 'append',
          entry: {
            timestamp: new Date().toISOString(),
            filePath: cleanRelativePath,
            action,
            summary,
            model: message.model || 'unknown',
            provider: message.provider || 'unknown',
          },
        }),
      });
      console.log('[BuilderMessageBubble] Builder log updated');
    } catch (logErr) {
      console.warn('[BuilderMessageBubble] Failed to update builder log:', logErr);
    }

    // Refresh file tree so sidebar shows the new/updated file
    onRefreshFileTree?.().catch(() => {});
  };

  // Handle reject for a file proposal
  const handleRejectFile = (proposal: FileEditProposal) => {
    console.log(`Rejected changes to ${proposal.filePath}`);
    const summary = extractSummaryFromResponse(message.content);

    onChangeTracked?.({
      filePath: proposal.filePath,
      action: 'rejected',
      summary,
      status: 'rejected',
    });
  };

  // Handle view diff for a file proposal
  const handleViewDiff = (proposal: FileEditProposal) => {
    const originalContent = originalContents[proposal.filePath] || "";
    onViewDiff?.(proposal.filePath, originalContent, proposal.content);
  };

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      // Multi-line code blocks → send to artifact panel, show one-line summary in chat
      if (match || codeString.includes("\n")) {
        const lang = match?.[1] || "html";
        // Auto-open in editor/preview
        if (onOpenInEditor) onOpenInEditor(codeString, lang);
        if (onOpenPreview) onOpenPreview(codeString);
        // Show a minimal inline reference instead of a card
        const lineCount = codeString.split("\n").length;
        return (
          <div className="flex items-center gap-2 py-1 my-1 text-xs border-l-2 border-zinc-400 dark:border-zinc-600 pl-3">
            <span className="text-zinc-500 dark:text-zinc-400 font-mono">{lang}</span>
            <span className="text-emerald-500">+{lineCount} lines</span>
            <span className="text-zinc-500">→ preview</span>
          </div>
        );
      }
      return (
        <code className={cn("px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-sm font-mono", className)} {...props}>
          {children}
        </code>
      );
    },
    pre({ children }) {
      return <>{children}</>;
    },
    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
    h1: ({ children }) => <h1 className="mb-3 mt-4">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 mt-4">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-2 mt-3">{children}</h3>,
    ul: ({ children }) => <ul className="mb-3 space-y-1.5 pl-4">{children}</ul>,
    ol: ({ children }) => <ol className="mb-3 space-y-1.5 pl-4">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => <blockquote className="my-3 border-l-2 pl-3 italic opacity-80">{children}</blockquote>,
  };

  return (
    <div
      data-message-id={message.id}
      className={cn("group flex flex-col gap-1 transition-all duration-300", isUser ? "items-end" : "items-start")}
    >
      {/* Provider/model badge for assistant messages */}
      {!isUser && providerConfig && (
        <div className="flex items-center gap-1.5 px-1 text-[10px] text-zinc-500">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: providerConfig.color }} />
          <span>{providerConfig.name}</span>
          {modelDisplayName && (
            <>
              <span className="text-zinc-500 dark:text-zinc-400">·</span>
              <span>{modelDisplayName}</span>
            </>
          )}
        </div>
      )}

      <div
        className={cn(
          "rounded-lg px-5 py-4 overflow-hidden break-words",
          isUser
            ? "bg-indigo-600 text-white max-w-[85%]"
            : isError
            ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200/80 dark:border-amber-500/20 text-zinc-800 dark:text-zinc-200 w-full"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 w-full"
        )}
      >
        {/* Thinking block for reasoning models (DeepSeek R1, etc.) */}
        {!isUser && message.thinking && (
          <ThinkingBlock thinking={message.thinking} isStreaming={message.isStreaming || false} />
        )}

        {/* User messages */}
        {isUser && message.content && <div className="text-sm leading-relaxed">{message.content}</div>}

        {/* User attached images */}
        {isUser && message.images && message.images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Attached ${i + 1}`}
                className="h-16 w-16 rounded-md object-cover border border-indigo-400/30 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => window.open(img, '_blank')}
              />
            ))}
          </div>
        )}

        {/* Generated image */}
        {!isUser && message.imageUrl && (
          <div className="mb-2">
            <img src={message.imageUrl} alt={message.content} className="max-w-full rounded-lg" loading="lazy" />
            <p className="mt-1 text-xs text-zinc-500 italic">{message.content}</p>
          </div>
        )}

        {/* Assistant messages */}
        {!isUser && !message.imageUrl && (
          projectPath ? (
            <StreamingMessageRenderer
              content={message.content}
              isStreaming={message.isStreaming || false}
              onOpenInEditor={onOpenInEditor}
              onOpenPreview={onOpenPreview}
              projectPath={projectPath}
              autoApply={autoApply}
              onApply={async (filePath, content) => {
                const proposal = fileProposals.find(p => p.filePath === filePath);
                if (proposal) {
                  await handleApplyFile(proposal);
                } else {
                  // Write as a new file even if not in fileProposals
                  // (StreamingMessageRenderer parsed it from a code block)
                  const ext = filePath.split('.').pop()?.toLowerCase() || 'html';
                  const langMap: Record<string, string> = { html: 'html', css: 'css', js: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript', json: 'json' };
                  await handleApplyFile({ filePath, content, language: langMap[ext] || 'plaintext' });
                }
              }}
              onReject={(filePath) => {
                const proposal = fileProposals.find(p => p.filePath === filePath);
                if (proposal) {
                  handleRejectFile(proposal);
                }
              }}
              onViewDiff={(filePath, content) => {
                const proposal = fileProposals.find(p => p.filePath === filePath);
                if (proposal) {
                  handleViewDiff(proposal);
                } else {
                  onOpenInEditor?.(content);
                }
              }}
            />
          ) : hasEditBlocks(message.content) ? (
            <EditProgressPanel
              content={message.content}
              isStreaming={message.isStreaming || false}
            />
          ) : message.isStreaming ? (
            // Live streaming view: show raw text + growing code block in real-time
            // Bypasses ReactMarkdown (which breaks on partial/incomplete markdown)
            <LiveStreamingContent content={message.content} />
          ) : isError ? (
            // Friendly error card — never show raw "Error: API error: 500" to the user
            <div className="flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0 mt-0.5">⚡</span>
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Couldn't reach the model.
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-1 leading-relaxed">
                  Check that Ollama is running, or switch to a cloud model in the selector above. Local and cloud models are both supported.
                </p>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
            </div>
          )
        )}

        {/* Timestamp */}
        {!message.isStreaming && (
          <div className={cn("mt-2 text-[10px]", isUser ? "text-indigo-200" : "text-zinc-500")}>
            {formatDate(message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp))}
          </div>
        )}
      </div>

      {/* Footer: stats + copy */}
      {!message.isStreaming && (
        <div
          className={cn(
            "flex items-center gap-3 px-1 text-xs text-zinc-500",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          {!isUser && message.tokenCount != null && message.tokenCount > 0 && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {message.tokenCount} tokens
            </span>
          )}
          {!isUser && tokensPerSec && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {tokensPerSec} tok/s
            </span>
          )}
          {!isUser && latencySec && <span>{latencySec}s</span>}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 gap-1 px-2 text-xs text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
