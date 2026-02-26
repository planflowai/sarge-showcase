"use client";

/* eslint-disable @typescript-eslint/no-empty-object-type */
// FileSystem Access API types (for webkitGetAsEntry)
interface FileSystemEntry { isFile: boolean; isDirectory: boolean; name: string; }
interface FileSystemFileEntry extends FileSystemEntry { file(cb: (f: File) => void, err?: () => void): void; }
interface FileSystemDirectoryEntry extends FileSystemEntry { createReader(): FileSystemDirectoryReader; }
interface FileSystemDirectoryReader { readEntries(cb: (entries: FileSystemEntry[]) => void, err?: () => void): void; }

import { useState, useRef, useCallback, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Send, ImageIcon, Swords, Mic, Paperclip, MoreHorizontal, X, FileIcon, ImageIcon as ImgIcon, BookText, MessageSquare, Shield, ShieldAlert, ShieldCheck, ChevronDown, ClipboardCopy, Check, Database, Download } from "lucide-react";
import { usePromptStore } from "@/lib/stores/promptStore";
import { useProviderStore } from "@/lib/stores/providerStore";
import { useModelStore } from "@/lib/stores/modelStore";
import { useKnowledgeStore } from "@/lib/stores/knowledgeStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { useDraftStore } from "@/lib/stores/draftStore";
import { VaultAttachmentModal } from "@/components/chat/VaultAttachmentModal";
import { providers } from "@/lib/providers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { VoiceState } from "@/lib/types";

// ─── Attachment types (shared) ───────────────────────────────────────────────
import { type Attachment, readFileAsAttachment, formatFileSize } from "@/lib/utils/attachments";
export { type Attachment, readFileAsAttachment, formatFileSize } from "@/lib/utils/attachments";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface VaultSelection {
  id: string;
  name: string;
}

interface InputAreaProps {
  conversationId?: string;
  onSend: (content: string, attachments?: Attachment[], vaultIds?: string[]) => void;
  onImageGen?: (prompt: string) => void;
  onDebate?: () => void;
  onDebateThread?: () => void;
  onCopyThread?: () => void;
  hasMessages?: boolean;
  supportsImageGen?: boolean;
  disabled?: boolean;
  voiceState: VoiceState;
  supportsVoice: boolean;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  onVoiceInterrupt: () => void;
}

export function InputArea({
  conversationId,
  onSend,
  onImageGen,
  onDebate,
  onDebateThread,
  onCopyThread,
  hasMessages,
  supportsImageGen,
  disabled,
  voiceState,
  supportsVoice,
  onVoiceStart,
  onVoiceStop,
  onVoiceInterrupt,
}: InputAreaProps) {
  // Draft persistence - restore input when returning to conversation
  const { getDraft, setDraft, clearDraft, hydrated: draftHydrated, hydrate: hydrateDraft } = useDraftStore();
  const draftKey = conversationId ? `chat-${conversationId}` : null;

  const [input, setInput] = useState("");
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [selectedVaultIds, setSelectedVaultIds] = useState<string[]>([]);
  const [showExportHint, setShowExportHint] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  // Knowledge store for vault documents
  const vaultDocuments = useKnowledgeStore((s) => s.documents);
  const vaultHydrated = useKnowledgeStore((s) => s.hydrated);
  const hydrateVault = useKnowledgeStore((s) => s.hydrate);

  // Chat mode for placeholder
  const chatMode = useUIStore((s) => s.chatMode);

  useEffect(() => {
    if (!vaultHydrated) hydrateVault();
  }, [vaultHydrated, hydrateVault]);

  // Hydrate draft store
  useEffect(() => {
    if (!draftHydrated) hydrateDraft();
  }, [draftHydrated, hydrateDraft]);

  // Restore draft when conversation changes or on mount
  useEffect(() => {
    if (draftKey && draftHydrated) {
      const savedDraft = getDraft(draftKey);
      if (savedDraft) {
        setInput(savedDraft);
      }
    }
  }, [draftKey, draftHydrated, getDraft]);

  // Save draft on input change (debounced via the input state itself)
  useEffect(() => {
    if (draftKey && draftHydrated) {
      if (input) {
        setDraft(draftKey, input);
      } else {
        clearDraft(draftKey);
      }
    }
  }, [input, draftKey, draftHydrated, setDraft, clearDraft]);

  // Get selected vault document names for pills
  const selectedVaultDocs = selectedVaultIds
    .map((id) => vaultDocuments.find((d) => d.id === id))
    .filter(Boolean) as { id: string; name: string }[];

  const removeVaultAttachment = (id: string) => {
    setSelectedVaultIds((prev) => prev.filter((x) => x !== id));
  };


  // Provider/Model state for inline selector
  const currentProvider = useProviderStore((s) => s.currentProvider);
  const currentModel = useProviderStore((s) => s.currentModel);
  const setProvider = useProviderStore((s) => s.setProvider);
  const setModel = useProviderStore((s) => s.setModel);
  const getEffectiveModels = useModelStore((s) => s.getEffectiveModels);
  const getDisplayName = useModelStore((s) => s.getDisplayName);
  const activeProvider = providers.find((p) => p.id === currentProvider);

  const prompts = usePromptStore((s) => s.prompts);
  const promptHydrated = usePromptStore((s) => s.hydrated);
  const hydratePrompts = usePromptStore((s) => s.hydrate);

  useEffect(() => {
    if (!promptHydrated) hydratePrompts();
  }, [promptHydrated, hydratePrompts]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    // Add all files as attachments for the message
    const newAttachments = await Promise.all(fileArray.map(readFileAsAttachment));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content && attachments.length === 0 && selectedVaultIds.length === 0) return;
    setInput("");
    // Clear the persisted draft since message was sent
    if (draftKey) {
      clearDraft(draftKey);
    }
    const atts = attachments.length > 0 ? [...attachments] : undefined;
    const vaultIds = selectedVaultIds.length > 0 ? [...selectedVaultIds] : undefined;
    setAttachments([]);
    setSelectedVaultIds([]);
    onSend(content, atts, vaultIds);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageGen = () => {
    if (!imagePrompt.trim()) return;
    onImageGen?.(imagePrompt.trim());
    setImagePrompt("");
    setShowImageDialog(false);
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

      // Try to read folder contents via webkitGetAsEntry
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const allFiles: File[] = [];

        const readEntry = (entry: FileSystemEntry): Promise<File[]> => {
          return new Promise((resolve) => {
            if (entry.isFile) {
              (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]));
            } else if (entry.isDirectory) {
              const reader = (entry as FileSystemDirectoryEntry).createReader();
              const results: Promise<File[]>[] = [];
              const readBatch = () => {
                reader.readEntries(async (entries) => {
                  if (entries.length === 0) {
                    const nested = await Promise.all(results);
                    resolve(nested.flat());
                  } else {
                    for (const e of entries) results.push(readEntry(e));
                    readBatch();
                  }
                }, () => resolve([]));
              };
              readBatch();
            } else {
              resolve([]);
            }
          });
        };

        let usedEntries = false;
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) {
            usedEntries = true;
            const files = await readEntry(entry);
            allFiles.push(...files);
          }
        }

        if (usedEntries && allFiles.length > 0) {
          await addFiles(allFiles);
          return;
        }
      }

      // Fallback: plain files
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await addFiles(files);
      }
    },
    [addFiles]
  );

  const handleVoiceClick = () => {
    if (!supportsVoice) return;
    switch (voiceState) {
      case "idle":
        onVoiceStart();
        break;
      case "speaking":
        onVoiceInterrupt();
        break;
      case "listening":
      case "processing":
        onVoiceStop();
        break;
    }
  };

  const isVoiceActive = voiceState !== "idle";

  // Protection status state for visual feedback
  const [protectionStatus, setProtectionStatus] = useState<'idle' | 'detected' | 'neutralized' | null>(null);

  // Copy thread feedback state
  const [threadCopied, setThreadCopied] = useState(false);

  const handleCopyThread = () => {
    onCopyThread?.();
    setThreadCopied(true);
    setTimeout(() => setThreadCopied(false), 2000);
  };

  // Auto-clear protection status after animation
  useEffect(() => {
    if (protectionStatus) {
      const timer = setTimeout(() => setProtectionStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [protectionStatus]);

  return (
    <div
      ref={dropRef}
      className="relative border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 backdrop-blur-sm px-4 pt-3 pb-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-cyan-500 bg-cyan-500/10 backdrop-blur-sm">
          <div className="text-center">
            <Paperclip className="mx-auto h-10 w-10 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <p className="mt-2 text-sm font-bold text-cyan-300">Drop files to attach</p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl">
        {/* Protection Status Badge - Flashes when poison detected/neutralized */}
        {protectionStatus && (
          <div className={`mb-3 flex items-center justify-center gap-2 py-2 px-4 rounded-lg animate-pulse ${
            protectionStatus === 'detected'
              ? 'bg-red-500/20 border border-red-500/50'
              : 'bg-emerald-500/20 border border-emerald-500/50'
          }`}>
            {protectionStatus === 'detected' ? (
              <>
                <ShieldAlert className="h-5 w-5 text-red-400" />
                <span className="text-sm font-bold text-red-400">⚠️ Poison Detected</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">✓ Poison Neutralized</span>
              </>
            )}
          </div>
        )}

        {/* Attachment chips (file attachments + vault attachments) */}
        {(attachments.length > 0 || selectedVaultDocs.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {/* Vault attachments */}
            {selectedVaultDocs.map((doc) => (
              <div
                key={`vault-${doc.id}`}
                className="flex items-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-600/20 px-3 py-1.5 text-xs text-indigo-300"
              >
                <Database className="h-4 w-4 text-indigo-400" />
                <span className="max-w-[140px] truncate font-medium">{doc.name}</span>
                <button
                  onClick={() => removeVaultAttachment(doc.id)}
                  className="ml-1 rounded p-0.5 text-indigo-400 hover:text-red-400 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {/* File attachments */}
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-300"
              >
                {att.isImage ? (
                  <ImgIcon className="h-4 w-4 text-indigo-400" />
                ) : (
                  <FileIcon className="h-4 w-4 text-zinc-400" />
                )}
                <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                <span className="text-zinc-500">{formatFileSize(att.size)}</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 rounded p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mobile: overflow toggle */}
        <div className="sm:hidden mb-2">
          <button
            onClick={() => setShowMore((v) => !v)}
            title="More options"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {showMore && (
            <div className="absolute bottom-full left-4 mb-2 flex flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-800 p-2 shadow-xl z-20">
              <button
                onClick={() => { onDebate?.(); setShowMore(false); }}
                disabled={disabled}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
              >
                <Swords className="h-4 w-4 text-amber-400" /> Debate
              </button>
              {hasMessages && (
                <button
                  onClick={() => { onDebateThread?.(); setShowMore(false); }}
                  disabled={disabled}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
                >
                  <span className="relative">
                    <Swords className="h-4 w-4 text-amber-400" />
                    <MessageSquare className="absolute -bottom-1 -right-1.5 h-2.5 w-2.5 text-indigo-400" />
                  </span>
                  Debate Thread
                </button>
              )}
              <button
                onClick={() => { setShowImageDialog(true); setShowMore(false); }}
                disabled={disabled || !supportsImageGen}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
              >
                <ImageIcon className="h-4 w-4 text-indigo-400" /> Image
              </button>
              <button
                onClick={() => { fileInputRef.current?.click(); setShowMore(false); }}
                disabled={disabled}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
              >
                <Paperclip className="h-4 w-4" /> Attach
              </button>
            </div>
          )}
        </div>

        {/* Textarea - clean look */}
        <TextareaAutosize
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            attachments.length > 0
              ? "Add a message about your files..."
              : chatMode === "architect"
              ? "Describe what you want to build..."
              : "Type a message... (Enter to send, Shift+Enter for new line)"
          }
          minRows={2}
          maxRows={10}
          disabled={disabled}
          className="w-full resize-none rounded-lg bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none disabled:opacity-50 border border-zinc-300 dark:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-600"
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            if (e.target.files) await addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Bottom action bar - all icons centered */}
        <div className="flex items-center justify-center gap-1 mt-2">
          {/* Saved Prompts */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={disabled}
                title="Load saved prompt"
                className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors disabled:opacity-30"
              >
                <BookText className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-72 max-h-80 overflow-y-auto bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
              {prompts.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-zinc-500">
                  <p>No saved prompts</p>
                  <a href="/settings" className="mt-1 inline-block text-xs text-indigo-400 hover:underline">
                    Create in Settings &rarr;
                  </a>
                </div>
              ) : (
                prompts.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setInput(p.content)}
                    className="flex flex-col items-start gap-0.5 cursor-pointer"
                  >
                    <span className="font-medium text-sm">{p.name}</span>
                    <span className="text-xs text-zinc-500 line-clamp-2">{p.content}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Generate Image */}
          <button
            onClick={() => setShowImageDialog(true)}
            disabled={disabled || !supportsImageGen}
            title="Generate image"
            className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors disabled:opacity-30"
          >
            <ImageIcon className="h-5 w-5" />
          </button>

          {/* Debate */}
          <button
            onClick={onDebate}
            disabled={disabled}
            title="Start new debate"
            className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-amber-500 dark:hover:text-amber-400 transition-colors disabled:opacity-30"
          >
            <Swords className="h-5 w-5" />
          </button>

          {/* Debate Thread */}
          {hasMessages && (
            <button
              onClick={onDebateThread}
              disabled={disabled}
              title="Debate this thread"
              className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-amber-500 dark:hover:text-amber-400 transition-colors disabled:opacity-30 relative"
            >
              <Swords className="h-5 w-5" />
              <MessageSquare className="absolute bottom-1 right-1 h-2.5 w-2.5 text-indigo-400" />
            </button>
          )}

          {/* Copy Thread */}
          {hasMessages && (
            <button
              onClick={handleCopyThread}
              disabled={disabled}
              title="Copy thread to clipboard"
              className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors disabled:opacity-30"
            >
              {threadCopied ? (
                <Check className="h-5 w-5 text-emerald-400" />
              ) : (
                <ClipboardCopy className="h-5 w-5" />
              )}
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Knowledge Vault */}
          <button
            onClick={() => setShowVaultModal(true)}
            disabled={disabled}
            title="Attach from Knowledge Vault"
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${
              selectedVaultIds.length > 0
                ? "bg-indigo-600/20 text-indigo-400"
                : "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-indigo-500 dark:hover:text-indigo-400"
            }`}
          >
            <Database className="h-5 w-5" />
            {selectedVaultIds.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {selectedVaultIds.length}
              </span>
            )}
          </button>

          {/* Attach */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Attach files"
            className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors disabled:opacity-30"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Microphone */}
          <button
            onClick={handleVoiceClick}
            disabled={disabled || !supportsVoice}
            title={supportsVoice ? (isVoiceActive ? "Stop recording" : "Start voice input") : "Voice not supported"}
            className={`relative p-2 rounded-lg transition-colors disabled:opacity-30 ${
              isVoiceActive
                ? "bg-red-500/20 text-red-400"
                : "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-emerald-500 dark:hover:text-emerald-400"
            }`}
          >
            <Mic className={`h-5 w-5 ${isVoiceActive ? "animate-pulse" : ""}`} />
            {isVoiceActive && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            )}
          </button>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0 && selectedVaultIds.length === 0) || disabled}
            title="Send message"
            className="p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-30 disabled:hover:bg-indigo-600"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>

        {/* Export Hint - Quick Reference for Document Export */}
        {showExportHint && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center justify-center gap-2 relative">
              <div className="flex items-center gap-2 justify-center">
                <Download className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-center">
                  <strong>Quick Export:</strong> Use <code className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px] font-mono">create the powerpoint</code>,{" "}
                  <code className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px] font-mono">export as pdf</code>,{" "}
                  <code className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px] font-mono">make an excel</code>, etc.
                </span>
              </div>
              <button
                onClick={() => setShowExportHint(false)}
                className="absolute right-0 text-emerald-400 hover:text-emerald-300 transition-colors flex-shrink-0"
                title="Hide hint"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image Generation Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Image</DialogTitle>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Describe the image you want
            </label>
            <TextareaAutosize
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleImageGen();
                }
              }}
              placeholder="A futuristic city at sunset..."
              minRows={3}
              maxRows={6}
              className="w-full resize-none rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowImageDialog(false)}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImageGen}
              disabled={!imagePrompt.trim()}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vault Attachment Modal */}
      <VaultAttachmentModal
        open={showVaultModal}
        onClose={() => setShowVaultModal(false)}
        selectedIds={selectedVaultIds}
        onSelectionChange={setSelectedVaultIds}
      />
    </div>
  );
}
