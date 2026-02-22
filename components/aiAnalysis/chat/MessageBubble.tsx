"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Copy, Check, Zap, Clock } from "lucide-react";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { ProviderBadge } from "@/components/providers/ProviderBadge";
import { providers } from "@/lib/providers";
import { getOllamaFriendlyName } from "@/lib/ollamaModelGroups";
import { Button } from "@/components/ui/button";
import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const providerConfig = message.provider
    ? providers.find((p) => p.id === message.provider)
    : undefined;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show friendly model name in the badge
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

      <div
        className={cn(
          "rounded-lg px-5 py-4",
          isUser
            ? "bg-indigo-600 text-white max-w-[85%]"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 w-full"
        )}
      >
        {/* Markdown content */}
        <div
          className={cn(
            "prose prose-base max-w-none",
            isUser
              ? "prose-invert prose-p:text-white prose-strong:text-white prose-code:text-indigo-200"
              : "dark:prose-invert prose-p:text-zinc-800 dark:prose-p:text-zinc-200 prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100 prose-code:text-zinc-600 dark:prose-code:text-zinc-300"
          )}
        >
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>

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

      {/* Footer below bubble: stats + copy */}
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
      </div>
    </div>
  );
}
