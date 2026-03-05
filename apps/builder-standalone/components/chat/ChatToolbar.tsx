"use client";

import { useState, useEffect, useMemo } from "react";
import { Download, Trash2 } from "lucide-react";
import {
  useProviderStore,
  useModelStore,
  fetchOllamaModels,
  providers,
  groupOllamaModels,
} from "@sarge/core";
import type { LocalModel } from "@sarge/core";
import { useMessageStore } from "@sarge/chat/index.client";

interface Props {
  conversationId: string;
}

export function ChatToolbar({ conversationId }: Props) {
  const { currentProvider, currentModel, setProvider, setModel } = useProviderStore();
  const { hydrated, hydrate, getDisplayName, getEffectiveModels } = useModelStore();
  const messages = useMessageStore((s) => s.messages);
  const clearMessages = useMessageStore((s) => s.clearMessages);

  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Fetch Ollama models when ollama is selected
  useEffect(() => {
    if (currentProvider !== "ollama") return;
    setOllamaLoading(true);
    fetchOllamaModels()
      .then((models) => setOllamaModels(models))
      .catch(() => setOllamaModels([]))
      .finally(() => setOllamaLoading(false));
  }, [currentProvider]);

  const cloudProviderIds = new Set(["anthropic", "openai", "google", "xai", "deepseek"]);
  const allProviders = providers.filter((p) => cloudProviderIds.has(p.id) || p.id === "ollama");
  const cloudProviders = allProviders.filter((p) => p.type === "cloud");
  const localProviders = allProviders.filter((p) => p.type === "local");

  const currentProviderModels = useMemo(() => {
    if (!hydrated) return [];
    if (currentProvider === "ollama") return ollamaModels;
    return getEffectiveModels(currentProvider);
  }, [hydrated, currentProvider, ollamaModels, getEffectiveModels]);

  const handleProviderSelect = (providerId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setProvider(providerId as any);
    const models =
      providerId === "ollama" ? ollamaModels : getEffectiveModels(providerId);
    if (models.length > 0) setModel(models[0].id);
  };

  const handleSaveChat = () => {
    const visible = messages.filter((m) => m.role !== "system");
    if (visible.length === 0) return;

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
      const label =
        msg.role === "user"
          ? "**You**"
          : `**Assistant** (${msg.model || currentModel})`;
      const time = new Date(msg.timestamp).toLocaleTimeString();
      lines.push(`### ${label} — ${time}`);
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
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
    // Clear in-memory messages
    clearMessages();
    // Also wipe the persisted conversation so messages don't reload on next visit
    try {
      localStorage.removeItem(`messages_${conversationId}`);
    } catch {}
    setConfirmClear(false);
  };

  const hasMessages = messages.filter((m) => m.role !== "system").length > 0;

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70">
      {/* Cloud provider */}
      <select
        value={cloudProviders.some((p) => p.id === currentProvider) ? currentProvider : ""}
        onChange={(e) => handleProviderSelect(e.target.value)}
        className="w-24 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-xs text-zinc-400 dark:text-zinc-300 outline-none focus:border-indigo-500"
        title="Cloud Provider"
      >
        <option value="" disabled>Cloud…</option>
        {cloudProviders.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Local provider */}
      <select
        value={localProviders.some((p) => p.id === currentProvider) ? currentProvider : ""}
        onChange={(e) => handleProviderSelect(e.target.value)}
        className="w-20 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-xs text-zinc-400 dark:text-zinc-300 outline-none focus:border-indigo-500"
        title="Local Provider"
      >
        <option value="" disabled>Local…</option>
        {localProviders.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Model dropdown */}
      <div className="w-44 min-w-0">
        {currentProvider === "ollama" && ollamaLoading ? (
          <span className="text-xs text-zinc-300">Loading…</span>
        ) : (
          <select
            value={currentModel || ""}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-xs text-zinc-400 dark:text-zinc-300 outline-none focus:border-indigo-500"
          >
            <option value="" disabled>Model…</option>
            {currentProvider === "ollama"
              ? groupOllamaModels(ollamaModels.map((m) => m.id)).map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {getDisplayName(model.id, model.name)}
                      </option>
                    ))}
                  </optgroup>
                ))
              : currentProviderModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {getDisplayName(model.id, model.name)}
                  </option>
                ))}
          </select>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save Chat */}
      <button
        onClick={handleSaveChat}
        disabled={!hasMessages}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-300 dark:text-zinc-300 hover:border-indigo-500 hover:text-indigo-500 dark:hover:text-indigo-400"
        title="Export chat as Markdown"
      >
        <Download className="h-3 w-3" />
        {saveFeedback ? "Saved!" : "Save Chat"}
      </button>

      {/* Clear Chat */}
      <button
        onClick={handleClearChat}
        disabled={!hasMessages}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          confirmClear
            ? "bg-red-500/15 border-red-500/60 text-red-400 animate-pulse"
            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-300 dark:text-zinc-300 hover:border-red-500 hover:text-red-400"
        }`}
        title={confirmClear ? "Click again to confirm" : "Clear all messages"}
      >
        <Trash2 className="h-3 w-3" />
        {confirmClear ? "Confirm?" : "Clear"}
      </button>
    </div>
  );
}
