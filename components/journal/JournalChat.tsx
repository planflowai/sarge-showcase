"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useJournalStore, JournalChatMessage } from "@/lib/stores/journalStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useRoleStore } from "@/lib/stores/roleStore";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Plus, Trash2, MessageSquare, ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface JournalChatProps {
  onBack: () => void;
}

export function JournalChat({ onBack }: JournalChatProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Journal store - use raw state values, not getter functions
  const conversationsRaw = useJournalStore((s) => s.conversations);
  const activeConversationId = useJournalStore((s) => s.activeConversationId);
  const createConversation = useJournalStore((s) => s.createConversation);
  const addMessageToConversation = useJournalStore((s) => s.addMessageToConversation);
  const setActiveConversation = useJournalStore((s) => s.setActiveConversation);
  const deleteConversation = useJournalStore((s) => s.deleteConversation);
  const currentDraft = useJournalStore((s) => s.currentDraft);
  const entries = useJournalStore((s) => s.entries);

  // Compute derived values with useMemo to avoid infinite loops
  const conversations = useMemo(() => {
    return [...conversationsRaw].reverse(); // Most recent first
  }, [conversationsRaw]);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return undefined;
    return conversationsRaw.find((c) => c.id === activeConversationId);
  }, [conversationsRaw, activeConversationId]);

  // Get today's entries
  const todayEntries = useMemo(() => {
    const today = new Date();
    return entries.filter((e) => {
      const entryDate = new Date(e.timestamp);
      return (
        entryDate.getFullYear() === today.getFullYear() &&
        entryDate.getMonth() === today.getMonth() &&
        entryDate.getDate() === today.getDate()
      );
    });
  }, [entries]);

  // Context data
  const batchHistory = useTestModeStore((s) => s.batchHistory);
  const debateLogic = useTestModeStore((s) => s.debateLogic);
  const roles = useRoleStore((s) => s.roles);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversation?.id]);

  const handleNewChat = () => {
    createConversation();
    setShowHistory(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setShowHistory(false);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this conversation?")) {
      deleteConversation(id);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let conversationId = activeConversation?.id;

    // Create new conversation if none active
    if (!conversationId) {
      conversationId = createConversation();
    }

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message
    addMessageToConversation(conversationId, {
      role: "user",
      content: userMessage,
    });

    try {
      // Gather context
      const last5Batches = batchHistory?.slice(-5) || [];

      const d1Role = roles.find((r) => r.id === "default-d1-responder");
      const d2Role = roles.find((r) => r.id === "default-d2-checker");
      const d3Role = roles.find((r) => r.id === "default-d3-verifier");
      const judgeRole = roles.find((r) => r.id === "default-judge");

      // Get current conversation for context
      const currentConv = useJournalStore.getState().getConversation(conversationId);
      const conversationHistory = currentConv?.messages || [];

      // Call chat API
      const response = await fetch("/api/journal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversationHistory.slice(-10), // Last 10 messages for context
          context: {
            journalEntries: todayEntries,
            currentDraft,
            batchLogs: last5Batches,
            prompts: {
              d1: d1Role?.systemPrompt || debateLogic?.d1Prompt,
              d2: d2Role?.systemPrompt || debateLogic?.d2Prompt,
              d3: d3Role?.systemPrompt || debateLogic?.d3Prompt,
              judge: judgeRole?.systemPrompt || debateLogic?.judgePrompt,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      // Add assistant message
      addMessageToConversation(conversationId, {
        role: "assistant",
        content: data.response,
        provider: data.provider,
      });
    } catch (error) {
      console.error("Chat error:", error);
      addMessageToConversation(conversationId, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please check if Ollama is running or try again.",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // History view
  if (showHistory) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowHistory(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Chat History
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-colors",
                    activeConversation?.id === conv.id
                      ? "bg-teal-50 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700"
                      : "bg-white dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {conv.title}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {conv.messages.length} messages · {formatTime(conv.updatedAt)}
                      </p>
                      {conv.messages.length > 0 && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 truncate">
                          {conv.messages[conv.messages.length - 1].content.substring(0, 60)}...
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Journal Chat
            </h2>
            {activeConversation && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                ({activeConversation.messages.length} messages)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {conversations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowHistory(true)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                History ({conversations.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleNewChat}
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!activeConversation || activeConversation.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <MessageSquare className="h-10 w-10 text-teal-500/50 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Start a Conversation
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
              Ask questions about your batch results, prompts, or get help refining your approach.
              The AI has context from your journal entries and test logs.
            </p>
          </div>
        ) : (
          <>
            {activeConversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2",
                    msg.role === "user"
                      ? "bg-teal-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <div
                    className={cn(
                      "text-xs mt-1 opacity-70",
                      msg.role === "user" ? "text-right" : "text-left"
                    )}
                  >
                    {formatTime(msg.timestamp)}
                    {msg.provider && (
                      <span className="ml-1">
                        · {msg.provider === "ollama" ? "Local" : "Claude"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your batch results, prompts, or anything else..."
            rows={2}
            className={cn(
              "flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-700",
              "bg-white dark:bg-zinc-900 px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            )}
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-auto bg-teal-600 hover:bg-teal-700 text-white px-4"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
