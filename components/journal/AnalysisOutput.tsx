"use client";

import { useState } from "react";
import { useRoleStore } from "@/lib/stores/roleStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useJournalStore } from "@/lib/stores/journalStore";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronDown, ChevronUp, Wand2, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface AnalysisOutputProps {
  content: string;
}

interface ParsedSuggestion {
  id: string;
  role: string;
  roleId: string;
  target: "role" | "debateLogic";
  field?: string;
  promptText: string;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: "success" | "rejected";
}

export function AnalysisOutput({ content }: AnalysisOutputProps) {
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });

  const updateRole = useRoleStore((s) => s.updateRole);
  const roles = useRoleStore((s) => s.roles);
  const updateDebateLogic = useTestModeStore((s) => s.updateDebateLogic);
  const appendToJournal = useJournalStore((s) => s.appendToJournal);

  // Parse suggestions from content
  const suggestions = parseSuggestions(content);

  // Remove suggestion blocks from main content for cleaner display
  const cleanContent = removeSuggestionBlocks(content);

  const showToast = (message: string, type: "success" | "rejected") => {
    setToast({ visible: true, message, type });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setToast({ visible: false, message: "", type: "success" });
    }, 3000);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedSuggestions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSuggestions(newExpanded);
  };

  const handleApply = (suggestion: ParsedSuggestion) => {
    // Apply silently without confirmation popup
    if (suggestion.target === "role") {
      const role = roles.find((r) => r.id === suggestion.roleId);
      if (role) {
        updateRole(suggestion.roleId, role.name, suggestion.promptText);
      }
    } else if (suggestion.target === "debateLogic" && suggestion.field) {
      updateDebateLogic({ [suggestion.field]: suggestion.promptText });
    }

    setAppliedSuggestions(new Set([...appliedSuggestions, suggestion.id]));
    appendToJournal(`[APPLIED] ${suggestion.role} prompt updated via AI suggestion`);

    // Show success toast
    showToast(`${suggestion.role} prompt updated`, "success");
  };

  const handleReject = (suggestion: ParsedSuggestion) => {
    setAppliedSuggestions(new Set([...appliedSuggestions, suggestion.id]));
    appendToJournal(
      `[REJECTED SUGGESTION for ${suggestion.role}]\n\`\`\`\n${suggestion.promptText.substring(0, 200)}${suggestion.promptText.length > 200 ? "..." : ""}\n\`\`\``
    );

    // Show rejected toast
    showToast(`${suggestion.role} suggestion rejected`, "rejected");
  };

  return (
    <div className="space-y-4 relative">
      {/* Toast notification */}
      {toast.visible && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-top-2 fade-in duration-200",
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-zinc-600 text-white"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Main analysis content */}
      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-zinc-100 prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100 prose-li:text-zinc-700 dark:prose-li:text-zinc-300">
        <ReactMarkdown>{cleanContent}</ReactMarkdown>
      </div>

      {/* Interactive suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <Wand2 className="h-4 w-4 text-indigo-500" />
            Suggested Prompt Updates ({suggestions.length})
          </div>

          {suggestions.map((suggestion) => {
            const isApplied = appliedSuggestions.has(suggestion.id);
            const isExpanded = expandedSuggestions.has(suggestion.id);

            return (
              <div
                key={suggestion.id}
                className={cn(
                  "rounded-lg border transition-all duration-200",
                  isApplied
                    ? "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-700 opacity-60"
                    : "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800"
                )}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer"
                  onClick={() => toggleExpand(suggestion.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        suggestion.role === "D1"
                          ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                          : suggestion.role === "D2"
                          ? "bg-green-500/20 text-green-700 dark:text-green-300"
                          : suggestion.role === "D3"
                          ? "bg-purple-500/20 text-purple-700 dark:text-purple-300"
                          : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      )}
                    >
                      {suggestion.role}
                    </span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {isApplied ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          Applied
                        </span>
                      ) : (
                        "Prompt Update Available"
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isApplied && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 gap-1 text-green-600 dark:text-green-400 hover:bg-green-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApply(suggestion);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 gap-1 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(suggestion);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono text-zinc-800 dark:text-zinc-200">
                      {suggestion.promptText}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Parse structured suggestions from AI output
function parseSuggestions(content: string): ParsedSuggestion[] {
  const suggestions: ParsedSuggestion[] = [];

  // Pattern 1: ## Suggested Prompt Update: D2
  const headerPattern =
    /## Suggested Prompt Update: (D[1-3]|Judge)\s*\n```(?:\w+)?\n([\s\S]*?)```/g;
  let match;
  let index = 0;

  while ((match = headerPattern.exec(content)) !== null) {
    const role = match[1];
    const promptText = match[2].trim();

    const roleIdMap: Record<string, string> = {
      D1: "default-d1-responder",
      D2: "default-d2-checker",
      D3: "default-d3-verifier",
      Judge: "default-judge",
    };

    const fieldMap: Record<string, string> = {
      D1: "d1Prompt",
      D2: "d2Prompt",
      D3: "d3Prompt",
      Judge: "judgePrompt",
    };

    suggestions.push({
      id: `suggestion-${index++}`,
      role,
      roleId: roleIdMap[role] || "",
      target: "role",
      field: fieldMap[role],
      promptText,
    });
  }

  // Pattern 2: **Apply to D2:**
  const applyPattern =
    /\*\*Apply to (D[1-3]|Judge):\*\*\s*\n```(?:\w+)?\n([\s\S]*?)```/g;

  while ((match = applyPattern.exec(content)) !== null) {
    const role = match[1];
    const promptText = match[2].trim();

    const roleIdMap: Record<string, string> = {
      D1: "default-d1-responder",
      D2: "default-d2-checker",
      D3: "default-d3-verifier",
      Judge: "default-judge",
    };

    const fieldMap: Record<string, string> = {
      D1: "d1Prompt",
      D2: "d2Prompt",
      D3: "d3Prompt",
      Judge: "judgePrompt",
    };

    // Avoid duplicates
    const existing = suggestions.find(
      (s) => s.role === role && s.promptText === promptText
    );
    if (!existing) {
      suggestions.push({
        id: `suggestion-${index++}`,
        role,
        roleId: roleIdMap[role] || "",
        target: "role",
        field: fieldMap[role],
        promptText,
      });
    }
  }

  return suggestions;
}

// Remove suggestion blocks from content for cleaner markdown display
function removeSuggestionBlocks(content: string): string {
  let cleaned = content;

  // Remove ## Suggested Prompt Update blocks
  cleaned = cleaned.replace(
    /## Suggested Prompt Update: (?:D[1-3]|Judge)\s*\n```(?:\w+)?\n[\s\S]*?```\n?/g,
    ""
  );

  // Remove **Apply to X:** blocks
  cleaned = cleaned.replace(
    /\*\*Apply to (?:D[1-3]|Judge):\*\*\s*\n```(?:\w+)?\n[\s\S]*?```\n?/g,
    ""
  );

  return cleaned.trim();
}
