"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Copy, Check, Zap, Clock } from "lucide-react";
import type { BuilderMessage } from "@/lib/stores/builderChatStore";
import ArtifactCard from "@/components/Builder/ArtifactCard";
import StreamingMessageRenderer from "@/components/Builder/StreamingMessageRenderer";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { providers } from "@/lib/providers";
import { getOllamaFriendlyName } from "@/lib/ollamaModelGroups";
import { Button } from "@/components/ui/button";
import { parseFileEditProposals, type FileEditProposal } from "@/lib/contextInjector";
import { extractSummaryFromResponse } from "@/lib/builderLogger";

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
}: BuilderMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [fileProposals, setFileProposals] = useState<FileEditProposal[]>([]);
  const [originalContents, setOriginalContents] = useState<Record<string, string>>({});

  const isUser = message.role === "user";
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
      if (match || codeString.includes("\n")) {
        return (
          <ArtifactCard
            code={codeString}
            language={match?.[1]}
            onOpenCode={() => onOpenInEditor?.(codeString, match?.[1])}
            onOpenPreview={() => onOpenPreview?.(codeString)}
          />
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
              <span className="text-zinc-400">·</span>
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
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 w-full"
        )}
      >
        {/* User messages */}
        {isUser && message.content && <div className="text-sm leading-relaxed">{message.content}</div>}

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
                  onOpenPreview?.(content);
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
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
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
