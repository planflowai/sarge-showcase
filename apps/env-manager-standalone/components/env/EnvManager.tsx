"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  ExternalLink,
  Plus,
  Upload,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Shield,
  Clock,
  FileKey,
} from "lucide-react";

/* ── Types ── */

interface EnvKey {
  key: string;
  maskedValue: string;
  hasValue: boolean;
  category: string;
  lastRotated: string | null;
}

interface FileInfo {
  path: string;
  lastModified: string;
  size: number;
}

/* ── Rotation URLs ── */

const ROTATION_URLS: Record<string, string> = {
  ANTHROPIC_API_KEY: "https://console.anthropic.com/settings/keys",
  OPENAI_API_KEY: "https://platform.openai.com/api-keys",
  GOOGLE_API_KEY: "https://aistudio.google.com/apikey",
  XAI_API_KEY: "https://console.x.ai",
  DEEPSEEK_API_KEY: "https://platform.deepseek.com/api_keys",
  MISTRAL_API_KEY: "https://console.mistral.ai/api-keys",
  HUGGINGFACE_API_KEY: "https://huggingface.co/settings/tokens",
  TAVILY_API_KEY: "https://app.tavily.com",
  GITHUB_TOKEN: "https://github.com/settings/tokens",
};

/* ── Category config ── */

const CATEGORY_ORDER = [
  "AI Providers",
  "Local Models",
  "Search APIs",
  "Trading",
  "Deployment",
  "Infrastructure",
  "Other / Custom",
];

const CATEGORY_COLORS: Record<string, string> = {
  "AI Providers": "#FF6700",
  "Local Models": "#8b5cf6",
  "Search APIs": "#00b4d8",
  Trading: "#10a37f",
  Deployment: "#4285f4",
  Infrastructure: "#888888",
  "Other / Custom": "#a1a1aa",
};

/* ── Helpers ── */

function rotationAgeDays(lastRotated: string | null): number | null {
  if (!lastRotated) return null;
  const diff = Date.now() - new Date(lastRotated).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function rotationBadge(days: number | null) {
  if (days === null)
    return { label: "Never rotated", color: "text-zinc-500", bg: "bg-zinc-500/10" };
  if (days < 60)
    return { label: `${days}d ago`, color: "text-green-500", bg: "bg-green-500/10" };
  if (days < 90)
    return { label: `${days}d ago`, color: "text-yellow-500", bg: "bg-yellow-500/10" };
  return { label: `${days}d ago`, color: "text-red-500", bg: "bg-red-500/10" };
}

/* ── Toast ── */

function Toast({
  message,
  type,
  onDone,
}: {
  message: string;
  type: "success" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
        type === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {message}
    </div>
  );
}

/* ── Main Component ── */

export function EnvManager() {
  const [keys, setKeys] = useState<EnvKey[]>([]);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") =>
    setToast({ message, type });

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/env/read");
      const data = await res.json();
      setKeys(data.keys || []);
      setFileInfo(data.fileInfo || null);
    } catch {
      showToast("Failed to load ENV keys", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  /* ── Reveal / Hide ── */

  const toggleReveal = async (key: string) => {
    if (revealed[key]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    try {
      const res = await fetch("/api/env/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (data.value !== undefined) {
        setRevealed((prev) => ({ ...prev, [key]: data.value }));
      }
    } catch {
      showToast("Failed to reveal key", "error");
    }
  };

  /* ── Edit ── */

  const startEdit = async (key: string) => {
    if (!revealed[key]) {
      try {
        const res = await fetch("/api/env/reveal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        const data = await res.json();
        if (data.value !== undefined) {
          setRevealed((prev) => ({ ...prev, [key]: data.value }));
          setEditValue(data.value);
        }
      } catch {
        showToast("Failed to reveal key", "error");
        return;
      }
    } else {
      setEditValue(revealed[key]);
    }
    setEditing(key);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/env/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editing, value: editValue }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${editing} updated`);
        setRevealed((prev) => ({ ...prev, [editing!]: editValue }));
        setEditing(null);
        fetchKeys();
      } else {
        showToast(data.error || "Save failed", "error");
      }
    } catch {
      showToast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Rotate ── */

  const rotateKey = (key: string) => {
    const url = ROTATION_URLS[key];
    if (url) {
      window.open(url, "_blank");
    }
    startEdit(key);
  };

  /* ── Add ── */

  const addKey = async () => {
    if (!newKey) return;
    setSaving(true);
    try {
      const res = await fetch("/api/env/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${newKey} added`);
        setNewKey("");
        setNewValue("");
        setAddMode(false);
        fetchKeys();
      } else {
        showToast(data.error || "Add failed", "error");
      }
    } catch {
      showToast("Add failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */

  const deleteKey = async (key: string) => {
    try {
      const res = await fetch("/api/env/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${key} deleted`);
        setConfirmDelete(null);
        fetchKeys();
      } else {
        showToast(data.error || "Delete failed", "error");
      }
    } catch {
      showToast("Delete failed", "error");
    }
  };

  /* ── Push ── */

  const pushToApps = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/env/push", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(`ENV pushed to ${data.updatedCount} apps`);
        setShowRestart(true);
      } else {
        showToast(data.error || "Push failed", "error");
      }
    } catch {
      showToast("Push failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Restart ── */

  const restartApps = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/env/restart", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(`${data.restarted} apps restarted`);
        setShowRestart(false);
      } else {
        showToast(data.error || "Restart failed", "error");
      }
    } catch {
      showToast("Restart failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Group keys ── */

  const grouped: Record<string, EnvKey[]> = {};
  for (const k of keys) {
    if (!grouped[k.category]) grouped[k.category] = [];
    grouped[k.category].push(k);
  }

  const toggleCollapse = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#FF6700] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-[#0a0a0a]">
      <div className="max-w-[2800px] mx-auto px-8 py-3">
        {/* Header */}
        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-4 mb-1">
            <FileKey className="w-10 h-10 text-[#FF6700]" />
            <h1
              className="text-4xl font-black tracking-[0.15em] uppercase"
              style={{ color: "#FF6700" }}
            >
              ENV MANAGER
            </h1>
          </div>
          {fileInfo && (
            <div className="flex items-center justify-center gap-4 text-base text-white font-mono font-bold">
              <span>{fileInfo.path}</span>
              <span>&middot;</span>
              <span>
                Modified:{" "}
                {new Date(fileInfo.lastModified).toLocaleString()}
              </span>
              <span>&middot;</span>
              <span>{keys.length} keys</span>
            </div>
          )}
        </div>

        {/* Category sections */}
        {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => {
          const catKeys = grouped[cat];
          const isCollapsed = collapsed.has(cat);
          const catColor = CATEGORY_COLORS[cat] || "#888";

          return (
            <div key={cat} className="mb-3">
              {/* Category header */}
              <button
                onClick={() => toggleCollapse(cat)}
                className="flex items-center gap-2 mb-1 group w-full text-left"
              >
                {isCollapsed ? (
                  <ChevronRight
                    className="w-5 h-5 text-white/50"
                  />
                ) : (
                  <ChevronDown
                    className="w-5 h-5 text-white/50"
                  />
                )}
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: catColor }}
                />
                <span
                  className="text-lg font-black tracking-wide uppercase"
                  style={{ color: catColor }}
                >
                  {cat}
                </span>
                <span className="text-base font-bold text-white/50">
                  ({catKeys.length})
                </span>
              </button>

              {/* Horizontal strip rows — 2 per row */}
              {!isCollapsed && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-1">
                  {catKeys.map((envKey) => {
                    const isRevealed = revealed[envKey.key] !== undefined;
                    const isEditing = editing === envKey.key;
                    const rotUrl = ROTATION_URLS[envKey.key];
                    const ageDays = rotationAgeDays(envKey.lastRotated);
                    const badge = rotationBadge(ageDays);
                    const isDeleting = confirmDelete === envKey.key;

                    return (
                      <div key={envKey.key}>
                        {/* Main row — everything on one line */}
                        <div
                          className="flex items-center gap-3 rounded-lg border border-zinc-700/60 bg-[#141414] px-4 py-2 hover:border-zinc-500 transition-colors"
                        >
                          {/* Status dot */}
                          <div
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              envKey.hasValue
                                ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                                : envKey.maskedValue === ""
                                ? "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]"
                                : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                            }`}
                          />

                          {/* Key name — fixed width */}
                          <span className="font-mono font-black text-[15px] text-white truncate w-56 flex-shrink-0">
                            {envKey.key}
                          </span>

                          {/* Masked value */}
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 px-2 py-1 rounded text-sm font-mono font-bold bg-zinc-900 border border-zinc-600 text-white focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                  if (e.key === "Escape") setEditing(null);
                                }}
                              />
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="p-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="p-1 rounded bg-zinc-600 text-white hover:bg-zinc-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-sm text-white/70 truncate flex-1 min-w-0">
                              {isRevealed
                                ? revealed[envKey.key]
                                : envKey.maskedValue || "—"}
                            </span>
                          )}

                          {/* Rotation badge */}
                          <span
                            className={`text-sm font-bold px-2 py-0.5 rounded flex-shrink-0 ${badge.bg} ${badge.color}`}
                          >
                            {badge.label}
                          </span>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => toggleReveal(envKey.key)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-sm font-bold bg-zinc-800 hover:bg-zinc-600 text-white transition-colors"
                            >
                              {isRevealed ? (
                                <><EyeOff className="w-4 h-4" /> Hide</>
                              ) : (
                                <><Eye className="w-4 h-4" /> Show</>
                              )}
                            </button>
                            <button
                              onClick={() => startEdit(envKey.key)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-sm font-bold bg-zinc-800 hover:bg-zinc-600 text-white transition-colors"
                            >
                              <Pencil className="w-4 h-4" /> Edit
                            </button>
                            {rotUrl && (
                              <button
                                onClick={() => rotateKey(envKey.key)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded text-sm font-bold bg-[#FF6700]/15 hover:bg-[#FF6700]/30 text-[#FF6700] transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" /> Rotate
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setConfirmDelete(isDeleting ? null : envKey.key)
                              }
                              className="text-zinc-500 hover:text-red-500 transition-colors p-1"
                              title="Delete key"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Delete confirmation — slides in below */}
                        {isDeleting && (
                          <div className="flex items-center gap-3 ml-10 mt-1 mb-1 p-2 rounded bg-red-500/10 border border-red-500/20">
                            <span className="text-sm font-bold text-red-400">
                              Delete {envKey.key}?
                            </span>
                            <button
                              onClick={() => deleteKey(envKey.key)}
                              className="px-3 py-1 rounded text-sm font-bold bg-red-600 text-white hover:bg-red-700"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-3 py-1 rounded text-sm font-bold bg-zinc-700 text-white/70 hover:bg-zinc-600"
                            >
                              No
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Add New Key */}
        <div className="mt-3 border-t border-zinc-800 pt-3">
          {addMode ? (
            <div className="flex items-end gap-3 max-w-xl">
              <div className="flex-1">
                <label className="block text-sm text-white/60 mb-1 font-bold">
                  Variable Name
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) =>
                    setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                  }
                  placeholder="MY_API_KEY"
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono font-bold bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                  autoFocus
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-white/60 mb-1 font-bold">
                  Value
                </label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono font-bold bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
                />
              </div>
              <button
                onClick={addKey}
                disabled={!newKey || saving}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAddMode(false);
                  setNewKey("");
                  setNewValue("");
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-zinc-800 text-white/70 hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddMode(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add New Key
            </button>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="mt-3 flex items-center gap-3 justify-center pb-3">
          <button
            onClick={pushToApps}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-base font-black text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#FF6700" }}
          >
            <Upload className="w-5 h-5" />
            Save & Push to All Apps
          </button>

          {showRestart && (
            <button
              onClick={restartApps}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-base font-black bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" />
              Restart Running Apps
            </button>
          )}

          <button
            onClick={fetchKeys}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-base font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
