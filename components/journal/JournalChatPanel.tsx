"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useJournalStore, type JournalConversation } from "@/lib/stores/journalStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useRoleStore } from "@/lib/stores/roleStore";
import { useProviderStore } from "@/lib/stores/providerStore";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Plus, Trash2, MessageSquare, Check, X, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Parse prompt suggestions from assistant response
interface ParsedSuggestion {
  role: string;
  roleId: string;
  promptText: string;
}

function parsePromptSuggestions(content: string): ParsedSuggestion[] {
  const suggestions: ParsedSuggestion[] = [];

  // Pattern: ## Suggested Prompt Update: D2 or **Apply to D2:**
  const patterns = [
    /## Suggested Prompt Update: (D[1-3]|Judge)\s*\n```(?:\w+)?\n([\s\S]*?)```/g,
    /\*\*Apply to (D[1-3]|Judge):\*\*\s*\n```(?:\w+)?\n([\s\S]*?)```/g,
  ];

  const roleIdMap: Record<string, string> = {
    D1: "default-d1-responder",
    D2: "default-d2-checker",
    D3: "default-d3-verifier",
    Judge: "default-judge",
  };

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const role = match[1];
      const promptText = match[2].trim();

      // Avoid duplicates
      if (!suggestions.find(s => s.role === role && s.promptText === promptText)) {
        suggestions.push({
          role,
          roleId: roleIdMap[role] || "",
          promptText,
        });
      }
    }
  }

  return suggestions;
}

export function JournalChatPanel() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Provider store - use sidebar's model selection
  const currentProvider = useProviderStore((s) => s.currentProvider);
  const currentModel = useProviderStore((s) => s.currentModel);

  // Journal store - use raw state values
  const conversationsRaw = useJournalStore((s) => s.conversations);
  const activeConversationId = useJournalStore((s) => s.activeConversationId);
  const createConversation = useJournalStore((s) => s.createConversation);
  const addMessageToConversation = useJournalStore((s) => s.addMessageToConversation);
  const setActiveConversation = useJournalStore((s) => s.setActiveConversation);
  const deleteConversation = useJournalStore((s) => s.deleteConversation);
  const currentDraft = useJournalStore((s) => s.currentDraft);
  const entries = useJournalStore((s) => s.entries);
  const appendToJournal = useJournalStore((s) => s.appendToJournal);

  // Shared context from Analysis panel - Chat automatically sees what Analysis shows
  const sharedContext = useJournalStore((s) => s.sharedContext);
  const setLastSuggestion = useJournalStore((s) => s.setLastSuggestion);

  // Compute derived values
  const conversations = useMemo(() => {
    return [...conversationsRaw].reverse();
  }, [conversationsRaw]);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return undefined;
    return conversationsRaw.find((c) => c.id === activeConversationId);
  }, [conversationsRaw, activeConversationId]);

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
  const updateDebateLogic = useTestModeStore((s) => s.updateDebateLogic);
  const roles = useRoleStore((s) => s.roles);
  const updateRole = useRoleStore((s) => s.updateRole);

  // Toast state for Apply/Discard feedback
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "rejected" }>({
    visible: false,
    message: "",
    type: "success",
  });

  // Confirm dialog state for deletion
  const [conversationToDelete, setConversationToDelete] = useState<JournalConversation | null>(null);

  const showToast = (message: string, type: "success" | "rejected") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: "", type: "success" }), 3000);
  };

  // Format model string for API based on sidebar selection
  const apiModelString = useMemo(() => {
    if (currentProvider === "ollama") {
      return `ollama:${currentModel}`;
    }
    // For cloud providers (anthropic, openai, google, xai), just use model ID
    return currentModel;
  }, [currentProvider, currentModel]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversation?.id]);

  const handleNewChat = () => {
    createConversation();
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
  };

  const handleDeleteClick = (conv: JournalConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete(conv);
  };

  const handleDeleteConfirm = () => {
    if (conversationToDelete) {
      deleteConversation(conversationToDelete.id);
      setConversationToDelete(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let conversationId = activeConversation?.id;
    if (!conversationId) {
      conversationId = createConversation();
    }

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    addMessageToConversation(conversationId, {
      role: "user",
      content: userMessage,
    });

    try {
      const last5Batches = batchHistory?.slice(-5) || [];
      const d1Role = roles.find((r) => r.id === "default-d1-responder");
      const d2Role = roles.find((r) => r.id === "default-d2-checker");
      const d3Role = roles.find((r) => r.id === "default-d3-verifier");
      const judgeRole = roles.find((r) => r.id === "default-judge");

      const currentConv = useJournalStore.getState().getConversation(conversationId);
      const conversationHistory = currentConv?.messages || [];

      // Use shared context prompts if available, otherwise fall back to role store
      const prompts = {
        d1: sharedContext.currentPrompts.d1 || d1Role?.systemPrompt || debateLogic?.d1Prompt,
        d2: sharedContext.currentPrompts.d2 || d2Role?.systemPrompt || debateLogic?.d2Prompt,
        d3: sharedContext.currentPrompts.d3 || d3Role?.systemPrompt || debateLogic?.d3Prompt,
        judge: sharedContext.currentPrompts.judge || judgeRole?.systemPrompt || debateLogic?.judgePrompt,
      };

      const response = await fetch("/api/journal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          model: apiModelString,
          conversationHistory: conversationHistory.slice(-10),
          context: {
            journalEntries: todayEntries,
            currentDraft,
            batchLogs: last5Batches,
            // Use shared context analysis (from Analysis panel)
            currentAnalysis: sharedContext.currentAnalysis,
            currentAnalysisProvider: sharedContext.currentAnalysisProvider,
            selectedBatchLog: sharedContext.selectedBatchLog,
            prompts,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      addMessageToConversation(conversationId, {
        role: "assistant",
        content: data.response,
        provider: data.provider,
      });
    } catch (error) {
      console.error("Chat error:", error);
      addMessageToConversation(conversationId, {
        role: "assistant",
        content: "Error: Check if Ollama is running or try again.",
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

  // Apply prompt suggestion with confirmation
  const handleApplySuggestion = (suggestion: ParsedSuggestion) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Overwrite ${suggestion.role} prompt?\n\nThis will replace the current prompt and apply to the next test run.`
    );

    if (!confirmed) {
      return;
    }

    const role = roles.find((r) => r.id === suggestion.roleId);
    if (role) {
      updateRole(suggestion.roleId, role.name, suggestion.promptText);
    }

    // Also update debate logic
    const fieldMap: Record<string, string> = {
      D1: "d1Prompt",
      D2: "d2Prompt",
      D3: "d3Prompt",
      Judge: "judgePrompt",
    };
    const field = fieldMap[suggestion.role];
    if (field) {
      updateDebateLogic({ [field]: suggestion.promptText });
    }

    appendToJournal(`[APPLIED] ${suggestion.role} prompt updated via Chat suggestion`);
    showToast(`${suggestion.role} prompt updated & ready for next test`, "success");
  };

  // Discard prompt suggestion (just log to journal)
  const handleDiscardSuggestion = (suggestion: ParsedSuggestion) => {
    appendToJournal(
      `[DISCARDED SUGGESTION for ${suggestion.role}]\n\`\`\`\n${suggestion.promptText.substring(0, 200)}${suggestion.promptText.length > 200 ? "..." : ""}\n\`\`\``
    );
    showToast(`${suggestion.role} suggestion discarded`, "rejected");
  };

  // Data status for user visibility
  const batchCount = batchHistory?.length || 0;
  const hasPrompts = !!(roles.find((r) => r.id === "default-d1-responder")?.systemPrompt);
  const hasAnalysis = !!sharedContext.currentAnalysis;

  // Display name for sidebar model
  const displayModelName = currentProvider === "ollama" ? currentModel : currentModel.split("-").slice(0, 2).join(" ");

  // Track which suggestions have been applied/discarded
  const [handledSuggestions, setHandledSuggestions] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900/50">
      {/* Toast notification */}
      {toast.visible && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-top-2 fade-in duration-200",
            toast.type === "success" ? "bg-green-600 text-white" : "bg-zinc-600 text-white"
          )}
        >
          {toast.type === "success" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-teal-500" />
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Chat
            </h2>
            {/* Data status indicator */}
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[9px] px-1 py-0.5 rounded",
                  batchCount > 0
                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                )}
                title={`${batchCount} batches loaded`}
              >
                {batchCount}B
              </span>
              <span
                className={cn(
                  "text-[9px] px-1 py-0.5 rounded",
                  hasPrompts
                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                )}
                title={hasPrompts ? "Prompts loaded" : "No prompts"}
              >
                P
              </span>
              <span
                className={cn(
                  "text-[9px] px-1 py-0.5 rounded",
                  hasAnalysis
                    ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                )}
                title={hasAnalysis ? "Analysis available" : "No analysis"}
              >
                A
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleNewChat}
            title="New conversation"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Model indicator - uses sidebar selection */}
        <div className="mt-1.5 px-2 py-1 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          Using: <span className="font-medium text-zinc-700 dark:text-zinc-300">{displayModelName}</span>
          <span className="ml-1 opacity-60">({currentProvider})</span>
        </div>

        {/* Conversation tabs - compact */}
        {conversations.length > 0 && (
          <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
            {conversations.slice(0, 5).map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap cursor-pointer",
                  activeConversation?.id === conv.id
                    ? "bg-teal-500/20 text-teal-700 dark:text-teal-300"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                )}
              >
                <span className="truncate max-w-[80px]">{conv.title}</span>
                <button
                  onClick={(e) => handleDeleteClick(conv, e)}
                  className="hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* Warning when no analysis is available */}
        {!hasAnalysis && batchCount === 0 && (
          <div className="mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No batch or analysis selected. Run Analysis first, or select a batch to discuss.
            </p>
          </div>
        )}

        {!activeConversation || activeConversation.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="h-8 w-8 text-teal-500/30 mb-2" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {hasAnalysis
                ? "Analysis loaded. Ask about results or request prompt improvements."
                : "Ask about batches, prompts, or test results"}
            </p>
          </div>
        ) : (
          <>
            {activeConversation.messages.map((msg) => {
              // Parse suggestions from assistant messages
              const suggestions = msg.role === "assistant" ? parsePromptSuggestions(msg.content) : [];

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg px-2.5 py-1.5 text-sm",
                      msg.role === "user"
                        ? "bg-teal-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Apply/Discard buttons for prompt suggestions */}
                    {suggestions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                        {suggestions.map((suggestion, idx) => {
                          const suggestionKey = `${msg.id}-${suggestion.role}-${idx}`;
                          const isHandled = handledSuggestions.has(suggestionKey);

                          return (
                            <div
                              key={suggestionKey}
                              className={cn(
                                "flex items-center justify-between gap-2 p-2 rounded",
                                isHandled
                                  ? "bg-zinc-200 dark:bg-zinc-700 opacity-60"
                                  : "bg-indigo-100 dark:bg-indigo-900/30"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Wand2 className="h-3.5 w-3.5 text-indigo-500" />
                                <span className="text-xs font-medium">
                                  {suggestion.role} Prompt Update
                                </span>
                              </div>
                              {!isHandled && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 gap-1 text-green-600 dark:text-green-400 hover:bg-green-500/10"
                                    onClick={() => {
                                      handleApplySuggestion(suggestion);
                                      setHandledSuggestions(new Set([...handledSuggestions, suggestionKey]));
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                    Apply
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 gap-1 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                                    onClick={() => {
                                      handleDiscardSuggestion(suggestion);
                                      setHandledSuggestions(new Set([...handledSuggestions, suggestionKey]));
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                    Discard
                                  </Button>
                                </div>
                              )}
                              {isHandled && (
                                <span className="text-[10px] text-zinc-500">Handled</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className={cn("text-[10px] mt-1 opacity-60", msg.role === "user" ? "text-right" : "")}>
                      {formatTime(msg.timestamp)}
                      {msg.provider && ` · ${msg.provider}`}
                    </div>
                  </div>
                </div>
              );
            })}
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
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={2}
            className={cn(
              "flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-700",
              "bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm",
              "focus:outline-none focus:ring-1 focus:ring-teal-500",
              "placeholder:text-zinc-400"
            )}
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="h-auto bg-teal-600 hover:bg-teal-700 text-white px-3"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!conversationToDelete}
        onClose={() => setConversationToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Conversation"
        description={`Are you sure you want to delete "${conversationToDelete?.title || 'this conversation'}"? This will permanently remove all messages.`}
        variant="destructive"
        confirmText="Delete"
      />
    </div>
  );
}
