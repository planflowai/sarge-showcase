"use client";

import { useState } from "react";
import { ShieldCheck, Sun, Moon, FileUp } from "lucide-react";
import { ForensicLogView } from "@/components/forensic/ForensicLogView";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";

export default function ForensicDashboard() {
  const [darkMode, setDarkMode] = useState(true);
  const entries = useForensicLogStore((s) => s.entries);
  const sessions = useForensicLogStore((s) => s.sessions);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark", !darkMode);
  };

  const handleImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const store = useForensicLogStore.getState();

        // Support both full export format and session export format
        if (data.entries && Array.isArray(data.entries)) {
          // Full export — has entries and sessions at top level
          const importedEntries = data.entries;
          const importedSessions = data.sessions || [];

          // Merge into existing store
          useForensicLogStore.setState((s) => ({
            entries: [...s.entries, ...importedEntries],
            sessions: [...s.sessions, ...importedSessions],
            _seq: s._seq + importedEntries.length,
          }));
        }
      } catch (err) {
        console.error("[Forensic] Import failed:", err);
      }
    };
    input.click();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 no-print">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <h1 className="text-sm font-black uppercase tracking-widest text-emerald-400">
            Forensic Log
          </h1>
          <span className="text-[10px] text-zinc-600 font-mono">The Foundry</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <span className="text-[10px] text-zinc-500 font-mono">
            {entries.length} entries · {sessions.length} sessions
          </span>

          {/* Import */}
          <button
            onClick={handleImportJSON}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            title="Import forensic log JSON"
          >
            <FileUp className="h-3.5 w-3.5" />
            Import
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <ForensicLogView />
      </main>
    </div>
  );
}
