"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Send, Loader2, Columns2, Columns3, Grid2X2, MessageSquare, Trash2, Paperclip, X, FileIcon, ImageIcon, Save, History, Copy, Check, Lock } from "lucide-react";
import { ChatColumn } from "@/components/chat/ChatColumn";
import { Button } from "@/components/ui/button";
import { useParallelChatStore } from "@/lib/stores/parallelChatStore";
import { useJuryGuardianStore } from "@/lib/stores/juryGuardianStore";
import { startJury, stopJury } from "@/lib/juryGuardian/engine";
import { JuryGuardianIndicator } from "@/components/chat/JuryGuardianIndicator";
import { JuryToastContainer } from "@/components/chat/JuryToast";
import { TruthAnchorsPanel } from "@/components/debate/TruthAnchorsPanel";
import { cn } from "@/lib/utils";
import type { Message, Provider } from "@/lib/types";

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

export function ParallelChatView() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const [showSessionPanel, setShowSessionPanel] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
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

  const handleSendToAll = () => {
    if (!sharedInput.trim() && attachments.length === 0) return;
    const anySending = columns.some(c => c.sending);
    if (anySending) return;

    // Build the message content
    let content = sharedInput.trim();

    // Separate images from non-image files
    // Also check if content looks like base64 image data (safety check)
    const imageAttachments = attachments.filter(a =>
      a.isImage || a.content.startsWith('data:image/')
    );
    const fileAttachments = attachments.filter(a =>
      !a.isImage && !a.content.startsWith('data:image/')
    );

    // For non-image files, include the content as text (but NOT binary/base64 data)
    if (fileAttachments.length > 0) {
      const fileDescriptions = fileAttachments
        .filter(att => !att.content.startsWith('data:')) // Skip any data URLs
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

    // Pass image URLs separately for proper handling
    const imageUrls = imageAttachments.map(a => a.content);

    sendToAll(content, undefined, imageUrls);
    setSharedInput("");
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendToAll();
    }
  };

  const handleShare = (message: Message, fromColumnId: string, targetColumnId: string) => {
    shareMessage(fromColumnId, targetColumnId, message);
  };

  const handleShareToAll = (message: Message, fromColumnId: string) => {
    shareMessageToAll(fromColumnId, message);
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Chat</span>
          </div>
          {/* Single | Multi-Chat Toggle */}
          <div className="flex items-center rounded-lg bg-zinc-200 dark:bg-zinc-800/50 p-0.5">
            <button
              onClick={toggleParallelMode}
              className="px-2 py-1 text-[10px] font-medium rounded-md transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Single
            </button>
            <button
              className="px-2 py-1 text-[10px] font-medium rounded-md transition-all flex items-center gap-1 bg-indigo-600 text-white shadow-sm"
            >
              <Columns2 className="h-3 w-3" />
              Multi-Chat
            </button>
          </div>
        </div>

        {/* Column Count Selector + Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <span className="text-xs text-zinc-500 mr-1">Panes:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setColumnCount(2)}
              className={cn(
                "h-7 w-7 p-0",
                activeColumnCount === 2 ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
              )}
              title="2-Way (Dual)"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setColumnCount(3)}
              className={cn(
                "h-7 w-7 p-0",
                activeColumnCount === 3 ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
              )}
              title="3-Way (Triple)"
            >
              <Columns3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setColumnCount(4)}
              className={cn(
                "h-7 w-7 p-0",
                activeColumnCount === 4 ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
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
              "h-7 px-2 gap-1 text-xs transition-colors",
              showAnchorsPanel
                ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10"
                : "text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-500/10"
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
            className="h-7 px-2 gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-500/10"
            title="Copy all conversations to clipboard"
          >
            {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedAll ? 'Copied!' : 'Copy All'}
          </Button>

          {/* Save Session */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveSession}
            className="h-7 px-2 gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-500/10"
            title="Save current session to history"
          >
            {savedConfirm ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Save className="h-3.5 w-3.5" />}
            {savedConfirm ? 'Saved!' : 'Save'}
          </Button>

          {/* Sessions History */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSessionPanel(p => !p)}
              className={cn(
                "h-7 px-2 gap-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800",
                showSessionPanel ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400"
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
                          <div key={session.id} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 group">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{session.name}</p>
                              <p className="text-[10px] text-zinc-400">{session.activeColumnCount} panes · {session.columns.reduce((n, c) => n + c.messages.length, 0)} msgs</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { loadSession(session.id); setShowSessionPanel(false); }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
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
            className="h-7 px-2 gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10"
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
              onModelChange={(provider: Provider, model: string) => setColumnModel(column.id, provider, model)}
              onRoleChange={(roleId: string | undefined) => setColumnRole(column.id, roleId)}
              onSend={(content: string) => sendToColumn(column.id, content)}
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
        className="relative border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-3"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-indigo-500 bg-indigo-500/10 backdrop-blur-sm">
            <div className="text-center">
              <Paperclip className="mx-auto h-10 w-10 text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              <p className="mt-2 text-sm font-bold text-indigo-300">Drop files to attach</p>
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

          <div className="flex items-end gap-3">
            {/* Attach button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={anySending}
              className="h-11 px-3 text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Attach files (images, PDFs, etc.)"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

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

            <div className="flex-1">
              <textarea
                value={sharedInput}
                onChange={(e) => setSharedInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={attachments.length > 0 ? "Add a message about your files..." : "Type a message to send to all models..."}
                disabled={anySending}
                rows={1}
                className={cn(
                  "w-full resize-none rounded-lg px-4 py-3 text-sm",
                  "bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200",
                  "placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "min-h-[44px] max-h-[120px]"
                )}
                style={{
                  height: "44px",
                  overflowY: sharedInput.split("\n").length > 2 ? "auto" : "hidden",
                }}
              />
            </div>
            <Button
              onClick={handleSendToAll}
              disabled={(!sharedInput.trim() && attachments.length === 0) || anySending}
              className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              {anySending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="font-medium">Send to All</span>
            </Button>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-600 text-center mt-2">
            Paste screenshots, drag files, or click the clip icon to attach. Each pane also has its own input.
          </p>
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
