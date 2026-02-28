"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, Download, Trash2, MessageSquare } from "lucide-react";
import { useConversationStore, useMessageStore, ConversationList } from "@sarge/chat/index.client";
import {
  useProviderStore,
  useModelStore,
  fetchOllamaModels,
  fetchLMStudioModels,
  providers,
  groupOllamaModels,
  cn,
} from "@sarge/core";
import type { LocalModel } from "@sarge/core";

interface ChatSidebarProps {
  conversationId?: string;
}

export function ChatSidebar({ conversationId }: ChatSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Conversation stores
  const createConversation = useConversationStore((s) => s.createConversation);
  const clearMessages = useMessageStore((s) => s.clearMessages);
  const messages = useMessageStore((s) => s.messages);

  // Provider / model stores
  const {
    currentProvider, currentModel,
    setProvider, setModel,
    summarizeForCloud, setSummarizeForCloud,
    sanitizeForCloud, setSanitizeForCloud,
    hydrated: providerHydrated, hydrate: hydrateProvider,
  } = useProviderStore();
  const { hydrated: modelsHydrated, hydrate: hydrateModels, getEffectiveModels, getDisplayName } = useModelStore();

  useEffect(() => {
    if (!providerHydrated) hydrateProvider();
    if (!modelsHydrated) hydrateModels();
  }, [providerHydrated, hydrateProvider, modelsHydrated, hydrateModels]);

  // Load local models when a local provider is selected
  const activeProvider = providers.find((p) => p.id === currentProvider);
  const isLocal = activeProvider?.type === "local";

  useEffect(() => {
    if (!isLocal) {
      setLocalModels([]);
      setLocalError(null);
      return;
    }
    setLocalLoading(true);
    setLocalError(null);
    const isLMStudio = currentProvider === "lmstudio";
    const fetcher = isLMStudio ? fetchLMStudioModels : fetchOllamaModels;
    const label = isLMStudio ? "LM Studio" : "Ollama";
    fetcher()
      .then((models) => {
        setLocalModels(models);
        if (models.length > 0) {
          const stored = useProviderStore.getState().currentModel;
          if (!stored || !models.some((m) => m.id === stored)) {
            setModel(models[0].id);
          }
        }
      })
      .catch(() => {
        setLocalModels([]);
        setLocalError(`${label} not running`);
      })
      .finally(() => setLocalLoading(false));
  }, [currentProvider, isLocal, setModel]);

  // Handlers
  const handleNewChat = async () => {
    clearMessages();
    await createConversation(`Chat ${new Date().toLocaleTimeString()}`);
  };

  const handleSaveChat = () => {
    const visible = messages.filter((m) => m.role !== "system");
    if (!visible.length) return;
    const lines: string[] = [
      `# Chat Export`,
      ``,
      `**Exported:** ${new Date().toLocaleString()}`,
      `**Model:** ${currentModel} (${currentProvider})`,
      ``,
      `---`,
      ``,
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

  const cloudProviders = providers.filter((p) => p.type === "cloud");
  const localProviders = providers.filter((p) => p.type === "local");
  const hasMessages = messages.filter((m) => m.role !== "system").length > 0;

  const cloudModelList = useMemo(() => {
    if (!modelsHydrated || isLocal) return [];
    return getEffectiveModels(currentProvider);
  }, [modelsHydrated, currentProvider, isLocal, getEffectiveModels]);

  // ── Collapsed: slim icon strip ──────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="flex-shrink-0 w-12 flex flex-col border-r border-zinc-800 bg-zinc-900 items-center pt-3 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          className="p-2 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={handleNewChat}
          title="New Chat"
          className="p-2 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="h-px w-6 bg-zinc-800 my-1" />
        <button
          title="Conversations"
          className="p-2 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────
  return (
    <aside className="flex-shrink-0 w-[280px] flex flex-col border-r border-zinc-800 bg-zinc-900 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800/60 flex-shrink-0">
        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">Chat</span>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 py-3 border-b border-zinc-800/40 flex-shrink-0">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold transition-all hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Conversations — scrollable flex-1 */}
      <div className="flex-1 overflow-y-auto min-h-0 border-b border-zinc-800/40">
        <div className="px-2 py-2">
          <ConversationList />
        </div>
      </div>

      {/* Provider + Model section */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-zinc-800/40 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">Providers</p>

        {/* Cloud providers — 2-col grid */}
        <div>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Cloud</p>
          <div className="grid grid-cols-2 gap-1">
            {cloudProviders.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  setProvider(p.id as any);
                  const models = getEffectiveModels(p.id);
                  if (models.length > 0) setModel(models[0].id);
                }}
                className={cn(
                  "px-2 py-1.5 rounded-md text-[10px] font-bold border transition-all",
                  currentProvider === p.id
                    ? "text-white"
                    : "bg-zinc-800/60 border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                )}
                style={
                  currentProvider === p.id
                    ? { backgroundColor: p.color + "25", borderColor: p.color + "70", color: p.color }
                    : {}
                }
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Local providers */}
        <div>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Local</p>
          <div className="flex flex-wrap gap-1">
            {localProviders.map((p) => (
              <button
                key={p.id}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => setProvider(p.id as any)}
                className={cn(
                  "px-2 py-1.5 rounded-md text-[10px] font-bold border transition-all",
                  currentProvider === p.id
                    ? "text-white"
                    : "bg-zinc-800/60 border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                )}
                style={
                  currentProvider === p.id
                    ? { backgroundColor: p.color + "25", borderColor: p.color + "70", color: p.color }
                    : {}
                }
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Model dropdown */}
        <div>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Model</p>
          {isLocal ? (
            localLoading ? (
              <p className="text-xs text-zinc-500">Loading…</p>
            ) : localError ? (
              <p className="text-xs text-red-400">{localError}</p>
            ) : localModels.length === 0 ? (
              <p className="text-xs text-zinc-500">No models found</p>
            ) : currentProvider === "lmstudio" ? (
              <select
                value={currentModel}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500"
              >
                {localModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            ) : (
              <select
                value={currentModel}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500"
              >
                {groupOllamaModels(localModels.map((m) => m.id)).map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {getDisplayName(model.id, model.name)}{model.hint ? ` · ${model.hint}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )
          ) : (
            <select
              value={currentModel}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500"
            >
              {cloudModelList.map((model) => (
                <option key={model.id} value={model.id}>
                  {getDisplayName(model.id, model.name)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Cloud Privacy */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-zinc-800/40 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">Cloud Privacy</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={summarizeForCloud}
            onChange={(e) => setSummarizeForCloud(e.target.checked)}
            className="h-3 w-3 rounded border-zinc-600 accent-indigo-500"
          />
          <span className="text-[10px] text-zinc-500 hover:text-zinc-400">Summarize threads for cloud</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sanitizeForCloud}
            onChange={(e) => setSanitizeForCloud(e.target.checked)}
            className="h-3 w-3 rounded border-zinc-600 accent-indigo-500"
          />
          <span className="text-[10px] text-zinc-500 hover:text-zinc-400">Sanitize queries for cloud</span>
        </label>
      </div>

      {/* Footer: Save + Clear */}
      <div className="flex-shrink-0 px-3 py-3 flex gap-2">
        <button
          onClick={handleSaveChat}
          disabled={!hasMessages}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-bold border border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Download className="h-3 w-3" />
          {saveFeedback ? "Saved!" : "Save Chat"}
        </button>
        <button
          onClick={handleClearChat}
          disabled={!hasMessages}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed",
            confirmClear
              ? "bg-red-500/15 border-red-500/50 text-red-400 animate-pulse"
              : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-red-400 hover:border-red-500/40"
          )}
        >
          <Trash2 className="h-3 w-3" />
          {confirmClear ? "Confirm?" : "Clear"}
        </button>
      </div>
    </aside>
  );
}
