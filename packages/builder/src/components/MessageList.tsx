"use client";

import { useRef, useEffect, useMemo } from "react";
import type { BuilderMessage } from "../stores/builderChatStore";
import BuilderMessageBubble from "./BuilderMessageBubble";

interface MessageListProps {
  messages: BuilderMessage[];
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
 * MessageList: Pure component to render messages with virtual scrolling capability
 *
 * Extracted from: BuilderChat.tsx (massive component)
 * Responsibility:
 * - Render each message as BuilderMessageBubble
 * - Auto-scroll to bottom
 * - Support for virtual scrolling (placeholder for future optimization)
 *
 * Props: Accept only data + simple callbacks, no complex state management
 */
export default function MessageList({
  messages,
  onOpenInEditor,
  onOpenPreview,
  projectPath,
  projectName,
  onViewDiff,
  onChangeTracked,
  autoApply = false,
  onRefreshFileTree,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };

    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  // Memoize rendered messages to prevent unnecessary re-renders
  const renderedMessages = useMemo(
    () =>
      messages.map((msg) => (
        <BuilderMessageBubble
          key={msg.id}
          message={msg}
          onOpenInEditor={onOpenInEditor}
          onOpenPreview={onOpenPreview}
          projectPath={projectPath}
          projectName={projectName}
          onViewDiff={onViewDiff}
          onChangeTracked={onChangeTracked}
          autoApply={autoApply}
          onRefreshFileTree={onRefreshFileTree}
        />
      )),
    [messages, onOpenInEditor, onOpenPreview, projectPath, projectName, onViewDiff, onChangeTracked, autoApply, onRefreshFileTree]
  );

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto space-y-4 p-4"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-zinc-500">
          <p>No messages yet. Start by describing what you want to build.</p>
        </div>
      ) : (
        renderedMessages
      )}
    </div>
  );
}
