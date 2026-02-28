"use client";

/* eslint-disable @typescript-eslint/no-empty-object-type */
// FileSystem Access API types (for webkitGetAsEntry)
interface FileSystemEntry { isFile: boolean; isDirectory: boolean; name: string; }
interface FileSystemFileEntry extends FileSystemEntry { file(cb: (f: File) => void, err?: () => void): void; }
interface FileSystemDirectoryEntry extends FileSystemEntry { createReader(): FileSystemDirectoryReader; }
interface FileSystemDirectoryReader { readEntries(cb: (entries: FileSystemEntry[]) => void, err?: () => void): void; }

import { useState, useRef, useCallback, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  Send, ImageIcon, Mic, Paperclip, X, FileIcon, ImageIcon as ImgIcon,
  BookText, Shield, ShieldAlert, ShieldCheck, ClipboardCopy, Check,
  Database, Download, Trash2, Clock, Columns2,
} from "lucide-react";
import { usePromptStore } from "@sarge/core";
import { useProviderStore } from "@sarge/core";
import { useModelStore } from "@sarge/core";
import { useKnowledgeStore } from "@sarge/core";
import { useDraftStore } from "@sarge/core";
import { providers } from "@sarge/core";
import { VaultAttachmentModal } from "./VaultAttachmentModal";
import { ProviderBar } from "./ProviderBar";
import { ModelPanel } from "./ModelPanel";
import { HistoryDrawer } from "./HistoryDrawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { VoiceState, Provider } from "@sarge/core";
import { useParallelChatStore } from "../../stores/parallelChatStore";
import { useMessageStore } from "../../stores/messageStore";

// ─── Attachment types (shared) ───────────────────────────────────────────────
import { type Attachment, readFileAsAttachment, formatFileSize } from "../../lib/utils/attachments";
export { type Attachment, readFileAsAttachment, formatFileSize } from "../../lib/utils/attachments";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface VaultSelection {
  id: string;
  name: string;
}

interface InputAreaProps {
  conversationId?: string;
  onSend: (content: string, attachments?: Attachment[], vaultIds?: string[]) => void;
  onImageGen?: (prompt: string) => void;
  onCopyThread?: () => void;
  hasMessages?: boolean;
  supportsImageGen?: boolean;
  disabled?: boolean;
  voiceState?: VoiceState;
  supportsVoice?: boolean;
  onVoiceStart?: () => void;
  onVoiceStop?: () => void;
  onVoiceInterrupt?: () => void;
}

export function InputArea({
  conversationId,
  onSend,
  onImageGen,
  onCopyThread,
  hasMessages,
  supportsImageGen,
  disabled,
  voiceState = "idle",
  supportsVoice = false,
  onVoiceStart = () => {},
  onVoiceStop = () => {},
  onVoiceInterrupt = () => {},
}: InputAreaProps) {
  // Draft persistence
  const { getDraft, setDraft, clearDraft, hydrated: draftHydrated, hydrate: hydrateDraft } = useDraftStore();
  const draftKey = conversationId ? `chat-${conversationId}` : null;

  const [input, setInput] = useState("");
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [selectedVaultIds, setSelectedVaultIds] = useState<string[]>([]);
  const [modelPanelProvider, setModelPanelProvider] = useState<Provider | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [threadCopied, setThreadCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  // Stores
  const vaultDocuments = useKnowledgeStore((s) => s.documents);
  const vaultHydrated = useKnowledgeStore((s) => s.hydrated);
  const hydrateVault = useKnowledgeStore((s) => s.hydrate);
  const currentProvider = useProviderStore((s) => s.currentProvider);
  const currentModel = useProviderStore((s) => s.currentModel);
  const setProvider = useProviderStore((s) => s.setProvider);
  const setModel = useProviderStore((s) => s.setModel);
  const getEffectiveModels = useModelStore((s) => s.getEffectiveModels);
  const prompts = usePromptStore((s) => s.prompts);
  const promptHydrated = usePromptStore((s) => s.hydrated);
  const hydratePrompts = usePromptStore((s) => s.hydrate);
  const messages = useMessageStore((s) => s.messages);
  const clearMessages = useMessageStore((s) => s.clearMessages);

  const { enabled: parallelEnabled, toggleParallelMode, hydrated: parallelHydrated, hydrate: hydrateParallel } = useParallelChatStore();

  // Hydration
  useEffect(() => { if (!vaultHydrated) hydrateVault(); }, [vaultHydrated, hydrateVault]);
  useEffect(() => { if (!draftHydrated) hydrateDraft(); }, [draftHydrated, hydrateDraft]);
  useEffect(() => { if (!promptHydrated) hydratePrompts(); }, [promptHydrated, hydratePrompts]);
  useEffect(() => { if (!parallelHydrated) hydrateParallel(); }, [parallelHydrated, hydrateParallel]);

  // Draft restore
  useEffect(() => {
    if (draftKey && draftHydrated) {
      const savedDraft = getDraft(draftKey);
      if (savedDraft) setInput(savedDraft);
    }
  }, [draftKey, draftHydrated, getDraft]);

  // Draft save
  useEffect(() => {
    if (draftKey && draftHydrated) {
      if (input) setDraft(draftKey, input);
      else clearDraft(draftKey);
    }
  }, [input, draftKey, draftHydrated, setDraft, clearDraft]);

  // Vault docs for pills
  const selectedVaultDocs = selectedVaultIds
    .map((id) => vaultDocuments.find((d) => d.id === id))
    .filter(Boolean) as { id: string; name: string }[];

  const removeVaultAttachment = (id: string) => {
    setSelectedVaultIds((prev) => prev.filter((x) => x !== id));
  };

  // Protection status
  const [protectionStatus, setProtectionStatus] = useState<'idle' | 'detected' | 'neutralized' | null>(null);

  useEffect(() => {
    if (protectionStatus) {
      const timer = setTimeout(() => setProtectionStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [protectionStatus]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
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
    if (draftKey) clearDraft(draftKey);
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

  const handleCopyThread = () => {
    if (onCopyThread) {
      onCopyThread();
    } else {
      // Fallback: copy messages to clipboard
      const visible = messages.filter((m) => m.role !== "system");
      if (!visible.length) return;
      const text = visible.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setThreadCopied(true);
    setTimeout(() => setThreadCopied(false), 2000);
  };

  const handleSaveChat = () => {
    const visible = messages.filter((m) => m.role !== "system");
    if (!visible.length) return;
    const lines: string[] = [
      `# Chat Export`, ``,
      `**Exported:** ${new Date().toLocaleString()}`,
      `**Model:** ${currentModel} (${currentProvider})`, ``, `---`, ``,
    ];
    for (const msg of visible) {
      const label = msg.role === "user" ? "**You**" : `**Assistant** (${(msg as { model?: string }).model || currentModel})`;
      const time = new Date(msg.timestamp).toLocaleTimeString();
      lines.push(`### ${label} — ${time}`, ``, msg.content, ``);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

  const handleClearChat = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearMessages();
    if (conversationId) {
      try { localStorage.removeItem(`messages_${conversationId}`); } catch { /* ignore */ }
    }
    setConfirmClear(false);
  };

  // Provider click — toggle model panel
  const handleProviderClick = (providerId: Provider) => {
    if (modelPanelProvider === providerId) {
      // Same provider clicked — close panel
      setModelPanelProvider(null);
    } else {
      // Different provider — switch and open panel
      setProvider(providerId);
      const models = getEffectiveModels(providerId);
      if (models.length > 0) setModel(models[0].id);
      setModelPanelProvider(providerId);
    }
  };

  const handleModelSelect = (modelId: string) => {
    setModel(modelId);
    // If a different provider was opened for browsing, switch to it
    if (modelPanelProvider && modelPanelProvider !== currentProvider) {
      setProvider(modelPanelProvider);
    }
    setModelPanelProvider(null);
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
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

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
            } else { resolve([]); }
          });
        };
        let usedEntries = false;
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) { usedEntries = true; allFiles.push(...(await readEntry(entry))); }
        }
        if (usedEntries && allFiles.length > 0) { await addFiles(allFiles); return; }
      }
      const files = e.dataTransfer.files;
      if (files.length > 0) await addFiles(files);
    },
    [addFiles]
  );

  const handleVoiceClick = () => {
    if (!supportsVoice) return;
    switch (voiceState) {
      case "idle": onVoiceStart(); break;
      case "speaking": onVoiceInterrupt(); break;
      case "listening": case "processing": onVoiceStop(); break;
    }
  };

  const isVoiceActive = voiceState !== "idle";
  const visibleMessages = messages.filter((m) => m.role !== "system");
  const hasVisibleMessages = hasMessages || visibleMessages.length > 0;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={dropRef}
        className="relative bg-zinc-950 px-8 pt-3 pb-4"
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

        {/* Model panel — slides up from bottom strip */}
        {modelPanelProvider && (
          <ModelPanel
            provider={modelPanelProvider}
            currentModel={currentModel}
            onSelectModel={handleModelSelect}
            onClose={() => setModelPanelProvider(null)}
          />
        )}

        <div className="mx-auto w-full max-w-[1680px]">
          {/* Protection Status Badge */}
          {protectionStatus && (
            <div className={`mb-2 flex items-center justify-center gap-2 py-2 px-4 rounded-lg animate-pulse ${
              protectionStatus === 'detected'
                ? 'bg-red-500/20 border border-red-500/50'
                : 'bg-emerald-500/20 border border-emerald-500/50'
            }`}>
              {protectionStatus === 'detected' ? (
                <><ShieldAlert className="h-5 w-5 text-red-400" /><span className="text-sm font-bold text-red-400">Poison Detected</span></>
              ) : (
                <><ShieldCheck className="h-5 w-5 text-emerald-400" /><span className="text-sm font-bold text-emerald-400">Poison Neutralized</span></>
              )}
            </div>
          )}

          {/* Attachment chips */}
          {(attachments.length > 0 || selectedVaultDocs.length > 0) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedVaultDocs.map((doc) => (
                <div key={`vault-${doc.id}`} className="flex items-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-600/20 px-3 py-1.5 text-xs text-indigo-300">
                  <Database className="h-4 w-4 text-indigo-400" />
                  <span className="max-w-[140px] truncate font-medium">{doc.name}</span>
                  <button onClick={() => removeVaultAttachment(doc.id)} className="ml-1 rounded p-0.5 text-indigo-400 hover:text-red-400 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-300">
                  {att.isImage ? <ImgIcon className="h-4 w-4 text-indigo-400" /> : <FileIcon className="h-4 w-4 text-zinc-400" />}
                  <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                  <span className="text-zinc-500">{formatFileSize(att.size)}</span>
                  <button onClick={() => removeAttachment(att.id)} className="ml-1 rounded p-0.5 text-zinc-500 hover:text-red-400 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Row 1: Provider pills */}
          <ProviderBar
            activeProvider={currentProvider}
            activeModel={currentModel}
            openProvider={modelPanelProvider}
            onProviderClick={handleProviderClick}
          />

          {/* Row 3: Input row — [Toggle] [Textarea 60%] [Icons] [Send] */}
          <div className="flex items-center gap-4 mt-2">
            {/* Single/Multi toggle */}
            <div className="flex items-center rounded-lg bg-zinc-800/80 border border-zinc-700/40 p-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => { if (parallelEnabled) toggleParallelMode(); }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  !parallelEnabled
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => { if (!parallelEnabled) toggleParallelMode(); }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  parallelEnabled
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Columns2 className="h-3 w-3" />
                Multi
              </button>
            </div>

            {/* Text input — 60% width */}
            <div className="flex-[0_1_60%] min-w-0">
              <TextareaAutosize
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  attachments.length > 0
                    ? "Add a message about your files..."
                    : "Type a message... (Enter to send, Shift+Enter for new line)"
                }
                minRows={1}
                maxRows={6}
                disabled={disabled}
                className="w-full resize-none rounded-xl bg-zinc-900 px-5 py-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50 border border-zinc-800 focus:border-zinc-700 transition-colors"
              />
            </div>

            {/* Icon bar — spread out */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* History */}
              <button
                onClick={() => setShowHistory(true)}
                title="Conversation history"
                className="p-2 rounded-lg text-orange-500/60 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
              >
                <Clock className="h-5 w-5" />
              </button>

              {/* Save Chat */}
              <button
                onClick={handleSaveChat}
                disabled={!hasVisibleMessages}
                title="Save chat as markdown"
                className="p-2 rounded-lg text-orange-500/60 hover:text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-30"
              >
                {saveFeedback ? <Check className="h-5 w-5 text-emerald-400" /> : <Download className="h-5 w-5" />}
              </button>

              {/* Clear Chat */}
              <button
                onClick={handleClearChat}
                disabled={!hasVisibleMessages}
                title={confirmClear ? "Click again to confirm" : "Clear chat"}
                className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${
                  confirmClear
                    ? "text-red-400 bg-red-500/15 animate-pulse"
                    : "text-orange-500/60 hover:text-red-400 hover:bg-red-500/10"
                }`}
              >
                <Trash2 className="h-5 w-5" />
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-zinc-700/40" />

              {/* Saved Prompts */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={disabled}
                    title="Load saved prompt"
                    className="p-2 rounded-lg text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-30"
                  >
                    <BookText className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-72 max-h-80 overflow-y-auto bg-zinc-900 border-zinc-700">
                  {prompts.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-zinc-500">
                      <p>No saved prompts</p>
                      <a href="/settings" className="mt-1 inline-block text-xs text-orange-400 hover:underline">Create in Settings &rarr;</a>
                    </div>
                  ) : (
                    prompts.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => setInput(p.content)} className="flex flex-col items-start gap-0.5 cursor-pointer">
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
                className="p-2 rounded-lg text-orange-500/60 hover:text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-30"
              >
                <ImageIcon className="h-5 w-5" />
              </button>

              {/* Export / Copy Thread */}
              {hasVisibleMessages && (
                <button
                  onClick={handleCopyThread}
                  disabled={disabled}
                  title="Copy thread to clipboard"
                  className="p-2 rounded-lg text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-30"
                >
                  {threadCopied ? <Check className="h-5 w-5 text-emerald-400" /> : <ClipboardCopy className="h-5 w-5" />}
                </button>
              )}

              {/* Knowledge Vault */}
              <button
                onClick={() => setShowVaultModal(true)}
                disabled={disabled}
                title="Attach from Knowledge Vault"
                className={`relative p-2 rounded-lg transition-colors disabled:opacity-30 ${
                  selectedVaultIds.length > 0
                    ? "bg-amber-500/15 text-amber-400"
                    : "text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10"
                }`}
              >
                <Database className="h-5 w-5" />
                {selectedVaultIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {selectedVaultIds.length}
                  </span>
                )}
              </button>

              {/* Attach */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                title="Attach files"
                className="p-2 rounded-lg text-orange-500/60 hover:text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-30"
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
                    : "text-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10"
                }`}
              >
                <Mic className={`h-5 w-5 ${isVoiceActive ? "animate-pulse" : ""}`} />
                {isVoiceActive && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
              </button>

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0 && selectedVaultIds.length === 0) || disabled}
                title="Send message"
                className="p-2.5 rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-all hover:shadow-[0_0_14px_rgba(249,115,22,0.4)] disabled:opacity-30 disabled:hover:bg-orange-600 disabled:hover:shadow-none"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

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

        {/* Image Generation Dialog */}
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-200 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Image</DialogTitle>
            </DialogHeader>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Describe the image you want</label>
              <TextareaAutosize
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleImageGen(); } }}
                placeholder="A futuristic city at sunset..."
                minRows={3}
                maxRows={6}
                className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowImageDialog(false)} className="text-zinc-400">Cancel</Button>
              <Button onClick={handleImageGen} disabled={!imagePrompt.trim()} className="bg-orange-600 text-white hover:bg-orange-500">Generate</Button>
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

      {/* History Drawer — rendered as fixed overlay */}
      <HistoryDrawer open={showHistory} onClose={() => setShowHistory(false)} />
    </>
  );
}
