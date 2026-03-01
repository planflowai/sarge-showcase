"use client";

import { useState, useEffect, useCallback } from "react";
import { Gavel, History, Settings, Sun, Moon, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import { DebateView } from "@/components/debate/DebateView";
import { DebateHistory } from "@/components/debate/DebateHistory";
import { TruthAnchorsPanel } from "@/components/debate/TruthAnchorsPanel";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useDebateHistoryStore } from "@/lib/stores/debateHistoryStore";

// ─── Header ──────────────────────────────────────────────────────────────────
function DebateHeader({
  showSidebar,
  onToggleSidebar,
}: {
  showSidebar: boolean;
  onToggleSidebar: () => void;
}) {
  const [isDark, setIsDark] = useState(true);
  const clearDebate = useDebateStore((s) => s.clearDebate);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("debate-theme", next ? "dark" : "light"); } catch {}
  }, [isDark]);

  const handleNewDebate = useCallback(() => {
    clearDebate();
  }, [clearDebate]);

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
      {/* Left: Title */}
      <div className="flex items-center gap-3">
        <Gavel className="w-7 h-7 text-orange-500" />
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zinc-50 leading-none">
            DEBATE ARENA
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            AI Tribunal — Multi-Agent Fact Verification
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleNewDebate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Debate
        </button>
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title={showSidebar ? "Hide sidebar" : "Show sidebar"}
        >
          {showSidebar ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}

// ─── Side Panel ──────────────────────────────────────────────────────────────
function SidePanel() {
  const [activeTab, setActiveTab] = useState<"history" | "anchors">("history");

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
      {/* Tab Selector */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === "history"
              ? "text-orange-400 border-b-2 border-orange-400 bg-zinc-800/50"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <History className="w-3.5 h-3.5 inline mr-1.5" />
          History
        </button>
        <button
          onClick={() => setActiveTab("anchors")}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === "anchors"
              ? "text-orange-400 border-b-2 border-orange-400 bg-zinc-800/50"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Settings className="w-3.5 h-3.5 inline mr-1.5" />
          Truth Anchors
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === "history" ? (
          <DebateHistory />
        ) : (
          <TruthAnchorsPanel />
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DebateArenaPage() {
  const [showSidebar, setShowSidebar] = useState(true);

  // Hydrate stores on mount
  useEffect(() => {
    useDebateHistoryStore.getState().loadDebates();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <DebateHeader
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
      />

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Debate Arena — Primary Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <DebateView />
        </div>

        {/* Side Panel — History + Truth Anchors */}
        {showSidebar && (
          <div className="w-80 flex-shrink-0">
            <SidePanel />
          </div>
        )}
      </div>
    </div>
  );
}
