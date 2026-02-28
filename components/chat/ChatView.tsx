"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { useMessageStore } from "@/lib/stores/messageStore";
import { useProviderStore } from "@/lib/stores/providerStore";
import { useModelStore } from "@/lib/stores/modelStore";
import { useConversationStore } from "@/lib/stores/conversationStore";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { providers } from "@/lib/providers";
import { getOllamaFriendlyName } from "@/lib/ollamaModelGroups";
import { parseVoiceCommand, type NicknameEntry } from "@/lib/voice/voiceCommands";
import { useVoiceChat } from "@/lib/voice/useVoiceChat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { InputArea, type Attachment } from "@/components/chat/InputArea";
import { getVaultDocumentsForContext } from "@/components/chat/VaultAttachmentModal";
import { useKnowledgeStore } from "@/lib/stores/knowledgeStore";
import { VoiceIndicator } from "@/components/chat/VoiceIndicator";
import { DebateView } from "@/components/debate/DebateView";
import { TestModeView } from "@/components/test/TestModeView";
import { ForensicLogView } from "@/components/forensic/ForensicLogView";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { exportChatToPDF } from "@/lib/export/pdf";
import { exportChatToCSV } from "@/lib/export/csv";
import { detectExportIntent, formatLabels, type ExportFormat } from "@/lib/export/exportDetector";
import {
  generateAndDownloadPptx,
  generateAndDownloadXlsx,
  generateAndDownloadPdf,
  generateAndDownloadDocx,
  generateAndDownloadCsv,
  generateAndDownloadZip,
} from "@/lib/export/chatDocumentExport";
import { useUIStore } from "@/lib/stores/uiStore";
import { Button } from "@/components/ui/button";
import { FileText, Download, Bot, Sparkles, MessageSquare, Zap, Settings, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThreadGuardianStore } from "@/lib/stores/threadGuardianStore";
import { useParallelChatStore } from "@/lib/stores/parallelChatStore";
import { startGuardian, stopGuardian, isGuardianRunning } from "@/lib/threadGuardian/engine";
import { getActiveWarnings, getGuardianSummary } from "@/lib/threadGuardian/contextBuilder";
import ThreadGuardianIndicator from "@/components/chat/ThreadGuardianIndicator";

// Store for builder prompt to send between pages
export const useBuilderPromptStore = create<{
  pendingPrompt: string | null;
  setPendingPrompt: (prompt: string | null) => void;
}>((set) => ({
  pendingPrompt: null,
  setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
}));

// Multi-Chat Mode Toggle Component
function MultiChatModeToggle() {
  const { enabled, toggleParallelMode, hydrated, hydrate } = useParallelChatStore();

  // Hydrate on mount
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return (
    <div className="flex items-center rounded-lg bg-zinc-800/50 p-0.5">
      <button
        type="button"
        onClick={() => toggleParallelMode()}
        className={cn(
          "px-2 py-1 text-[10px] font-medium rounded-md transition-all",
          !enabled
            ? "bg-zinc-700 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-300"
        )}
      >
        Single
      </button>
      <button
        type="button"
        onClick={() => toggleParallelMode()}
        className={cn(
          "px-2 py-1 text-[10px] font-medium rounded-md transition-all flex items-center gap-1",
          enabled
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-300"
        )}
      >
        <Columns2 className="h-3 w-3" />
        Multi-Chat
      </button>
    </div>
  );
}

interface ChatViewProps {
  conversationId: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const router = useRouter();
  const { messages, loading, sending, loadMessages, sendMessage, generateImage } = useMessageStore();
  const { currentProvider, currentModel, setProvider, setModel, summarizeForCloud, sanitizeForCloud } = useProviderStore();
  const { nicknames, getEffectiveModels, getDisplayName, voicePersona, setVoicePersona } = useModelStore();
  const debate = useDebateStore((s) => s.debate);
  const showingSetup = useDebateStore((s) => s.showingSetup);
  const debateHidden = useDebateStore((s) => s.debateHidden);
  const openDebate = useDebateStore((s) => s.openDebate);
  const setSourceConversation = useDebateStore((s) => s.setSourceConversation);
  const showingTestMode = useTestModeStore((s) => s.showingTestMode);
  const testModeHidden = useTestModeStore((s) => s.testModeHidden);
  const openTestMode = useTestModeStore((s) => s.openTestMode);
  const showingForensicLog = useForensicLogStore((s) => s.showingForensicLog);
  const openForensicLog = useForensicLogStore((s) => s.openForensicLog);
  const showToast = useUIStore((s) => s.showToast);
  const setPendingPrompt = useBuilderPromptStore((s) => s.setPendingPrompt);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeProvider = providers.find((p) => p.id === currentProvider);
  const supportsVoice = activeProvider?.supportsVoice ?? false;
  const supportsImageGen = ["openai", "xai", "google"].includes(currentProvider);

  const handleImageGen = async (prompt: string) => {
    await generateImage(conversationId, prompt, currentProvider, currentModel);
  };

  const handleDebateThread = () => {
    setSourceConversation(conversationId);
    openDebate();
  };

  const handleCopyThread = async () => {
    if (messages.length === 0) return;
    const threadText = messages
      .map((msg) => `[${msg.role === "user" ? "User" : msg.model || "Assistant"}]: ${msg.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(threadText);
      showFeedback("Thread copied to clipboard");
    } catch {
      showFeedback("Failed to copy thread");
    }
  };

  // Build nickname entries for voice command matching (memoized to prevent unnecessary recomputation)
  const nicknameEntries: NicknameEntry[] = useMemo(() => {
    const entries: NicknameEntry[] = [];
    for (const [modelId, nickname] of Object.entries(nicknames)) {
      let found = false;
      // Find which provider this model belongs to
      for (const p of providers) {
        const allModels = getEffectiveModels(p.id);
        if (allModels.some((m) => m.id === modelId)) {
          entries.push({ modelId, nickname, provider: p.id as import("@/lib/types").Provider });
          found = true;
          break;
        }
      }
      // If not found in any provider's effective models (e.g. Ollama live models),
      // assume it's an Ollama model since those aren't registered in modelStore
      if (!found) {
        entries.push({ modelId, nickname, provider: "ollama" as import("@/lib/types").Provider });
      }
    }
    return entries;
  }, [nicknames, getEffectiveModels]);

  const showFeedback = useCallback((msg: string) => {
    setCommandFeedback(msg);
    setTimeout(() => setCommandFeedback(null), 3000);
  }, []);

  const announceSwitch = useCallback((displayName: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${displayName} here`);
      utterance.rate = 1.1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleTranscript = useCallback(
    (text: string, role: "user" | "assistant"): boolean => {
      if (!text.trim()) return false;

      if (role === "user") {
        const command = parseVoiceCommand(text, nicknameEntries);
        if (command) {
          if (command.type === "switch_model") {
            setProvider(command.provider);
            setModel(command.modelId);
            showFeedback(`Switched to ${command.displayName}`);
            announceSwitch(command.displayName);
          } else if (command.type === "switch_provider") {
            setProvider(command.provider);
            showFeedback(`Switched to ${command.displayName}`);
            announceSwitch(command.displayName);
          } else if (command.type === "switch_voice") {
            setVoicePersona(command.persona);
            showFeedback(`Voice: ${command.displayName}`);
            announceSwitch(command.displayName);
          } else if (command.type === "start_debate") {
            openDebate();
            showFeedback("Opening debate...");
          }
          return true; // Was a command — caller should skip AI processing
        }
      }

      // Add voice transcript to chat display
      const { addMessage } = useMessageStore.getState();
      addMessage({
        id: crypto.randomUUID(),
        conversationId,
        role,
        content: text.trim(),
        provider: currentProvider as import("@/lib/types").Provider,
        model: currentModel,
        timestamp: new Date(),
      });
      return false;
    },
    [setProvider, setModel, setVoicePersona, openDebate, showFeedback, announceSwitch, nicknameEntries, conversationId, currentProvider, currentModel]
  );

  const handleVoiceError = useCallback((error: string) => {
    setVoiceError(error);
    setTimeout(() => setVoiceError(null), 5000);
  }, []);

  const currentSpeaker = voicePersona !== "none" ? voicePersona : undefined;

  const { voiceState, start, stop, interrupt } = useVoiceChat({
    provider: currentProvider,
    model: currentModel,
    speaker: currentSpeaker,
    onTranscript: handleTranscript,
    onError: handleVoiceError,
  });

  // Load messages when conversation changes
  useEffect(() => {
    loadMessages(conversationId);
  }, [conversationId, loadMessages]);

  // Thread Guardian lifecycle management
  const guardianEnabled = useThreadGuardianStore((s) => s.enabled);
  const isGuardianAllowed = useThreadGuardianStore((s) => s.isGuardianAllowed);

  useEffect(() => {
    // Start guardian when conversation loads (if enabled and allowed for chat mode)
    if (guardianEnabled && isGuardianAllowed('chat', conversationId)) {
      // Small delay to ensure store is hydrated
      const timer = setTimeout(() => {
        startGuardian(conversationId);
      }, 500);
      return () => {
        clearTimeout(timer);
        // Stop guardian when unmounting or switching conversations
        if (isGuardianRunning()) {
          stopGuardian();
        }
      };
    }
    return () => {
      // Cleanup: stop guardian if running
      if (isGuardianRunning()) {
        stopGuardian();
      }
    };
  }, [conversationId, guardianEnabled, isGuardianAllowed]);

  // Scroll to bottom on new messages or sending state change
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "n") {
        e.preventDefault();
        const { createConversation } = useConversationStore.getState();
        const { clearMessages } = useMessageStore.getState();
        clearMessages();
        createConversation("New Conversation");
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  // Show forensic log view when active
  if (showingForensicLog) {
    return <ForensicLogView />;
  }

  // Show test mode view when active (unless hidden — user went back to workbench)
  if (showingTestMode && !testModeHidden) {
    return <TestModeView />;
  }

  // Show debate view when debate is active or setup is showing (unless hidden)
  if ((debate || showingSetup) && !debateHidden) {
    return <DebateView />;
  }

  // Get vault documents for context injection
  const vaultDocuments = useKnowledgeStore((s) => s.documents);

  // Helper to trigger the appropriate export function based on format
  const triggerExport = async (format: ExportFormat, data: any) => {
    try {
      switch (format) {
        case "pptx":
          await generateAndDownloadPptx(data);
          break;
        case "xlsx":
          await generateAndDownloadXlsx(data);
          break;
        case "pdf":
          generateAndDownloadPdf(data);
          break;
        case "docx":
          await generateAndDownloadDocx(data);
          break;
        case "csv":
          generateAndDownloadCsv(data);
          break;
        case "zip":
          await generateAndDownloadZip(data);
          break;
      }
    } catch (err) {
      console.error("[ChatView] Export generation error:", err);
      throw err;
    }
  };

  const handleSend = async (content: string, attachments?: Attachment[], vaultIds?: string[]) => {
    // /test command — only explicit command triggers test mode
    if (content.trim().toLowerCase() === "/test") {
      openTestMode();
      showFeedback("Opening test mode...");
      return;
    }

    // /forensic command — open forensic log viewer
    if (content.trim().toLowerCase() === "/forensic") {
      openForensicLog();
      showFeedback("Opening forensic log...");
      return;
    }

    // /debate command — only explicit command triggers debate
    if (content.trim().toLowerCase() === "/debate") {
      openDebate();
      showFeedback("Opening debate...");
      return;
    }

    // Check text commands
    const command = parseVoiceCommand(content, nicknameEntries);
    if (command) {
      if (command.type === "switch_model") {
        setProvider(command.provider);
        setModel(command.modelId);
        showFeedback(`Switched to ${command.displayName}`);
        announceSwitch(command.displayName);
      } else if (command.type === "switch_provider") {
        setProvider(command.provider);
        showFeedback(`Switched to ${command.displayName}`);
        announceSwitch(command.displayName);
      } else if (command.type === "switch_voice") {
        setVoicePersona(command.persona);
        showFeedback(`Voice: ${command.displayName}`);
        announceSwitch(command.displayName);
      } else if (command.type === "start_debate") {
        openDebate();
        showFeedback("Opening debate...");
      }
      return;
    }

    // /image command
    if (content.toLowerCase().startsWith("/image ")) {
      const imagePrompt = content.slice(7).trim();
      if (!supportsImageGen) {
        showFeedback("Image generation not supported for this provider");
        return;
      }
      if (!currentProvider || !currentModel) {
        showFeedback("Please select a provider and model first");
        return;
      }
      if (imagePrompt) {
        await generateImage(conversationId, imagePrompt, currentProvider, currentModel);
        return;
      }
    }

    // Export intent detection — generate files (PPTX, PDF, DOCX, XLSX, CSV, ZIP)
    const exportFormat = detectExportIntent(content);
    if (exportFormat) {
      const formatLabel = formatLabels[exportFormat];
      if (!currentProvider || !currentModel) {
        showFeedback("Please select a provider and model first");
        return;
      }

      // Validate that there are messages in the conversation to use as context
      if (!messages || messages.length === 0) {
        showFeedback(`Start a conversation first, then ask me to create the ${formatLabel.toLowerCase()}`);
        return;
      }

      showFeedback(`Generating ${formatLabel}...`);

      try {
        const res = await fetch("/api/chat/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: exportFormat,
            messages: messages.slice(-20), // Last 20 messages for context
            provider: currentProvider,
            model: currentModel,
          }),
        });

        const json = await res.json();

        if (json.data) {
          await triggerExport(exportFormat, json.data);
          showFeedback(`✓ ${formatLabel} downloaded!`);
        } else {
          showFeedback(`Export failed: ${json.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("[ChatView] Export error:", err);
        showFeedback(`Export failed. Try again.`);
      }
      return; // Don't send as a chat message
    }

    // Build message content with attachments
    let finalContent = content;

    // Inject vault context first
    let vaultAttachmentInfo: { id: string; name: string; truncated: boolean }[] | undefined;
    if (vaultIds && vaultIds.length > 0) {
      const { docs } = getVaultDocumentsForContext(vaultDocuments, vaultIds);
      if (docs.length > 0) {
        vaultAttachmentInfo = docs.map((d) => ({ id: d.id, name: d.name, truncated: d.truncated }));
        const vaultParts = docs.map((d) =>
          `--- Knowledge Vault: ${d.name} ---\n${d.content}\n--- End of ${d.name} ---`
        );
        const vaultBlock = vaultParts.join("\n\n");
        finalContent = finalContent
          ? `${vaultBlock}\n\n${finalContent}`
          : vaultBlock;
      }
    }

    // Then add file attachments
    if (attachments && attachments.length > 0) {
      const attachmentParts: string[] = [];
      for (const att of attachments) {
        if (att.isImage) {
          attachmentParts.push(`[Attached image: ${att.name}]`);
        } else {
          attachmentParts.push(`--- File: ${att.name} ---\n${att.content}\n--- End of ${att.name} ---`);
        }
      }
      const attachmentBlock = attachmentParts.join("\n\n");
      finalContent = finalContent
        ? `${attachmentBlock}\n\n${finalContent}`
        : attachmentBlock;
    }

    // Export context — injected as system prompt so it never appears in chat UI
    const exportSystemPrompt = `This chat application has built-in document export. When the user asks to "create a powerpoint", "export as pdf", "make an excel spreadsheet", etc.:
1. Help them develop the content/ideas (provide outline, structure, ideas, etc.)
2. At the end, remind them they can use these commands to download actual files:
   - "create the powerpoint" → downloads .pptx
   - "export as pdf" → downloads .pdf
   - "make an excel" or "export as excel" → downloads .xlsx
   - "create a word doc" → downloads .docx
   - "export as csv" → downloads .csv
   - "make a zip" → downloads .zip
3. Example response: "...and here's your 5-slide outline! Ready to export? Type 'create the powerpoint' and it will generate a real PowerPoint file!"`;

    await sendMessage(conversationId, finalContent, currentProvider, currentModel, {
      summarizeForCloud,
      sanitizeForCloud,
      vaultAttachments: vaultAttachmentInfo,
      systemPrompt: exportSystemPrompt,
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">Chat</span>
          </div>
          {/* Single | Parallel Toggle */}
          <MultiChatModeToggle />
        </div>
        {/* Thread Guardian + AI Mode pill + Current model indicator */}
        <div className="flex items-center gap-3">
          {/* Thread Guardian Indicator */}
          <ThreadGuardianIndicator conversationId={conversationId} />

          {/* Settings shortcut */}
          <button
            onClick={() => router.push("/settings")}
            className="p-1.5 text-zinc-400 hover:text-zinc-300 rounded-lg transition-colors hover:bg-zinc-800"
            title="Settings"
          >
            <Zap className="h-4 w-4" />
          </button>

          {/* Current model indicator */}
          {currentProvider && currentModel && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="text-zinc-600 dark:text-zinc-400">
                {providers.find((p) => p.id === currentProvider)?.name || currentProvider}
              </span>
              <span className="text-zinc-400 dark:text-zinc-600">·</span>
              <span className="text-zinc-500 dark:text-zinc-500 font-mono text-[10px]">
                {currentProvider === "ollama"
                  ? getOllamaFriendlyName(currentModel)
                  : currentModel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        <div className="flex flex-col">
          {loading ? (
            <div className="space-y-4 px-4 sm:px-6 py-4 mx-auto max-w-7xl">
              {/* Loading skeletons */}
              {[1, 2, 3].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <div className="animate-pulse rounded-lg bg-zinc-800 px-5 py-4" style={{ width: `${40 + i * 10}%` }}>
                    <div className="h-3 rounded bg-zinc-700 mb-2" style={{ width: "80%" }} />
                    <div className="h-3 rounded bg-zinc-700 mb-2" style={{ width: "60%" }} />
                    <div className="h-3 rounded bg-zinc-700" style={{ width: "40%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-20">
              <p className="text-sm text-zinc-500">Start typing to begin</p>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6 py-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {sending && (
                <div className="flex items-start gap-3">
                  <div className="relative rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 px-6 py-4 border border-zinc-700/50 shadow-lg">
                    {/* Animated glow background */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />

                    <div className="relative flex items-center gap-3">
                      {/* Bot icon with glow */}
                      <div className="relative">
                        <Bot className="h-5 w-5 text-cyan-400 animate-pulse" />
                        <div className="absolute inset-0 blur-md bg-cyan-400/40 animate-pulse" />
                      </div>

                      {/* Model name with glow */}
                      <span
                        className="text-sm font-bold tracking-wide"
                        style={{
                          background: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.5))',
                        }}
                      >
                        {currentModel || 'AI'}
                      </span>

                      {/* Pulsing dots */}
                      <span className="inline-flex items-center gap-1 ml-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: "300ms" }} />
                      </span>

                      {/* Sparkles icon */}
                      <Sparkles className="h-4 w-4 text-yellow-400/70 animate-spin" style={{ animationDuration: '3s' }} />
                    </div>

                    {/* "Thinking..." text */}
                    <div className="mt-2 text-[10px] text-zinc-500 font-medium tracking-wider uppercase">
                      Generating response...
                    </div>
                  </div>
                </div>
              )}

              {/* Export buttons when there are messages */}
              {messages.length > 0 && !sending && (
                <div className="flex justify-center gap-2 pt-2 opacity-0 transition-opacity hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      exportChatToPDF(messages, "Chat Export");
                      showToast({ message: "Exported chat as PDF", type: "success" });
                    }}
                    className="h-6 gap-1 px-2 text-[10px] text-zinc-600 hover:text-zinc-400"
                  >
                    <FileText className="h-3 w-3" /> Export PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      exportChatToCSV(messages, "Chat Export");
                      showToast({ message: "Exported chat as CSV", type: "success" });
                    }}
                    className="h-6 gap-1 px-2 text-[10px] text-zinc-600 hover:text-zinc-400"
                  >
                    <Download className="h-3 w-3" /> Export CSV
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Voice indicator */}
      <VoiceIndicator voiceState={voiceState} />

      {/* Command feedback */}
      {commandFeedback && (
        <div className="px-4 py-1 text-center text-xs font-medium text-emerald-400">
          {commandFeedback}
        </div>
      )}

      {/* Voice error */}
      {voiceError && (
        <div className="px-4 py-1 text-center text-xs text-red-400">
          {voiceError}
        </div>
      )}

      {/* Input area */}
      <InputArea
        conversationId={conversationId}
        onSend={handleSend}
        onImageGen={handleImageGen}
        onDebate={openDebate}
        onDebateThread={handleDebateThread}
        onCopyThread={handleCopyThread}
        hasMessages={messages.length > 0}
        supportsImageGen={supportsImageGen}
        voiceState={voiceState}
        supportsVoice={supportsVoice}
        onVoiceStart={start}
        onVoiceStop={stop}
        onVoiceInterrupt={interrupt}
      />

    </div>
  );
}
