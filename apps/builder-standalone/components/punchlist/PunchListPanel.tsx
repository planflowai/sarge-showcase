"use client";

import { useState, useEffect, useCallback } from "react";

interface PunchListItem {
  id: number;
  page: string;
  description: string;
  priority: "low" | "medium" | "high";
  screenshot: string | null;
  status: "open" | "in-progress" | "done";
  round: number;
  timestamp: string;
}

interface PunchListPanelProps {
  projectPath: string;
  maxRounds?: number;
}

const PRIORITY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: "bg-red-500/20",    text: "text-red-400",    label: "High" },
  medium: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Medium" },
  low:    { bg: "bg-green-500/20",  text: "text-green-400",  label: "Low" },
};

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "open",        label: "Open",        color: "text-sky-400" },
  { value: "in-progress", label: "In Progress", color: "text-yellow-400" },
  { value: "done",        label: "Done",        color: "text-green-400" },
];

export default function PunchListPanel({
  projectPath,
  maxRounds = 3,
}: PunchListPanelProps) {
  const [items, setItems] = useState<PunchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterRound, setFilterRound] = useState<string>("all");
  const [expandedScreenshot, setExpandedScreenshot] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/punchlist/submit?projectPath=${encodeURIComponent(projectPath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const updateStatus = async (itemId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/punchlist/submit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, itemId, status: newStatus }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId ? { ...it, status: newStatus as PunchListItem["status"] } : it
          )
        );
      }
    } catch {
      // silent
    }
  };

  const currentRound = items.length > 0 ? Math.max(...items.map((i) => i.round)) : 1;
  const rounds = [...new Set(items.map((i) => i.round))].sort((a, b) => a - b);

  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterPriority !== "all" && item.priority !== filterPriority) return false;
    if (filterRound !== "all" && item.round !== Number(filterRound)) return false;
    return true;
  });

  const openCount = items.filter((i) => i.status === "open").length;
  const inProgressCount = items.filter((i) => i.status === "in-progress").length;
  const doneCount = items.filter((i) => i.status === "done").length;

  const exportPdf = () => {
    const lines = [
      `PUNCH LIST — ${projectPath}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Round ${currentRound} of ${maxRounds}`,
      "",
      ...filtered.map(
        (it) =>
          `#${it.id} [${it.priority.toUpperCase()}] [${it.status}] ${it.page}\n   ${it.description}\n   ${new Date(it.timestamp).toLocaleString()}\n`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `punchlist-round-${currentRound}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) {
    return (
      <div className="p-4 text-zinc-300 text-sm">Loading punch list...</div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Punch List</h3>
          <span className="text-xs px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-full">
            Round {currentRound} of {maxRounds}
          </span>
          {currentRound >= maxRounds && (
            <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
              Final round — additional rounds may incur fees
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-sky-400">{openCount} open</span>
          <span className="text-zinc-300">·</span>
          <span className="text-yellow-400">{inProgressCount} in progress</span>
          <span className="text-zinc-300">·</span>
          <span className="text-green-400">{doneCount} done</span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300"
        >
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300"
        >
          <option value="all">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {rounds.length > 1 && (
          <select
            value={filterRound}
            onChange={(e) => setFilterRound(e.target.value)}
            className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300"
          >
            <option value="all">All Rounds</option>
            {rounds.map((r) => (
              <option key={r} value={r}>Round {r}</option>
            ))}
          </select>
        )}
        <button
          onClick={exportPdf}
          className="ml-auto text-xs px-3 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
        >
          Export
        </button>
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="p-6 text-center text-zinc-300 text-sm">
          {items.length === 0
            ? "No revisions submitted yet."
            : "No items match the current filters."}
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50 max-h-[480px] overflow-y-auto">
          {filtered.map((item) => {
            const pri = PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.medium;
            return (
              <div
                key={item.id}
                className="px-4 py-3 hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-zinc-300 pt-0.5 min-w-[28px]">
                    #{item.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-zinc-400 font-medium">
                        {item.page}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${pri.bg} ${pri.text}`}
                      >
                        {pri.label}
                      </span>
                      <span className="text-xs text-zinc-300">
                        R{item.round}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {item.description}
                    </p>
                    {item.screenshot && (
                      <button
                        onClick={() =>
                          setExpandedScreenshot(
                            expandedScreenshot === item.id ? null : item.id
                          )
                        }
                        className="mt-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        {expandedScreenshot === item.id
                          ? "Hide screenshot"
                          : "View screenshot"}
                      </button>
                    )}
                    {expandedScreenshot === item.id && item.screenshot && (
                      <img
                        src={item.screenshot}
                        alt="Screenshot"
                        className="mt-2 rounded-lg border border-zinc-700 max-w-full max-h-48 object-contain"
                      />
                    )}
                    <div className="text-xs text-zinc-300 mt-1">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded border border-zinc-700 bg-zinc-800 ${
                      STATUS_OPTIONS.find((s) => s.value === item.status)
                        ?.color || "text-zinc-400"
                    }`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
