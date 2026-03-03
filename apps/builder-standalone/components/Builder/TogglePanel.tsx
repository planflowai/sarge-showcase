"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Flame,
  X,
  Search,
  Eye,
  Lock,
  BarChart3,
  Zap,
  ClipboardList,
  Calendar,
  Mail,
  Shield,
  Check,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import {
  TOGGLE_INFO,
  DEFAULT_TOGGLES,
  type ProjectToggles,
  type ToggleConfig,
} from "@/lib/types/project";
import type { ToggleResult } from "@/lib/toggles/pipeline";
import { useBuilderStore } from "@sarge/builder/index.client";

/* ── Icon map per toggle key ── */
const TOGGLE_ICONS: Record<string, React.ElementType> = {
  seo: Search,
  accessibility: Eye,
  privacy: Lock,
  analytics: BarChart3,
  security: Shield,
  performance: Zap,
  punchList: ClipboardList,
  calendly: Calendar,
  mailchimp: Mail,
};

type ToggleStatus = "idle" | "running" | "complete" | "error" | "warning";

interface Props {
  onClose: () => void;
}

export default function TogglePanel({ onClose }: Props) {
  const projectPath = useBuilderStore((s) => s.projectPath);

  // Toggle states
  const [toggles, setToggles] = useState<ProjectToggles>({ ...DEFAULT_TOGGLES });
  const [toggleConfig, setToggleConfig] = useState<ToggleConfig>({});
  const [statuses, setStatuses] = useState<Record<string, ToggleStatus>>({});
  const [results, setResults] = useState<ToggleResult[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [optimizeLabel, setOptimizeLabel] = useState<"idle" | "running" | "done">("idle");
  const [currentToggleName, setCurrentToggleName] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Load toggle states from project.json on mount
  useEffect(() => {
    if (!projectPath) return;
    (async () => {
      try {
        const res = await fetch("/api/builder/read-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: projectPath + "/project.json" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.content) {
            const meta = JSON.parse(data.content);
            if (meta.toggles) setToggles({ ...DEFAULT_TOGGLES, ...meta.toggles });
            if (meta.toggleConfig) setToggleConfig(meta.toggleConfig);
          }
        }
      } catch {
        // Use defaults
      }
    })();
  }, [projectPath]);

  // Save toggle state to project.json
  const saveToggles = useCallback(
    async (newToggles: ProjectToggles, newConfig?: ToggleConfig) => {
      if (!projectPath) return;
      try {
        const res = await fetch("/api/builder/read-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: projectPath + "/project.json" }),
        });
        let meta: any = {};
        if (res.ok) {
          const data = await res.json();
          if (data.content) meta = JSON.parse(data.content);
        }
        meta.toggles = newToggles;
        if (newConfig) meta.toggleConfig = newConfig;
        await fetch("/api/builder/write-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: projectPath + "/project.json",
            content: JSON.stringify(meta, null, 2),
          }),
        });
      } catch {
        // Silently fail — toggles still work in-memory
      }
    },
    [projectPath]
  );

  const handleToggle = useCallback(
    (key: keyof ProjectToggles) => {
      setToggles((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        saveToggles(next, toggleConfig);
        return next;
      });
    },
    [saveToggles, toggleConfig]
  );

  const handleConfigChange = useCallback(
    (key: "calendly" | "mailchimp", field: string, value: string) => {
      setToggleConfig((prev) => {
        const next = {
          ...prev,
          [key]: { ...prev[key], [field]: value },
        };
        saveToggles(toggles, next);
        return next;
      });
    },
    [saveToggles, toggles]
  );

  const selectAll = () => {
    const all = Object.fromEntries(
      TOGGLE_INFO.map((t) => [t.key, true])
    ) as unknown as ProjectToggles;
    setToggles(all);
    saveToggles(all, toggleConfig);
  };

  const deselectAll = () => {
    const none = Object.fromEntries(
      TOGGLE_INFO.map((t) => [t.key, false])
    ) as unknown as ProjectToggles;
    setToggles(none);
    saveToggles(none, toggleConfig);
  };

  const resetDefaults = () => {
    setToggles({ ...DEFAULT_TOGGLES });
    saveToggles({ ...DEFAULT_TOGGLES }, toggleConfig);
  };

  const anyEnabled = TOGGLE_INFO.some((t) => toggles[t.key]);

  // Run the pipeline
  const handleOptimize = useCallback(async () => {
    if (!projectPath || running) return;

    setRunning(true);
    setOptimizeLabel("running");
    setResults([]);
    setLogLines([]);

    // Set all enabled toggles to "running", disabled to "idle"
    const initStatuses: Record<string, ToggleStatus> = {};
    TOGGLE_INFO.forEach((t) => {
      initStatuses[t.key] = toggles[t.key] ? "running" : "idle";
    });
    setStatuses(initStatuses);

    // Add initial log
    const enabledNames = TOGGLE_INFO.filter((t) => toggles[t.key]).map((t) => t.label);
    setLogLines([`Starting optimization — ${enabledNames.length} toggles enabled...`]);

    try {
      const res = await fetch("/api/toggles/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          toggles,
          toggleConfig,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLogLines((prev) => [...prev, `Error: ${data.error || "Pipeline failed"}`]);
        setOptimizeLabel("idle");
        setRunning(false);
        return;
      }

      const pipelineResults: ToggleResult[] = data.results || [];
      setResults(pipelineResults);

      // Update statuses from results
      const newStatuses: Record<string, ToggleStatus> = {};
      const newLogLines: string[] = [`Starting optimization — ${enabledNames.length} toggles enabled...`];

      // Map toggle names back to keys
      const nameToKey: Record<string, string> = {
        Accessibility: "accessibility",
        Privacy: "privacy",
        Security: "security",
        SEO: "seo",
        Performance: "performance",
        Analytics: "analytics",
        "Punch List": "punchList",
        Calendly: "calendly",
        Mailchimp: "mailchimp",
      };

      for (const r of pipelineResults) {
        const key = nameToKey[r.toggle] || r.toggle.toLowerCase();
        if (r.status === "success") {
          newStatuses[key] = "complete";
          newLogLines.push(`${r.toggle} — ${r.summary}`);
          for (const c of r.checks) {
            newLogLines.push(`  ${c.status === "pass" ? "\u2713" : c.status === "warn" ? "\u26A0" : "\u2717"} ${c.label}`);
          }
        } else if (r.status === "failed") {
          newStatuses[key] = "error";
          newLogLines.push(`${r.toggle} — FAILED: ${r.summary}`);
        } else if (r.status === "warning") {
          newStatuses[key] = "warning";
          newLogLines.push(`${r.toggle} — ${r.summary}`);
          for (const c of r.checks) {
            newLogLines.push(`  ${c.status === "pass" ? "\u2713" : c.status === "warn" ? "\u26A0" : "\u2717"} ${c.label}`);
          }
        } else {
          newStatuses[key] = "idle";
        }
      }

      const successCount = pipelineResults.filter((r) => r.status === "success").length;
      const totalEnabled = pipelineResults.filter((r) => r.status !== "skipped").length;
      newLogLines.push("");
      newLogLines.push(`Optimization complete — ${successCount}/${totalEnabled} toggles applied`);

      setStatuses(newStatuses);
      setLogLines(newLogLines);
      setCurrentToggleName("");
      setOptimizeLabel("done");

      // Refresh preview
      window.dispatchEvent(new CustomEvent("builder:refresh-preview"));

      // Reset button after 3 seconds
      setTimeout(() => setOptimizeLabel("idle"), 3000);
    } catch (err: any) {
      setLogLines((prev) => [...prev, `Error: ${err.message || "Network error"}`]);
      setOptimizeLabel("idle");
    } finally {
      setRunning(false);
    }
  }, [projectPath, running, toggles, toggleConfig]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  // Compute summary stats
  const successCount = results.filter((r) => r.status === "success").length;
  const totalRun = results.filter((r) => r.status !== "skipped").length;
  const totalBytes = results.reduce((sum, r) => {
    for (const c of r.checks) {
      const m = c.label.match(/(\d+(?:\.\d+)?)\s*KB/i);
      if (m) sum += parseFloat(m[1]) * 1024;
      const b = c.label.match(/(\d+)B\s+/);
      if (b) sum += parseInt(b[1]);
    }
    return sum;
  }, 0);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-center py-6 relative">
        <div className="flex items-center gap-4">
          <Flame className="w-10 h-10 text-[#FF6700] drop-shadow-[0_0_14px_rgba(255,103,0,0.7)]" />
          <h1
            className="text-5xl font-[900] tracking-[4px] text-center bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(90deg, #FF6700, #FF8C00, #FFD700)",
              filter: "drop-shadow(0 0 24px rgba(255,103,0,0.5))",
            }}
          >
            FORGE OPTIMIZATION
          </h1>
          <Flame className="w-10 h-10 text-[#FF6700] drop-shadow-[0_0_14px_rgba(255,103,0,0.7)]" />
        </div>
        <p className="absolute bottom-1 text-base font-bold text-zinc-400 tracking-widest">
          Automated Site Enhancement Pipeline
        </p>
      </div>

      {/* ── Main content — two columns ── */}
      <div className="flex-1 flex min-h-0 px-6 pb-2 gap-6">
        {/* Left — Toggle Cards 60% */}
        <div className="w-[60%] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            {TOGGLE_INFO.map((info) => {
              const Icon = TOGGLE_ICONS[info.key] || Zap;
              const isOn = toggles[info.key];
              const status = statuses[info.key] || "idle";
              const isRunningCard = status === "running";
              const needsConfig =
                (info.key === "calendly" && isOn) ||
                (info.key === "mailchimp" && isOn);

              return (
                <div
                  key={info.key}
                  className="relative rounded-xl p-5 transition-all duration-200"
                  style={{
                    background: "#0f0f12",
                    borderLeft: `4px solid ${info.color}`,
                    borderTop: `1px solid ${isRunningCard ? info.color : "#222"}`,
                    borderRight: `1px solid ${isRunningCard ? info.color : "#222"}`,
                    borderBottom: `1px solid ${isRunningCard ? info.color : "#222"}`,
                    boxShadow: isRunningCard
                      ? `0 0 20px ${info.color}33, inset 0 0 20px ${info.color}11`
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isRunningCard) {
                      e.currentTarget.style.borderColor = info.color;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRunningCard) {
                      e.currentTarget.style.borderTopColor = "#222";
                      e.currentTarget.style.borderRightColor = "#222";
                      e.currentTarget.style.borderBottomColor = "#222";
                    }
                  }}
                >
                  {/* Toggle switch — top right */}
                  <button
                    onClick={() => handleToggle(info.key)}
                    className="absolute top-4 right-4 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                    style={{
                      background: isOn ? "#FF6700" : "#333",
                    }}
                    disabled={running}
                  >
                    <div
                      className="w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                      style={{
                        transform: isOn ? "translateX(22px)" : "translateX(2px)",
                      }}
                    />
                  </button>

                  {/* Icon + Label */}
                  <div className="flex items-center gap-3 mb-2 pr-14">
                    <Icon
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: info.color }}
                    />
                    <span className="text-[16px] font-bold text-white">
                      {info.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[14px] text-zinc-400 mb-3 pr-14">
                    {info.description}
                  </p>

                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    {status === "idle" && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-zinc-600" />
                        <span className="text-xs text-zinc-500">Idle</span>
                      </>
                    )}
                    {status === "running" && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs text-amber-400 font-medium">Running...</span>
                      </>
                    )}
                    {status === "complete" && (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-medium">Complete</span>
                      </>
                    )}
                    {status === "error" && (
                      <>
                        <X className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs text-red-400 font-medium">Error</span>
                      </>
                    )}
                    {status === "warning" && (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs text-amber-400 font-medium">Warnings</span>
                      </>
                    )}
                  </div>

                  {/* Calendly config input */}
                  {info.key === "calendly" && isOn && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <label className="text-xs text-zinc-400 block mb-1.5">
                        Calendly scheduling URL
                      </label>
                      <input
                        type="url"
                        value={toggleConfig.calendly?.url || ""}
                        onChange={(e) => handleConfigChange("calendly", "url", e.target.value)}
                        placeholder="https://calendly.com/yourname/30min"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-[#006BFF] focus:outline-none transition-colors"
                        disabled={running}
                      />
                    </div>
                  )}

                  {/* Mailchimp config input */}
                  {info.key === "mailchimp" && isOn && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <label className="text-xs text-zinc-400 block mb-1.5">
                        Mailchimp form action URL
                      </label>
                      <input
                        type="url"
                        value={toggleConfig.mailchimp?.actionUrl || ""}
                        onChange={(e) =>
                          handleConfigChange("mailchimp", "actionUrl", e.target.value)
                        }
                        placeholder="https://yourname.us1.list-manage.com/subscribe/post?u=xxx&id=xxx"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-[#FFE01B] focus:outline-none transition-colors"
                        disabled={running}
                      />
                      <p className="mt-1.5 text-[11px] text-zinc-500">
                        Find this in Mailchimp → Audience → Signup forms → Embedded forms → copy the action URL
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Live Results Panel 40% */}
        <div className="w-[40%] flex flex-col rounded-xl border border-zinc-800 bg-[#0f0f12] overflow-hidden">
          {/* Results header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-zinc-800">
            <h2 className="text-lg font-bold text-white">Live Results</h2>
            {results.length > 0 && (
              <p className="text-sm font-semibold text-emerald-400 mt-1">
                Optimization complete — {successCount}/{totalRun} toggles applied
                {totalBytes > 0 && (
                  <span className="text-zinc-400 ml-2">
                    ({totalBytes > 1024 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${totalBytes} B`} saved)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Results content */}
          <div ref={logRef} className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {!running && results.length === 0 && logLines.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-[#FF6700]/10 blur-2xl rounded-full scale-[2]" />
                  <Zap className="relative w-10 h-10 text-[#FF6700]/30" />
                </div>
                <p className="text-sm font-bold text-zinc-500 tracking-wide">
                  Select toggles and click Optimize to begin
                </p>
              </div>
            )}

            {/* Running state — show current toggle + log */}
            {running && (
              <div className="mb-4 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-sm font-bold text-amber-400">
                  {currentToggleName || "Optimizing..."}
                </span>
              </div>
            )}

            {/* Log lines */}
            {logLines.length > 0 && (
              <div className="space-y-1 font-mono text-[13px]">
                {logLines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith("  \u2713")
                        ? "text-emerald-400 pl-2"
                        : line.startsWith("  \u26A0")
                        ? "text-amber-400 pl-2"
                        : line.startsWith("  \u2717")
                        ? "text-red-400 pl-2"
                        : line.startsWith("Error")
                        ? "text-red-400 font-bold"
                        : line.includes("FAILED")
                        ? "text-red-400"
                        : line.startsWith("Optimization complete")
                        ? "text-emerald-400 font-bold mt-2"
                        : line === ""
                        ? "h-2"
                        : "text-zinc-300"
                    }
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* Result summary cards */}
            {!running && results.length > 0 && (
              <div className="mt-4 space-y-3">
                {results
                  .filter((r) => r.status !== "skipped")
                  .map((r) => (
                    <div
                      key={r.toggle}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {r.status === "success" && (
                          <Check className="w-4 h-4 text-emerald-400" />
                        )}
                        {r.status === "failed" && (
                          <X className="w-4 h-4 text-red-400" />
                        )}
                        {r.status === "warning" && (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="text-sm font-bold text-white">
                          {r.toggle}
                        </span>
                        <span className="text-xs text-zinc-500 ml-auto">
                          {r.duration}ms
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">{r.summary}</p>
                      {r.checks
                        .filter((c) => c.status === "warn")
                        .map((c, i) => (
                          <p key={i} className="text-xs text-amber-400 mt-1">
                            {"\u26A0"} {c.label}
                            {c.detail && (
                              <span className="text-zinc-500 ml-1">
                                — {c.detail}
                              </span>
                            )}
                          </p>
                        ))}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-t border-zinc-800 bg-[#0a0a0a]">
        {/* Left — selection buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            disabled={running}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-40"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            disabled={running}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-40"
          >
            Deselect All
          </button>
          <button
            onClick={resetDefaults}
            disabled={running}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-40"
          >
            Defaults
          </button>
        </div>

        {/* Center — OPTIMIZE button */}
        <button
          onClick={handleOptimize}
          disabled={!anyEnabled || running || !projectPath}
          className="px-10 py-3 rounded-xl text-base font-[800] tracking-[2px] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background:
              optimizeLabel === "done"
                ? "linear-gradient(90deg, #22c55e, #16a34a)"
                : "linear-gradient(90deg, #FF6700, #FF8C00, #FFD700)",
            color: optimizeLabel === "done" ? "#fff" : "#000",
            boxShadow:
              optimizeLabel === "done"
                ? "0 0 20px rgba(34,197,94,0.4)"
                : anyEnabled && !running
                ? "0 0 20px rgba(255,103,0,0.3)"
                : "none",
          }}
        >
          {optimizeLabel === "idle" && "OPTIMIZE"}
          {optimizeLabel === "running" && (
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
              OPTIMIZING...
            </span>
          )}
          {optimizeLabel === "done" && "\u2713 OPTIMIZED"}
        </button>

        {/* Right — Close */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
}
