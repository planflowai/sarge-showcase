"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Send, Loader2, Columns2, Columns3, Grid2X2, MessageSquare, Trash2, Paperclip, X, FileIcon, ImageIcon, Save, History, Copy, Check, Lock, Mic, ClipboardCopy, Swords, Sparkles } from "lucide-react";
import { ChatColumn } from "./ChatColumn";
import { Button } from "@/components/ui/button";
import { useParallelChatStore } from "../../stores/parallelChatStore";
import { useJuryGuardianStore } from "@sarge/core";
import { startJury, stopJury } from "@sarge/core";
import { JuryGuardianIndicator, JuryToast as JuryToastContainer } from "@sarge/core";
import { TruthAnchorsPanel } from "../debate/TruthAnchorsPanel";
import { cn } from "@sarge/core";
import type { Message, Provider } from "@sarge/core";
import { useMessageStore } from "../../stores/messageStore";

// ─── Attachment types ───────────────────────────────────────────────────────

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // text content or base64 data URL for images
  isImage: boolean;
}

async function readFileAsAttachment(file: File): Promise<Attachment> {
  // Check if it's an image by type OR by common image extensions
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
  const isImageByType = file.type.startsWith("image/");
  const isImageByName = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  const isImage = isImageByType || isImageByName;

  const content = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    if (isImage) {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(file);
    }
  });

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || (isImage ? 'image/png' : 'application/octet-stream'),
    size: file.size,
    content,
    isImage,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface ParallelChatViewProps {
  onSingleChat?: () => void;
  onWarRoom?: () => void;
}

export function ParallelChatView({ onSingleChat, onWarRoom }: ParallelChatViewProps = {}) {
  const {
    columns,
    activeColumnCount,
    hydrated,
    hydrate,
    toggleParallelMode,
    setColumnCount,
    setColumnModel,
    setColumnRole,
    sendToColumn,
    sendToAll,
    shareMessage,
    shareMessageToAll,
    compareAnswers,
    clearColumn,
    clearAllColumns,
    getOtherColumns,
    savedSessions,
    saveCurrentSession,
    loadSession,
    deleteSession,
  } = useParallelChatStore();

  const [sharedInput, setSharedInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showAnchorsPanel, setShowAnchorsPanel] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const [showSessionPanel, setShowSessionPanel] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedLast, setCopiedLast] = useState(false);
  const [savedConfirm, setSavedConfirm] = useState(false);

  // ─── Session helpers ─────────────────────────────────────────────────
  function getSessionGroup(savedAt: number): string {
    const diffDays = Math.floor((Date.now() - savedAt) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return 'This Week';
    if (diffDays <= 30) return 'This Month';
    return 'Older';
  }

  const handleSaveSession = () => {
    saveCurrentSession();
    setSavedConfirm(true);
    setTimeout(() => setSavedConfirm(false), 2000);
  };

  const handleCopyLastAnswers = () => {
    const visibleCols = columns.slice(0, activeColumnCount);
    const divider = '\n' + '─'.repeat(60) + '\n\n';
    const text = visibleCols.map(col => {
      const header = `=== ${col.model} (${col.provider}) ===`;
      const lastAssistant = [...col.messages].reverse().find(m => m.role === 'assistant');
      if (!lastAssistant) return `${header}\n(no answer yet)`;
      return `${header}\n\n${lastAssistant.content}`;
    }).join(divider);
    navigator.clipboard.writeText(text);
    setCopiedLast(true);
    setTimeout(() => setCopiedLast(false), 2000);
  };

  const handleCopyAll = () => {
    const visibleCols = columns.slice(0, activeColumnCount);
    const divider = '\n' + '─'.repeat(60) + '\n\n';
    const text = visibleCols.map(col => {
      const header = `=== ${col.model} (${col.provider}) ===`;
      if (col.messages.length === 0) return `${header}\n(no messages)`;
      const msgs = col.messages.map(m =>
        `[${m.role.toUpperCase()}]: ${m.content}`
      ).join('\n\n');
      return `${header}\n\n${msgs}`;
    }).join(divider);
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Group sessions by date label
  const groupedSessions = savedSessions.reduce<Record<string, typeof savedSessions>>((acc, s) => {
    const group = getSessionGroup(s.savedAt);
    if (!acc[group]) acc[group] = [];
    acc[group].push(s);
    return acc;
  }, {});
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

  // Jury Guardian
  const juryEnabled = useJuryGuardianStore((s) => s.enabled);
  const juryScope = useJuryGuardianStore((s) => s.scope);
  const juryHydrated = useJuryGuardianStore((s) => s.hydrated);
  const sessionId = "parallel-chat"; // Fixed session ID for parallel chat

  // Start/stop jury when parallel chat mounts/unmounts
  useEffect(() => {
    if (juryEnabled && juryScope.parallelChat && hydrated && juryHydrated) {
      console.log("[ParallelChat] Starting Jury Guardian");
      startJury(sessionId);
      return () => {
        console.log("[ParallelChat] Stopping Jury Guardian");
        stopJury(sessionId);
      };
    }
  }, [juryEnabled, juryScope.parallelChat, hydrated, juryHydrated]);

  // ─── File handling functions ─────────────────────────────────────────
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments = await Promise.all(fileArray.map(readFileAsAttachment));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // ─── Paste handler ──────────────────────────────────────────────────
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        await addFiles(files);
      }
    },
    [addFiles]
  );

  // ─── Drag-and-drop handlers ─────────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await addFiles(files);
      }
    },
    [addFiles]
  );

  // Hydrate store on mount
  const hydrateRef = useRef(false);
  useEffect(() => {
    if (!hydrated && !hydrateRef.current) {
      hydrateRef.current = true;
      hydrate();
    }
  }, [hydrated, hydrate]);

  // Pick up any content sent from single-chat "Send to Multi-Chat" button
  useEffect(() => {
    if (!hydrated) return;
    try {
      const prefill = localStorage.getItem("sarge_multichat_prefill");
      if (prefill) {
        setSharedInput(prefill);
        localStorage.removeItem("sarge_multichat_prefill");
      }
    } catch { /* ignore */ }
  }, [hydrated]);

  const handleCompare = async () => {
    if (isComparing) return;
    setIsComparing(true);
    try {
      await compareAnswers();
    } finally {
      setIsComparing(false);
    }
  };

  const handleSendToAll = () => {
    if (!sharedInput.trim() && attachments.length === 0) return;

    // Build the message content
    let content = sharedInput.trim();

    // Separate images from non-image files
    const imageAttachments = attachments.filter(a =>
      a.isImage || a.content.startsWith('data:image/')
    );
    const fileAttachments = attachments.filter(a =>
      !a.isImage && !a.content.startsWith('data:image/')
    );

    // For non-image files, include the content as text
    if (fileAttachments.length > 0) {
      const fileDescriptions = fileAttachments
        .filter(att => !att.content.startsWith('data:'))
        .map(att => `[File: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\``);
      if (fileDescriptions.length > 0) {
        if (content) {
          content = `${content}\n\n${fileDescriptions.join("\n\n")}`;
        } else {
          content = fileDescriptions.join("\n\n");
        }
      }
    }

    // If no text content but has images, add a default prompt
    if (!content && imageAttachments.length > 0) {
      content = "Please analyze this image.";
    }

    // Just add the message to all columns (no AI calls)
    sendToAll(content);

    setSharedInput("");
    setAttachments([]);
  };

  const handleColumnSend = useCallback(
    async (columnId: string, content: string) => {
      await sendToColumn(columnId, content);
    },
    [sendToColumn]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendToAll();
    }
  };

  const handleShare = async (message: Message, fromColumnId: string, targetColumnId: string) => {
    await shareMessage(fromColumnId, targetColumnId, message);
  };

  const handleShareToAll = async (message: Message, fromColumnId: string) => {
    await shareMessageToAll(fromColumnId, message);
  };

  const anySending = columns.some(c => c.sending);

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with mode toggle and column count */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-black tracking-wide text-zinc-200">Multi-Chat</span>
          </div>
        </div>

        {/* Column Count Selector + Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <span className="text-xs text-zinc-500 mr-1">Panes:</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setColumnCount(2)}
              className={cn(
                "h-7 w-7 p-0",
                activeColumnCount === 2 ? "bg-orange-600/20 border border-orange-500/40 text-orange-400" : "text-zinc-500 dark:text-zinc-400"
              )}
              title="2-Way (Dual)"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setColumnCount(3)}
              className={cn(
                "h-7 w-7 p-0",
                activeColumnCount === 3 ? "bg-orange-600/20 border border-orange-500/40 text-orange-400" : "text-zinc-500 dark:text-zinc-400"
              )}
              title="3-Way (Triple)"
            >
              <Columns3 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setColumnCount(4)}
              className={cn(
                "h-7 w-7 p-0",
                activeColumnCount === 4 ? "bg-orange-600/20 border border-orange-500/40 text-orange-400" : "text-zinc-500 dark:text-zinc-400"
              )}
              title="4-Way (Quad)"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Jury Guardian Indicator */}
          <JuryGuardianIndicator sessionId={sessionId} />

          {/* Truth Anchors Panel Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnchorsPanel(!showAnchorsPanel)}
            className={cn(
              "h-7 px-2 gap-1 text-xs font-semibold transition-colors",
              showAnchorsPanel
                ? "text-amber-400 bg-amber-500/15 border border-amber-500/30"
                : "text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10"
            )}
            title="Show/hide truth anchors"
          >
            <Lock className="h-3.5 w-3.5" />
            Anchors
          </Button>

          {/* Copy All */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyAll}
            className="h-7 px-2 gap-1 text-xs font-semibold text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
            title="Copy all conversations to clipboard"
          >
            {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedAll ? 'Copied!' : 'Copy All'}
          </Button>

          {/* Copy Last Answers */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLastAnswers}
            className="h-7 px-2 gap-1 text-xs font-semibold text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
            title="Copy last answer from each column to clipboard"
          >
            {copiedLast ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedLast ? 'Copied!' : 'Copy Answers'}
          </Button>

          {/* Save Session */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveSession}
            className="h-7 px-2 gap-1 text-xs font-semibold text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Save current session to history"
          >
            {savedConfirm ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
            {savedConfirm ? 'Saved!' : 'Save'}
          </Button>

          {/* Sessions History */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSessionPanel(p => !p)}
              className={cn(
                "h-7 px-2 gap-1 text-xs font-semibold transition-colors",
                showSessionPanel ? "text-orange-400 bg-orange-500/10" : "text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10"
              )}
              title="Browse saved sessions"
            >
              <History className="h-3.5 w-3.5" />
              Sessions {savedSessions.length > 0 && `(${savedSessions.length})`}
            </Button>

            {showSessionPanel && (
              <div className="absolute right-0 top-8 z-50 w-72 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Saved Sessions</span>
                  <button onClick={() => setShowSessionPanel(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {savedSessions.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-zinc-400">
                      No saved sessions yet.<br />Click <strong>Save</strong> to save the current session.
                    </div>
                  ) : (
                    groupOrder.filter(g => groupedSessions[g]?.length).map(group => (
                      <div key={group}>
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50">
                          {group}
                        </div>
                        {groupedSessions[group].map(session => (
                          <div key={session.id} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/60 group">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-zinc-300 truncate">{session.name}</p>
                              <p className="text-[10px] text-zinc-500">{session.activeColumnCount} panes · {session.columns.reduce((n, c) => n + c.messages.length, 0)} msgs</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { loadSession(session.id); setShowSessionPanel(false); }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 hover:bg-orange-500/25"
                              >
                                Load
                              </button>
                              <button
                                onClick={() => deleteSession(session.id)}
                                className="text-zinc-400 hover:text-red-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Clear All Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllColumns}
            className="h-7 px-2 gap-1 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Clear all conversations"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Chat Columns - 2x2 grid for 4-way mode */}
      <div className={cn(
        "flex-1 min-h-0",
        activeColumnCount === 4
          ? "grid grid-cols-1 md:grid-cols-2 grid-rows-2"
          : "flex"
      )}>
        {columns.slice(0, activeColumnCount).map(column => (
          <div
            key={column.id}
            className={cn(
              "min-w-0",
              activeColumnCount === 4
                ? "h-full"
                : "flex-1"
            )}
            style={activeColumnCount !== 4 ? { width: `${100 / activeColumnCount}%` } : undefined}
          >
            <ChatColumn
              column={column}
              onModelChange={(provider: Provider, model: string) => setColumnModel(column.id, model, provider)}
              onRoleChange={(roleId: string | undefined) => setColumnRole(column.id, roleId)}
              onSend={(content: string) => handleColumnSend(column.id, content)}
              onClear={() => clearColumn(column.id)}
              onShare={(message: Message, targetColumnId: string) => handleShare(message, column.id, targetColumnId)}
              onShareToAll={(message: Message) => handleShareToAll(message, column.id)}
              otherColumns={getOtherColumns(column.id)}
              isParallelMode={true}
            />
          </div>
        ))}
      </div>

      {/* Shared Input Area */}
      <div
        ref={dropRef}
        className="relative border-t border-zinc-700/50 bg-zinc-900 p-3"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-orange-500 bg-orange-500/10 backdrop-blur-sm">
            <div className="text-center">
              <Paperclip className="mx-auto h-10 w-10 text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
              <p className="mt-2 text-sm font-bold text-orange-300">Drop files to attach</p>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  {att.isImage ? (
                    <ImageIcon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                  )}
                  <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                  <span className="text-zinc-400 dark:text-zinc-500">{formatFileSize(att.size)}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="ml-1 rounded p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.csv,.xml,.html,.css,.js,.ts,.tsx,.jsx"
            className="hidden"
            onChange={async (e) => {
              if (e.target.files) await addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Textarea — centered, dark themed */}
          <textarea
            value={sharedInput}
            onChange={(e) => setSharedInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={attachments.length > 0 ? "Add a message about your files..." : "Send to all models simultaneously… (Enter to send, Shift+Enter for new line)"}
            disabled={anySending}
            rows={2}
            className="w-full resize-none rounded-xl bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none border border-zinc-700 focus:border-orange-500/50 disabled:opacity-50 min-h-[44px] max-h-[120px] transition-colors"
          />

          {/* Bottom action bar — centered, Forge themed */}
          <div className="flex items-center justify-center gap-1 mt-2">
            {/* Single | Multi-Chat Toggle */}
            <div className="flex items-center rounded-lg bg-zinc-800/80 border border-zinc-700/40 p-0.5 mr-1">
              <button
                type="button"
                onClick={toggleParallelMode}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md transition-all text-zinc-500 hover:text-zinc-200"
              >
                Single
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 bg-orange-600 text-white shadow-sm"
              >
                <Columns2 className="h-3 w-3" />
                Multi
              </button>
            </div>

            {/* Generate Image */}
            <button
              onClick={() => setSharedInput("Generate an image: ")}
              disabled={anySending}
              title="Generate image"
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-amber-400 transition-colors disabled:opacity-30"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            {/* Copy All */}
            <button
              onClick={handleCopyAll}
              disabled={columns.slice(0, activeColumnCount).every(c => c.messages.length === 0)}
              title="Copy all responses"
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-amber-400 transition-colors disabled:opacity-30"
            >
              {copiedAll ? (
                <Check className="h-5 w-5 text-emerald-400" />
              ) : (
                <ClipboardCopy className="h-5 w-5" />
              )}
            </button>

            {/* Compare */}
            <button
              onClick={handleCompare}
              disabled={columns.slice(0, activeColumnCount).some(c => c.messages.length === 0) || anySending || isComparing}
              title="Compare all responses"
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-amber-400 transition-colors disabled:opacity-30"
            >
              <MessageSquare className="h-5 w-5" />
            </button>

            {/* War Room */}
            {onWarRoom && (
              <button
                onClick={onWarRoom}
                title="Switch to War Room"
                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-red-400 transition-colors"
              >
                <Swords className="h-5 w-5" />
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-700 mx-1" />

            {/* Attach */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={anySending}
              title="Attach files"
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-orange-400 transition-colors disabled:opacity-30"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {/* Microphone */}
            <button
              disabled
              title="Voice input (coming soon)"
              className="p-2 rounded-lg text-zinc-600 transition-colors opacity-40 cursor-not-allowed"
            >
              <Mic className="h-5 w-5" />
            </button>

            {/* Send to All */}
            <button
              onClick={handleSendToAll}
              disabled={(!sharedInput.trim() && attachments.length === 0) || anySending}
              title="Send to all models"
              className="p-2.5 rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-all hover:shadow-[0_0_14px_rgba(249,115,22,0.4)] disabled:opacity-30 disabled:hover:bg-orange-600 disabled:hover:shadow-none"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Jury Guardian Toasts */}
      <JuryToastContainer />

      {/* Truth Anchors Sidebar */}
      {showAnchorsPanel && (
        <div className="fixed right-0 top-0 h-full w-[420px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl z-40 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-white">Truth Anchors</span>
            <button
              onClick={() => setShowAnchorsPanel(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            <TruthAnchorsPanel className="rounded-none border-none h-full" />
          </div>
        </div>
      )}
    </div>
  );
}
