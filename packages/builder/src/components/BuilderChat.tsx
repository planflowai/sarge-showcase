"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Send, X, StopCircle, Paperclip, CheckCircle, Bookmark, Database, ImageIcon, MessageSquare, Hammer, Pencil, RefreshCw, Bot, Check, Image as ImageLucide } from "lucide-react";
import { type Attachment, readFileAsAttachment, formatFileSize } from "../lib/utils/attachments";
import { useBuilderChatStore } from "../stores/builderChatStore";
import { useChangesStore } from "../stores/changesStore";
import { usePromptLibraryStore } from "@sarge/core";
import MessageList from "./MessageList";
import BuilderMessageBubble from "./BuilderMessageBubble";
import ProgressCards, { useProgressSteps } from "./ProgressCards";
import { cn } from "@sarge/core";
import { Button } from "@/components/ui/button";
import { buildPromptWithContext } from "@sarge/core";
import { useKnowledgeStore } from "@sarge/core";
import { VaultAttachmentModal, getVaultDocumentsForContext } from "@sarge/chat";
import { useDraftStore, BUILDER_DRAFT_KEY } from "@sarge/core";
import { useBuilderModeStore, getBuilderSystemPrompt, getEditModeSystemPrompt, buildEditModePrompt } from "../stores/builderModeStore";
import { useBuilderStore } from "../stores/builderStore";
import { useThreadGuardianStore } from "@sarge/core";
import { startGuardian, stopGuardian, isGuardianRunning } from "@sarge/core";
import { shouldInjectContext, buildContextForModel } from "@sarge/core";
import { useBuilderHelpersStore } from "../stores/builderHelpersStore";
import HelperBubble from "./HelperBubble";
import { useStreamingUpdates } from "../hooks/useStreamingUpdates";
import { useAIHelpers } from "../hooks/useAIHelpers";

interface BuilderChatProps {
  selectedModel: string | null;
  selectedProvider: string;
  onOpenInEditor?: (code: string, language?: string) => void;
  onOpenPreview?: (code: string) => void;
  artifactCode?: string;
  onStreamingUpdate?: (code: string, isStreaming: boolean) => void;
  projectPath?: string | null;
  projectName?: string | null;
  projectFileTree?: string[];
  builderLogContent?: string | null;
  onViewDiff?: (filePath: string, originalContent: string, proposedContent: string) => void;
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
  onPromptSent?: (prompt: string) => void;
  onRefreshFileTree?: () => Promise<void>;
  autoApply?: boolean;
}

export default function BuilderChat({
  selectedModel,
  selectedProvider,
  onOpenInEditor,
  onOpenPreview,
  artifactCode = "",
  onStreamingUpdate,
  projectPath,
  projectName,
  projectFileTree = [],
  builderLogContent,
  onViewDiff,
  pendingPrompt,
  onPendingPromptConsumed,
  onPromptSent,
  onRefreshFileTree,
  autoApply: autoApplyProp,
}: BuilderChatProps) {
  const { messages, sending, hydrated, hydrate, sendMessage, generateImage, clearMessages, abortStream, prefilledInput, setPrefilledInput } = useBuilderChatStore();
  const addChange = useChangesStore(state => state.addChange);
  const addCustomPrompt = usePromptLibraryStore(state => state.addCustomPrompt);
  const [input, setInput] = useState("");

  // Draft persistence
  const { getDraft, setDraft, clearDraft, hydrated: draftHydrated, hydrate: hydrateDraft } = useDraftStore();

  // Builder mode (Plan vs Build) and Edit mode (Edit vs Generate)
  const { mode: builderMode, editMode, toggleMode, toggleEditMode, hydrated: modeHydrated, hydrate: hydrateMode } = useBuilderModeStore();
  const { autoApply, toggleAutoApply } = useBuilderStore();
  const [attachCode, setAttachCode] = useState(false);
  const [showSavePromptDialog, setShowSavePromptDialog] = useState(false);
  const [savePromptTitle, setSavePromptTitle] = useState("");
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [selectedVaultIds, setSelectedVaultIds] = useState<string[]>([]);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pending edit state — holds proposed changes awaiting user Apply/Reject
  const [pendingEdit, setPendingEdit] = useState<{
    original: string;
    modified: string;
    summary: { added: number; removed: number };
  } | null>(null);

  // Knowledge vault store
  const vaultDocuments = useKnowledgeStore((s) => s.documents);
  const vaultHydrated = useKnowledgeStore((s) => s.hydrated);
  const hydrateVault = useKnowledgeStore((s) => s.hydrate);

  useEffect(() => {
    if (!vaultHydrated) hydrateVault();
  }, [vaultHydrated, hydrateVault]);

  // AI Helpers store
  const { helpers, responses: helperResponses, getActiveHelpers, addResponse, updateResponse, setActiveHelper, hydrated: helpersHydrated, hydrate: hydrateHelpers } = useBuilderHelpersStore();

  useEffect(() => {
    if (!helpersHydrated) hydrateHelpers();
  }, [helpersHydrated, hydrateHelpers]);

  // Hydrate draft store on mount
  useEffect(() => {
    if (!draftHydrated) hydrateDraft();
  }, [draftHydrated, hydrateDraft]);

  // Hydrate builder mode store on mount
  useEffect(() => {
    if (!modeHydrated) hydrateMode();
  }, [modeHydrated, hydrateMode]);

  // Restore draft from store on mount
  useEffect(() => {
    if (draftHydrated) {
      const savedDraft = getDraft(BUILDER_DRAFT_KEY);
      if (savedDraft && !input) {
        setInput(savedDraft);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftHydrated]);

  // Save draft as user types (debounced via effect)
  useEffect(() => {
    if (draftHydrated) {
      setDraft(BUILDER_DRAFT_KEY, input);
    }
  }, [input, draftHydrated, setDraft]);

  // Get selected vault document names for pills
  const selectedVaultDocs = selectedVaultIds
    .map((id) => vaultDocuments.find((d) => d.id === id))
    .filter(Boolean) as { id: string; name: string }[];

  // Handle pending prompt from sidebar
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      onPendingPromptConsumed?.();
      // Focus the textarea
      textareaRef.current?.focus();
    }
  }, [pendingPrompt, onPendingPromptConsumed]);

  // Handle prefilled input from debate (or other sources)
  useEffect(() => {
    if (prefilledInput) {
      setInput(prefilledInput);
      setPrefilledInput(null);  // Clear after consuming
      // Focus the textarea
      textareaRef.current?.focus();
    }
  }, [prefilledInput, setPrefilledInput]);

  // Handle save custom prompt
  const handleSavePrompt = useCallback(() => {
    if (savePromptTitle.trim() && input.trim()) {
      addCustomPrompt(savePromptTitle.trim(), input.trim());
      setShowSavePromptDialog(false);
      setSavePromptTitle("");
    }
  }, [savePromptTitle, input, addCustomPrompt]);

  // Handle right-click on send button to save prompt
  const handleSendButtonContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setShowSavePromptDialog(true);
    }
  }, [input]);

  // Apply / Reject pending edit
  const handleApplyPendingEdit = useCallback(() => {
    if (!pendingEdit) return;
    onStreamingUpdate?.(pendingEdit.modified, false);
    setPendingEdit(null);
  }, [pendingEdit, onStreamingUpdate]);

  const handleRejectPendingEdit = useCallback(() => {
    setPendingEdit(null);
  }, []);

  // Progress steps for Claude Code-style progress cards
  const progress = useProgressSteps();

  // Get context status for UI
  const isLocalModel = selectedProvider === "ollama";

  // Hydrate on mount
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Thread Guardian lifecycle for Builder Chat
  // Builder uses a fixed conversation ID for its isolated chat
  const BUILDER_CONVERSATION_ID = 'builder-chat';
  const guardianEnabled = useThreadGuardianStore((s) => s.enabled);
  const isGuardianAllowed = useThreadGuardianStore((s) => s.isGuardianAllowed);

  useEffect(() => {
    // Start guardian for builder chat if enabled and allowed
    if (guardianEnabled && isGuardianAllowed('builder', BUILDER_CONVERSATION_ID)) {
      const timer = setTimeout(() => {
        startGuardian(BUILDER_CONVERSATION_ID);
      }, 500);
      return () => {
        clearTimeout(timer);
        if (isGuardianRunning()) {
          stopGuardian();
        }
      };
    }
    return () => {
      if (isGuardianRunning()) {
        stopGuardian();
      }
    };
  }, [guardianEnabled, isGuardianAllowed]);

  // Extract progress functions to avoid infinite loop
  const { startStep, finishProgress, isVisible: progressIsVisible } = progress;

  // Wrap callbacks with useCallback for stable references
  const handleStreamingUpdate = useCallback((code: string, isStreaming: boolean) => {
    if (!isStreaming) {
      setPendingEdit(null);
    }
    onStreamingUpdate?.(code, isStreaming);
  }, [onStreamingUpdate]);

  const handleViewDiff = useCallback((filePath: string, original: string, modified: string) => {
    if (filePath === '[Pending Edits]') {
      const summary = { added: 10, removed: 5 }; // Placeholder - will be computed by hook
      setPendingEdit({ original, modified, summary });
    }
    onViewDiff?.(filePath, original, modified);
  }, [onViewDiff]);

  // Use the new streaming updates hook
  const { pendingEdit: hookPendingEdit } = useStreamingUpdates({
    messages,
    sending,
    editMode,
    artifactCode,
    projectPath,
    projectName,
    selectedModel,
    autoApply,
    onStreamingUpdate: handleStreamingUpdate,
    onViewDiff: handleViewDiff,
    startStep,
    finishProgress,
    progressIsVisible,
  });

  // Sync pending edit from hook
  useEffect(() => {
    if (hookPendingEdit) {
      setPendingEdit(hookPendingEdit);
    }
  }, [hookPendingEdit]);

  // Use the AI helpers hook
  useAIHelpers({
    messages,
    sending,
    code: artifactCode || null,
    getActiveHelpers,
    addResponse,
    updateResponse,
    setActiveHelper,
  });

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(t);
  }, [messages, sending, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // ── Attachment handlers ──────────────────────────────────────────────
  const handleFilesSelected = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      if (file.size > 20 * 1024 * 1024) continue; // Skip files > 20MB
      const att = await readFileAsAttachment(file);
      setAttachments(prev => [...prev, att]);
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFilesSelected(imageFiles);
    }
  }, [handleFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFilesSelected(files);
    }
  }, [handleFilesSelected]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !selectedModel) return;
    const userMessage = input.trim() || (attachments.length > 0 ? '[Image attached]' : '');
    setInput("");
    clearDraft(BUILDER_DRAFT_KEY); // Clear persisted draft on send
    const vaultIdsToSend = [...selectedVaultIds]; // Copy before clearing
    setSelectedVaultIds([]); // Clear vault selection after send
    const imagesToSend = attachments.filter(a => a.isImage).map(a => a.content);
    setAttachments([]); // Clear attachments after send
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Clear any pending edit when user sends a new message
    setPendingEdit(null);

    // Start progress cards
    progress.startProgress();

    // Build vault context if documents are selected
    let vaultContext = "";
    if (vaultIdsToSend.length > 0) {
      const { docs } = getVaultDocumentsForContext(vaultDocuments, vaultIdsToSend);
      if (docs.length > 0) {
        const vaultParts = docs.map((d) =>
          `--- Knowledge Vault: ${d.name} ---\n${d.content}\n--- End of ${d.name} ---`
        );
        vaultContext = vaultParts.join("\n\n") + "\n\n";
      }
    }

    // Build Thread Guardian context if enabled
    let guardianContext = '';
    if (shouldInjectContext(BUILDER_CONVERSATION_ID)) {
      guardianContext = buildContextForModel(BUILDER_CONVERSATION_ID);
    }

    // Build prompt with context injection
    // Guardian and vault context go into the system prompt (see below), not the user message
    const promptWithContext = buildPromptWithContext({
      userMessage,
      activeFileContent: artifactCode,
      activeFilePath: projectPath ? undefined : "artifact",  // Only use "artifact" when no project
      projectPath: projectPath || undefined,
      projectName: projectName || undefined,
      projectFileTree: projectFileTree,
      builderLogContent: builderLogContent || undefined,
      provider: selectedProvider,
      attachCode,
    });

    // Reset attach toggle after sending (per CLAUDE.md: "resets to OFF after each message send")
    if (!isLocalModel) {
      setAttachCode(false);
    }

    // Track the prompt for component library
    onPromptSent?.(userMessage);

    // Determine system prompt based on modes
    let systemPrompt: string;
    let finalPrompt = promptWithContext;

    // Use Edit Mode if: we have existing code AND editMode is "edit" AND we're in build mode
    const hasExistingCode = artifactCode && artifactCode.trim().length > 50;
    const useEditMode = hasExistingCode && editMode === "edit" && builderMode === "build";

    if (useEditMode) {
      // Edit Mode: Include current code with line numbers and use edit-specific prompt
      systemPrompt = getEditModeSystemPrompt();
      // Build the edit mode prompt with current code context
      finalPrompt = buildEditModePrompt(artifactCode!, userMessage);
      console.log('[BuilderChat] Using Edit Mode - surgical changes expected');
    } else {
      // Generate Mode or no existing code: use regular mode-specific prompt
      // Pass isProjectMode flag so prompt adapts to artifact vs project mode
      const isProjectMode = !!projectPath;
      systemPrompt = getBuilderSystemPrompt(builderMode, isProjectMode);
      console.log('[BuilderChat] Using Generate Mode - full file generation', { isProjectMode });
    }

    // Append vault/guardian context to system prompt so it doesn't pollute the user message
    const contextAddition = [guardianContext, vaultContext].filter(Boolean).join('\n\n');
    if (contextAddition) {
      systemPrompt += '\n\n' + contextAddition;
    }

    // Inject priority instruction for project mode: generate entry point first for live preview
    if (projectPath && builderMode === 'build') {
      systemPrompt += '\n\n' + `PRIORITY: When building a project, generate the main entry point file FIRST (index.html, main.jsx, app.tsx, etc). This allows the preview to load immediately while you generate supporting files. Generate entry point as your FIRST FILE: block, then other files follow.`;
    }

    // Context is built — advance progress past "Reading context..."
    progress.startStep("analyze", "Sending to model...");

    // Pass both: display message (what user typed) and API prompt (with injected context)
    await sendMessage(userMessage, finalPrompt, selectedProvider, selectedModel, systemPrompt, imagesToSend.length > 0 ? imagesToSend : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle image generation
  const handleImageGen = async () => {
    if (!imagePrompt.trim() || !selectedModel) return;
    const prompt = imagePrompt.trim();
    setImagePrompt("");
    setShowImageDialog(false);
    await generateImage(prompt, selectedProvider, selectedModel);
  };

  // Check if provider supports image generation
  const supportsImageGen = ["openai", "xai", "google"].includes(selectedProvider);

  const noModel = !selectedModel;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-zinc-900">
      {/* Messages area */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="h-12 w-12 text-zinc-400 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {noModel ? "Select a model to start building" : "Start a conversation to build code"}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">
              Builder chat is isolated from main Chat
            </p>
          </div>
        </div>
      ) : (
        <>
          <MessageList
            messages={messages}
            onOpenInEditor={onOpenInEditor}
            onOpenPreview={onOpenPreview}
            projectPath={projectPath}
            projectName={projectName}
            onViewDiff={onViewDiff}
            autoApply={autoApply}
            onRefreshFileTree={onRefreshFileTree}
            onChangeTracked={(change) => {
              const correspondingMsg = messages.find(m => !m.isStreaming && m.role === 'assistant');
              addChange({
                filePath: change.filePath,
                action: change.action,
                summary: change.summary,
                model: selectedModel || 'unknown',
                provider: selectedProvider,
                messageId: correspondingMsg?.id || '',
                status: change.status,
              });
            }}
          />

          {/* Claude Code-style progress cards */}
          <ProgressCards steps={progress.steps} isVisible={progress.isVisible} />

          {/* AI Helper responses */}
          {helperResponses.length > 0 && (
            <div className="space-y-2 px-4 pb-4">
              {helperResponses.map((response) => {
                const helper = helpers.find((h) => h.id === response.helperId);
                return (
                  <HelperBubble
                    key={response.id}
                    response={response}
                    helperType={helper?.type}
                    onDismiss={() => {
                      useBuilderHelpersStore.getState().updateResponse(response.id, { status: 'complete' });
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Pending Edit Banner — shown when AI proposes edits awaiting user approval */}
      {pendingEdit && (
        <div className="border-t border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-center gap-2 flex-shrink-0">
          <Pencil className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Pending Changes</span>
          <span className="text-xs text-zinc-500 flex-1">
            +{pendingEdit.summary.added} &minus;{pendingEdit.summary.removed} lines
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRejectPendingEdit}
            className="h-7 px-2 text-xs text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
          >
            <X className="h-3 w-3 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleApplyPendingEdit}
            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="h-3 w-3 mr-1" />
            Apply
          </Button>
        </div>
      )}

      {/* Input area */}
      <div
        className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-3"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div>
          {/* Vault attachment pills */}
          {selectedVaultDocs.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedVaultDocs.map((doc) => (
                <div
                  key={`vault-${doc.id}`}
                  className="flex items-center gap-1.5 rounded-md border border-indigo-500/50 bg-indigo-600/20 px-2 py-1 text-xs text-indigo-300"
                >
                  <Database className="h-3 w-3 text-indigo-400" />
                  <span className="max-w-[100px] truncate font-medium">{doc.name}</span>
                  <button
                    onClick={() => setSelectedVaultIds((prev) => prev.filter((x) => x !== doc.id))}
                    className="rounded p-0.5 text-indigo-400 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Image attachment pills */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 rounded-md border border-cyan-500/50 bg-cyan-600/20 px-2 py-1 text-xs text-cyan-300"
                >
                  {att.isImage ? (
                    <img
                      src={att.content}
                      alt={att.name}
                      className="h-6 w-6 rounded object-cover"
                    />
                  ) : (
                    <ImageLucide className="h-3 w-3 text-cyan-400" />
                  )}
                  <span className="max-w-[80px] truncate font-medium">{att.name}</span>
                  <span className="text-[9px] text-cyan-400/70">{formatFileSize(att.size)}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="rounded p-0.5 text-cyan-400 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input for image picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesSelected(e.target.files);
              e.target.value = ''; // Reset so same file can be selected again
            }}
          />

          {/* Text area - full width on top */}
          <div className="relative mb-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={noModel ? "Select a model first..." : "Describe what you want to build... (paste or drop images here)"}
              disabled={noModel || sending}
              rows={3}
              className={cn(
                "w-full resize-none rounded-lg border px-4 py-3 text-sm",
                "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700",
                "text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
                "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            />
          </div>

          {/* Action buttons - wrapped layout */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Left group: Vault + Attach + Image */}
            <div className="flex items-center gap-1.5">
              {/* Knowledge Vault button */}
              <Button
                variant="ghost"
                size="sm"
                disabled={noModel || sending}
                onClick={() => setShowVaultModal(true)}
                className={cn(
                  "h-8 px-2 gap-1 transition-colors",
                  selectedVaultIds.length > 0
                    ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
                    : "text-zinc-500 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
                title="Attach from Knowledge Vault"
              >
                <Database className="h-3.5 w-3.5" />
                {selectedVaultIds.length > 0 && (
                  <span className="text-[10px] font-bold">{selectedVaultIds.length}</span>
                )}
              </Button>

              {/* Attach button - different behavior for local vs cloud */}
              {isLocalModel ? (
                <div
                  className="flex items-center gap-1 h-8 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  title="Context is automatically attached for local models"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium">Auto</span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={noModel || sending}
                  onClick={() => setAttachCode(!attachCode)}
                  className={cn(
                    "h-8 px-2 gap-1 transition-colors",
                    attachCode
                      ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
                      : "text-zinc-500 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                  title={attachCode ? "Context will be attached" : "Click to attach editor code to prompt"}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium">{attachCode ? "On" : "Off"}</span>
                </Button>
              )}

              {/* Image Generation button */}
              {supportsImageGen && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={noModel || sending}
                  onClick={() => setShowImageDialog(true)}
                  className="h-8 w-8 p-0 text-zinc-500 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Generate image"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* Attach Image/Screenshot button */}
              <Button
                variant="ghost"
                size="sm"
                disabled={noModel || sending}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "h-8 px-2 gap-1 transition-colors",
                  attachments.length > 0
                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20"
                    : "text-zinc-500 hover:text-cyan-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
                title="Attach image or screenshot (or paste/drag-drop)"
              >
                <ImageLucide className="h-3.5 w-3.5" />
                {attachments.length > 0 ? (
                  <span className="text-[10px] font-bold">{attachments.length}</span>
                ) : (
                  <span className="text-[10px] font-medium">Img</span>
                )}
              </Button>
            </div>

            {/* Center group: Mode toggles */}
            <div className="flex items-center gap-1.5">
              {/* Plan/Build Mode Toggle */}
              <div
                className="flex items-center h-8 rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden"
                title={builderMode === "plan" ? "Plan mode: AI will discuss and plan" : "Build mode: AI will write files"}
              >
                <button
                  onClick={() => toggleMode()}
                  disabled={sending}
                  className={cn(
                    "flex items-center gap-1 px-2 h-full text-[11px] font-medium transition-colors",
                    builderMode === "plan"
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  )}
                >
                  <MessageSquare className="h-3 w-3" />
                  Plan
                </button>
                <button
                  onClick={() => toggleMode()}
                  disabled={sending}
                  className={cn(
                    "flex items-center gap-1 px-2 h-full text-[11px] font-medium transition-colors",
                    builderMode === "build"
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  )}
                >
                  <Hammer className="h-3 w-3" />
                  Build
                </button>
              </div>

              {/* Edit/Generate Mode Toggle - only shown when in Build mode and there's existing code */}
              {builderMode === "build" && artifactCode && artifactCode.trim().length > 50 && (
                <div
                  className="flex items-center h-8 rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden"
                  title={editMode === "edit" ? "Edit mode: surgical changes" : "Generate mode: regenerate file"}
                >
                  <button
                    onClick={() => toggleEditMode()}
                    disabled={sending}
                    className={cn(
                      "flex items-center gap-1 px-2 h-full text-[11px] font-medium transition-colors",
                      editMode === "edit"
                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => toggleEditMode()}
                    disabled={sending}
                    className={cn(
                      "flex items-center gap-1 px-2 h-full text-[11px] font-medium transition-colors",
                      editMode === "generate"
                        ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    )}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regen
                  </button>
                </div>
              )}

              {/* Auto Apply Toggle - shown in project mode */}
              {projectPath && (
                <button
                  onClick={() => toggleAutoApply()}
                  disabled={sending}
                  title={autoApply ? "Auto Apply: ON (files apply immediately)" : "Auto Apply: OFF (click to apply)"}
                  className={cn(
                    "px-2 h-8 rounded-md border text-[11px] font-medium transition-colors",
                    autoApply
                      ? "bg-green-500/20 border-green-500/50 text-green-600 dark:text-green-400"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  {autoApply ? "✓ Auto" : "Manual"}
                </button>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1 min-w-[10px]" />

            {/* Send/Stop button */}
            {sending ? (
              <Button
                onClick={abortStream}
                className="h-8 px-3 gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                title="Stop generation"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Stop</span>
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                onContextMenu={handleSendButtonContextMenu}
                disabled={noModel || !input.trim()}
                className="h-8 px-3 gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white"
                title="Send message (right-click to save as prompt)"
              >
                <Send className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Send</span>
              </Button>
            )}
          </div>

          {/* Clear chat button */}
          {messages.length > 0 && (
            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                disabled={sending}
                className="h-6 gap-1 px-2 text-[10px] text-zinc-500 hover:text-red-400 disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Clear chat
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Save Prompt Dialog */}
      {showSavePromptDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-4 w-80 mx-4">
            <div className="flex items-center gap-2 mb-3">
              <Bookmark className="h-4 w-4 text-indigo-500" />
              <h3 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Save as Prompt</h3>
            </div>

            <div className="mb-3">
              <label className="text-xs text-zinc-500 mb-1 block">Prompt Title</label>
              <input
                type="text"
                value={savePromptTitle}
                onChange={(e) => setSavePromptTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && savePromptTitle.trim()) {
                    handleSavePrompt();
                  }
                  if (e.key === 'Escape') {
                    setShowSavePromptDialog(false);
                    setSavePromptTitle("");
                  }
                }}
                placeholder="e.g., Dark mode toggle"
                className="w-full px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="text-xs text-zinc-500 mb-1 block">Prompt Content</label>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 p-2 rounded max-h-20 overflow-y-auto">
                {input.slice(0, 200)}{input.length > 200 ? '...' : ''}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSavePromptDialog(false);
                  setSavePromptTitle("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSavePrompt}
                disabled={!savePromptTitle.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Attachment Modal */}
      <VaultAttachmentModal
        open={showVaultModal}
        onClose={() => setShowVaultModal(false)}
        selectedIds={selectedVaultIds}
        onSelectionChange={setSelectedVaultIds}
      />

      {/* Image Generation Dialog */}
      {showImageDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-4 w-96 mx-4">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="h-4 w-4 text-indigo-500" />
              <h3 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Generate Image</h3>
            </div>

            <div className="mb-3">
              <label className="text-xs text-zinc-500 mb-1 block">Describe the image you want</label>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && imagePrompt.trim()) {
                    e.preventDefault();
                    handleImageGen();
                  }
                  if (e.key === 'Escape') {
                    setShowImageDialog(false);
                    setImagePrompt("");
                  }
                }}
                placeholder="A futuristic city at sunset..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 resize-none"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowImageDialog(false);
                  setImagePrompt("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImageGen}
                disabled={!imagePrompt.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
