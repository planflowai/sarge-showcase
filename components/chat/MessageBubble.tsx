"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Copy, Check, Zap, Clock, Brain, AlertTriangle, KeyRound, Settings, XCircle, Database, Wrench, Share2 } from "lucide-react";
import type { ChatColumn } from "@/lib/stores/parallelChatStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useKnowledgeStore } from "@/lib/stores/knowledgeStore";
import { useBuilderChatStore } from "@/lib/stores/builderChatStore";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { ProviderBadge } from "@/components/providers/ProviderBadge";
import { providers } from "@/lib/providers";
import { getOllamaFriendlyName } from "@/lib/ollamaModelGroups";
import { Button } from "@/components/ui/button";
import type { Message } from "@/lib/types";
import Link from "next/link";

interface MessageBubbleProps {
  message: Message;
  // Parallel mode props (optional)
  parallelMode?: boolean;
  columnId?: string;
  otherColumns?: ChatColumn[];
  onShare?: (message: Message, targetColumnId: string) => void;
  onShareToAll?: (message: Message) => void;
}

// Helper to extract BUILDER_PROMPT blocks from content
function extractBuilderPrompts(content: string): string[] {
  const regex = /```BUILDER_PROMPT\s*\n([\s\S]*?)```/g;
  const prompts: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    prompts.push(match[1].trim());
  }
  return prompts;
}

export function MessageBubble({
  message,
  parallelMode = false,
  columnId,
  otherColumns = [],
  onShare,
  onShareToAll
}: MessageBubbleProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sentToBuilder, setSentToBuilder] = useState(false);
  const [shared, setShared] = useState(false);
  const addDocument = useKnowledgeStore((s) => s.addDocument);
  const setPrefilledInput = useBuilderChatStore((s) => s.setPrefilledInput);
  const isUser = message.role === "user";
  const providerConfig = message.provider
    ? providers.find((p) => p.id === message.provider)
    : undefined;

  // Extract BUILDER_PROMPT blocks from assistant messages
  const builderPrompts = useMemo(() => {
    if (isUser) return [];
    return extractBuilderPrompts(message.content);
  }, [isUser, message.content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToMemory = () => {
    const preview = message.content.slice(0, 50).replace(/\n/g, " ");
    const label = providerConfig
      ? `${providerConfig.name}${message.model ? ` · ${message.model}` : ""} | ${preview}...`
      : `Chat | ${preview}...`;
    addDocument(label, message.content, ["saved-from-chat"]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSendToBuilder = () => {
    if (builderPrompts.length === 0) return;
    // Join multiple prompts with separators if there are multiple
    const promptContent = builderPrompts.join("\n\n---\n\n");
    setPrefilledInput(promptContent);
    setSentToBuilder(true);
    setTimeout(() => setSentToBuilder(false), 2000);
    router.push("/builder");
  };

  // Show friendly model name in the badge (look up display name, not raw ID)
  const modelDisplayName = providerConfig && message.model
    ? message.provider === "ollama"
      ? getOllamaFriendlyName(message.model)
      : providerConfig.models.find((m) => m.id === message.model)?.name
    : undefined;
  const badgeName = modelDisplayName
    ? `${providerConfig!.name} · ${modelDisplayName}`
    : providerConfig?.name ?? "";

  // Calculate tokens per second
  const tokensPerSec =
    message.tokenCount && message.latencyMs && message.latencyMs > 0
      ? (message.tokenCount / (message.latencyMs / 1000)).toFixed(1)
      : null;

  const latencySec =
    message.latencyMs != null ? (message.latencyMs / 1000).toFixed(1) : null;

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      // If it has a language class or is multiline, render as CodeBlock
      if (match || codeString.includes("\n")) {
        return <CodeBlock code={codeString} language={match?.[1]} />;
      }
      // Inline code
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children }) {
      // Let the code component handle rendering
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
      className={cn(
        "group flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      {/* Provider badge for assistant messages */}
      {!isUser && providerConfig && (
        <ProviderBadge
          id={providerConfig.id}
          name={badgeName}
          color={providerConfig.color}
        />
      )}

      {/* Vault attachment indicator - shows when message had vault context */}
      {isUser && message.vaultAttachments && message.vaultAttachments.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 px-3 py-1.5 text-xs text-indigo-800 dark:text-indigo-200">
          <Database className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
          <span>
            <span className="font-medium">Vault:</span>{" "}
            {message.vaultAttachments.map((v, i) => (
              <span key={v.id}>
                {v.name}
                {v.truncated && <span className="text-amber-500"> (truncated)</span>}
                {i < message.vaultAttachments!.length - 1 && ", "}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Fallback indicator - shows when a different model was used */}
      {!isUser && message.fallback && (
        <div className="flex items-center gap-2 rounded-md bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            <span className="font-medium">Fallback:</span> Requested{" "}
            <span className="font-mono">{message.fallback.originalModel}</span> → Used{" "}
            <span className="font-mono">{message.fallback.fallbackModel}</span>
            {message.fallback.attempts > 1 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                ({message.fallback.attempts} attempts)
              </span>
            )}
          </span>
        </div>
      )}

      {/* Error card - special styling for error messages */}
      {message.isError ? (
        <div className="w-full rounded-lg border border-red-500/50 bg-red-950/30 overflow-hidden">
          {/* Error header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/40 border-b border-red-500/30">
            {message.errorCode === "MISSING_API_KEY" ? (
              <KeyRound className="h-4 w-4 text-red-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
            <span className="font-medium text-red-300 text-sm">
              {message.errorCode === "MISSING_API_KEY" ? "Missing API Key" : "Error"}
            </span>
          </div>
          {/* Error content */}
          <div className="px-4 py-3">
            <p className="text-red-200 text-sm leading-relaxed">{message.content}</p>
            {message.errorCode === "MISSING_API_KEY" && (
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Open Settings
                </Link>
              </div>
            )}
          </div>
          {/* Timestamp */}
          <div className="px-4 pb-2 text-[10px] text-red-400/60">
            {formatDate(message.timestamp)}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "rounded-lg px-5 py-4 overflow-hidden break-words",
            isUser
              ? "bg-indigo-600 text-white max-w-[85%]"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 w-full"
          )}
        >
          {/* Images if present - show thumbnails */}
          {(message.imageUrl || (message.imageUrls && message.imageUrls.length > 0)) && (
            <div className="mb-3">
              <div className={cn(
                "flex flex-wrap gap-2",
                isUser ? "justify-end" : "justify-start"
              )}>
                {/* Show all images as thumbnails */}
                {(message.imageUrls || (message.imageUrl ? [message.imageUrl] : [])).map((url, idx) => (
                  <div key={idx} className="relative group/img">
                    <img
                      src={url}
                      alt={`Attached image ${idx + 1}`}
                      className={cn(
                        "rounded-lg object-cover cursor-pointer transition-transform hover:scale-105",
                        "max-h-32 max-w-[200px]",
                        isUser ? "border border-indigo-400/30" : "border border-zinc-300 dark:border-zinc-600"
                      )}
                      loading="lazy"
                      onClick={() => window.open(url, '_blank')}
                      title="Click to view full size"
                    />
                    <div className="absolute inset-0 rounded-lg bg-black/0 group-hover/img:bg-black/10 transition-colors pointer-events-none" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Markdown content (skip if image-only message with no text) */}
          {message.content && !(message.imageUrl && !message.content.trim()) && (
            <div
              className={cn(
                "prose prose-base max-w-none break-words overflow-x-auto",
                isUser
                  ? "prose-invert prose-p:text-white prose-strong:text-white prose-code:text-indigo-200"
                  : "dark:prose-invert prose-p:text-zinc-800 dark:prose-p:text-zinc-200 prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100 prose-code:text-zinc-600 dark:prose-code:text-zinc-300"
              )}
            >
              <ReactMarkdown components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Timestamp */}
          <div
            className={cn(
              "mt-2 text-[10px]",
              isUser ? "text-indigo-200" : "text-zinc-500"
            )}
          >
            {formatDate(message.timestamp)}
          </div>
        </div>
      )}

      {/* Footer below bubble: stats + copy (hide for error messages) */}
      {!message.isError && (
        <div
          className={cn(
            "flex items-center gap-3 px-1 text-xs text-zinc-500",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* Token stats for assistant messages */}
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
          {!isUser && latencySec && (
            <span>{latencySec}s</span>
          )}

          {/* Copy button */}
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

          {/* Save to Memory button (assistant only) */}
          {!isUser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveToMemory}
              className="h-7 gap-1 px-2 text-xs text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-emerald-400"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved
                </>
              ) : (
                <>
                  <Brain className="h-3.5 w-3.5" /> Memory
                </>
              )}
            </Button>
          )}

          {/* Share to Other Column button (parallel mode, assistant only) */}
          {!isUser && parallelMode && otherColumns.length > 0 && onShare && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-amber-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-amber-400 hover:bg-amber-500/10"
                >
                  {shared ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Shared
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {/* Share to All option */}
                {onShareToAll && otherColumns.length > 1 && (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        onShareToAll(message);
                        setShared(true);
                        setTimeout(() => setShared(false), 2000);
                      }}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400"
                    >
                      <span className="w-2 h-2 rounded-full mr-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
                      Share to All ({otherColumns.length} panes)
                    </DropdownMenuItem>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                  </>
                )}
                {otherColumns.map(col => (
                  <DropdownMenuItem
                    key={col.id}
                    onClick={() => {
                      onShare(message, col.id);
                      setShared(true);
                      setTimeout(() => setShared(false), 2000);
                    }}
                    className="text-xs"
                  >
                    <span
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: providers.find(p => p.id === col.provider)?.color || "#888" }}
                    />
                    {providers.find(p => p.id === col.provider)?.name}: {col.model.split("-")[0]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Send to Builder button (assistant only, when BUILDER_PROMPT is present) */}
          {!isUser && builderPrompts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSendToBuilder}
              className="h-7 gap-1 px-2 text-xs text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-400 hover:bg-indigo-500/10"
            >
              {sentToBuilder ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Sent
                </>
              ) : (
                <>
                  <Wrench className="h-3.5 w-3.5" /> Send to Builder
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
