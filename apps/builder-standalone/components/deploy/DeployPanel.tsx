"use client";

import { useState, useEffect } from "react";
import {
  Rocket,
  Github,
  Globe,
  Send,
  Download,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  FolderOpen,
  X,
  Info,
  Cloud,
  CheckCircle2,
  XCircle,
  MinusCircle,
  RefreshCw,
  Minus,
} from "lucide-react";

interface ToggleResult {
  toggle: string;
  status: "success" | "skipped" | "failed";
  details: string;
  duration: number;
}
import { useDeployStore, type DeployTarget } from "@/lib/stores/deployStore";
import { useUIStore } from "@sarge/core";
import { useBuilderStore } from "@sarge/builder";
import { TOGGLE_INFO, DEFAULT_TOGGLES, type ProjectToggles } from "@/lib/types/project";

interface DeployPanelProps {
  projectPath?: string | null;
  projectName?: string | null;
}

const DEPLOY_TARGETS: { id: DeployTarget; label: string; color: string; icon: typeof Github }[] = [
  { id: "github", label: "GitHub", color: "zinc", icon: Github },
  { id: "vercel", label: "Vercel", color: "zinc", icon: Globe },
  { id: "netlify", label: "Netlify", color: "teal", icon: Globe },
  { id: "cloudflare", label: "Cloudflare Pages", color: "orange", icon: Cloud },
];

export default function DeployPanel({ projectPath, projectName }: DeployPanelProps) {
  const { projectPath: storeProjectPath, projectName: storeProjectName } = useBuilderStore();
  const activePath = projectPath || storeProjectPath;
  const activeName = projectName || storeProjectName;
  const showToast = useUIStore((s) => s.showToast);

  const {
    githubUrl,
    cloudflareUrl,
    vercelUrl,
    netlifyUrl,
    isDeploying,
    isDetecting,
    lastPush,
    error,
    detectProject,
    initProject,
    pushProject,
    exportZip,
    reset,
  } = useDeployStore();

  const isInitialized = !!(githubUrl || cloudflareUrl || vercelUrl || netlifyUrl);

  // Push target selection popup state
  const [showPushPopup, setShowPushPopup] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<DeployTarget[]>(["github"]);

  // Toggle pipeline state
  const [toggleResults, setToggleResults] = useState<ToggleResult[] | null>(null);
  const [isRunningToggles, setIsRunningToggles] = useState(false);

  // Toggle selector state — which toggles user wants to run before deploy
  const [selectedToggles, setSelectedToggles] = useState<ProjectToggles>({ ...DEFAULT_TOGGLES });

  // When project changes, reset then auto-detect existing connections + load toggle defaults
  useEffect(() => {
    reset();
    setToggleResults(null);
    setIsRunningToggles(false);
    setSelectedToggles({ ...DEFAULT_TOGGLES });
    if (activePath) {
      detectProject(activePath);
      // Load project.json toggle defaults (if exists)
      fetch("/api/project/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: activePath }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.toggles) {
            setSelectedToggles({ ...DEFAULT_TOGGLES, ...data.toggles });
          }
        })
        .catch(() => {});
    }
  }, [activePath, reset, detectProject]);

  const handleInit = async () => {
    if (!activeName || !activePath) return;
    await initProject(activeName, activePath);
    const state = useDeployStore.getState();
    if (state.error) {
      showToast({ message: `Deploy failed: ${state.error}`, type: "error" });
    } else {
      const connected: string[] = [];
      if (state.githubUrl) connected.push("GitHub");
      if (state.vercelUrl) connected.push("Vercel");
      if (state.netlifyUrl) connected.push("Netlify");
      if (state.cloudflareUrl) connected.push("Cloudflare");
      showToast({
        message: `Connected: ${connected.join(", ")}`,
        type: "success",
      });
    }
  };

  const handlePushConfirm = async () => {
    if (!activePath || selectedTargets.length === 0) return;
    setShowPushPopup(false);
    setToggleResults(null);

    // Step 1: Run toggle pipeline (only if at least one toggle is checked)
    const anyToggleEnabled = Object.values(selectedToggles).some(Boolean);
    if (anyToggleEnabled) {
      setIsRunningToggles(true);
      try {
        const res = await fetch("/api/toggles/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPath: activePath, toggles: selectedToggles }),
        });
        if (res.ok) {
          const data = await res.json();
          setToggleResults(data.results || []);
        } else {
          // Pipeline failed — still proceed with deploy
          setToggleResults([]);
        }
      } catch {
        // Network error — still proceed with deploy
        setToggleResults([]);
      }
      setIsRunningToggles(false);
    }

    // Step 2: Deploy
    await pushProject(activePath, activeName || "", selectedTargets);
    const state = useDeployStore.getState();
    if (state.error) {
      showToast({ message: `Push failed: ${state.error}`, type: "error" });
    }
  };

  const toggleTarget = (target: DeployTarget) => {
    setSelectedTargets((prev) => {
      if (target === "github") return prev; // GitHub is always required
      return prev.includes(target)
        ? prev.filter((t) => t !== target)
        : [...prev, target];
    });
  };

  const handleExport = async () => {
    if (!activePath) return;
    const zipPath = await exportZip(activePath);
    const state = useDeployStore.getState();
    if (state.error) {
      showToast({ message: `Export failed: ${state.error}`, type: "error" });
    } else if (zipPath) {
      showToast({
        message: `ZIP exported to ${zipPath}`,
        type: "success",
        duration: 8000,
      });
    }
  };

  // Helper: get connection status for a target
  const getTargetUrl = (target: DeployTarget): string | null => {
    switch (target) {
      case "github": return githubUrl;
      case "vercel": return vercelUrl;
      case "netlify": return netlifyUrl;
      case "cloudflare": return cloudflareUrl;
    }
  };

  // Helper: get deploy result status indicator
  const getDeployResultIcon = (target: DeployTarget) => {
    if (!lastPush?.deployResults) return null;
    const status = lastPush.deployResults[target];
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "skipped":
        return <MinusCircle className="h-3.5 w-3.5 text-zinc-400" />;
      default:
        return null;
    }
  };

  // ═══ No project open ═══
  if (!activePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 gap-3 p-8">
        <FolderOpen className="h-12 w-12 text-zinc-400 dark:text-zinc-600" />
        <p className="text-sm font-medium">Open a project first</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
          Create or open a project from the sidebar to enable deployment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <Rocket className="h-5 w-5 text-indigo-500" />
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Deploy
        </h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">
          {activeName}
        </span>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* ═══ Deploy Targets — status indicators for all 4 ═══ */}
        {isInitialized && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Deploy Targets
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {DEPLOY_TARGETS.map(({ id, label, icon: Icon }) => {
                const url = getTargetUrl(id);
                const isConnected = !!url;
                const resultIcon = getDeployResultIcon(id);
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                      isConnected
                        ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50"
                        : "bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 ${isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold ${isConnected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>
                        {label}
                      </div>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] text-indigo-500 hover:underline truncate block"
                        >
                          {url.replace(/https?:\/\/(www\.)?/, "").slice(0, 30)}
                        </a>
                      )}
                    </div>
                    {resultIcon || (
                      isConnected
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ Detecting existing connections ═══ */}
        {isDetecting ? (
          <div className="flex items-center gap-3 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Checking for existing connections...
            </span>
          </div>
        ) : !isInitialized ? (
          /* ═══ Init Section ═══ */
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Connect to GitHub
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Creates a private GitHub repo and pushes your project.
                If you have Vercel, Netlify, or Cloudflare CLIs installed,
                those will be linked automatically too.
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
              <Info className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                Requires <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded font-bold">GITHUB_TOKEN</code> in{" "}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">.env.local</code> with{" "}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">repo</code> scope.
              </p>
            </div>

            <button
              onClick={handleInit}
              disabled={isDeploying}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {isDeploying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {isDeploying ? "Connecting..." : "Create Project"}
            </button>
          </div>
        ) : (
          <>
            {/* ═══ Your Links ═══ */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Your Links
              </h3>

              {/* GitHub — always first */}
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  <Github className="h-5 w-5 text-zinc-900 dark:text-white flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">GitHub Repo</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {githubUrl.replace("https://github.com/", "")}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                </a>
              )}

              {/* Cloudflare Pages */}
              {cloudflareUrl && (
                <a
                  href={cloudflareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors border border-orange-200 dark:border-orange-800/50"
                >
                  <Cloud className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">Cloudflare Pages</div>
                    <div className="text-[11px] text-orange-600 dark:text-orange-400 truncate">{cloudflareUrl}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                </a>
              )}

              {/* Vercel */}
              {vercelUrl && (
                <a
                  href={vercelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  <Globe className="h-5 w-5 text-zinc-900 dark:text-white flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">Vercel</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{vercelUrl}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                </a>
              )}

              {/* Netlify */}
              {netlifyUrl && (
                <a
                  href={netlifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors border border-teal-200 dark:border-teal-800/50"
                >
                  <Globe className="h-5 w-5 text-teal-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">Netlify</div>
                    <div className="text-[11px] text-teal-600 dark:text-teal-400 truncate">{netlifyUrl}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                </a>
              )}

              {/* No optional services connected */}
              {!cloudflareUrl && !vercelUrl && !netlifyUrl && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <Info className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Install <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">vercel</code>,{" "}
                    <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">netlify-cli</code>, or{" "}
                    <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">wrangler</code> to auto-link hosting on next init.
                  </p>
                </div>
              )}

              {/* Re-link missing services */}
              {(!cloudflareUrl || !vercelUrl || !netlifyUrl) && (
                <button
                  onClick={handleInit}
                  disabled={isDeploying}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
                >
                  {isDeploying ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {isDeploying ? "Linking..." : "Link missing services"}
                </button>
              )}
            </div>

            {/* ═══ Push — with target selection popup ═══ */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Push Changes
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Commits and pushes to selected targets. Pick where to deploy.
                </p>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowPushPopup(!showPushPopup)}
                  disabled={isDeploying}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isDeploying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isDeploying ? "Pushing..." : "Push"}
                </button>

                {/* ═══ Combined Toggle + Target Selection Popup ═══ */}
                {showPushPopup && !isDeploying && (
                  <div className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xl z-50 p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        Run & Deploy
                      </h4>
                      <button
                        onClick={() => setShowPushPopup(false)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* ── Build Toggles ── */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Build Toggles
                        </span>
                        <button
                          onClick={() => {
                            const allOn = Object.values(selectedToggles).every(Boolean);
                            const next: ProjectToggles = {} as ProjectToggles;
                            for (const k of Object.keys(selectedToggles) as (keyof ProjectToggles)[]) {
                              next[k] = !allOn;
                            }
                            setSelectedToggles(next);
                          }}
                          className="text-[9px] font-medium text-indigo-500 hover:text-indigo-400"
                        >
                          {Object.values(selectedToggles).every(Boolean) ? "Uncheck all" : "Check all"}
                        </button>
                      </div>
                      {TOGGLE_INFO.map(({ key, label, description, color }) => {
                        const isChecked = selectedToggles[key];
                        return (
                          <button
                            key={key}
                            onClick={() =>
                              setSelectedToggles((prev) => ({ ...prev, [key]: !prev[key] }))
                            }
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                              isChecked
                                ? "bg-zinc-100 dark:bg-zinc-700/50 border border-zinc-300 dark:border-zinc-600"
                                : "bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/30"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isChecked ? "border-transparent" : "border-zinc-300 dark:border-zinc-600"
                              }`}
                              style={isChecked ? { backgroundColor: color } : {}}
                            >
                              {isChecked && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-semibold ${isChecked ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-400"}`}>
                                {label}
                              </div>
                              <div className="text-[9px] text-zinc-400 truncate">
                                {description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Divider ── */}
                    <div className="border-t border-zinc-200 dark:border-zinc-700" />

                    {/* ── Deploy Targets ── */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Deploy Targets
                      </span>
                      {DEPLOY_TARGETS.map(({ id, label, icon: Icon }) => {
                        const url = getTargetUrl(id);
                        const isConnected = !!url;
                        const isSelected = selectedTargets.includes(id);
                        const isGithub = id === "github";

                        return (
                          <button
                            key={id}
                            onClick={() => toggleTarget(id)}
                            disabled={isGithub}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              isSelected
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700"
                                : "bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                            } ${!isConnected && !isGithub ? "opacity-40 cursor-not-allowed" : ""} ${isGithub ? "cursor-default" : ""}`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-zinc-300 dark:border-zinc-600"
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>

                            <Icon className={`h-4 w-4 flex-shrink-0 ${isConnected ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}`} />

                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{label}</div>
                              <div className="text-[9px] text-zinc-400 truncate">
                                {isConnected ? (url?.replace(/https?:\/\/(www\.)?/, "").slice(0, 35)) : "Not connected"}
                              </div>
                            </div>

                            {isConnected ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Run & Deploy Button ── */}
                    <button
                      onClick={handlePushConfirm}
                      disabled={selectedTargets.length === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {Object.values(selectedToggles).some(Boolean)
                        ? `Run ${Object.values(selectedToggles).filter(Boolean).length} toggle${Object.values(selectedToggles).filter(Boolean).length !== 1 ? "s" : ""} & Deploy`
                        : `Push to ${selectedTargets.length} target${selectedTargets.length !== 1 ? "s" : ""}`}
                    </button>
                  </div>
                )}
              </div>

              {/* ═══ Toggle Pipeline Results ═══ */}
              {(isRunningToggles || toggleResults) && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                    {isRunningToggles ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {isRunningToggles ? "Running toggles..." : "Toggles complete"}
                    </span>
                  </div>
                  {toggleResults && toggleResults.length > 0 && (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {toggleResults.map((r) => (
                        <div
                          key={r.toggle}
                          className="flex items-center gap-2 px-3 py-1.5"
                        >
                          {r.status === "success" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                          ) : r.status === "failed" ? (
                            <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                          ) : (
                            <Minus className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                          )}
                          <span
                            className={`text-xs font-semibold min-w-[80px] ${
                              r.status === "success"
                                ? "text-zinc-800 dark:text-zinc-200"
                                : r.status === "failed"
                                ? "text-red-600 dark:text-red-400"
                                : "text-zinc-400"
                            }`}
                          >
                            {r.toggle}
                          </span>
                          <span
                            className={`text-[11px] flex-1 truncate ${
                              r.status === "skipped"
                                ? "text-zinc-400 italic"
                                : r.status === "failed"
                                ? "text-red-500"
                                : "text-zinc-500 dark:text-zinc-400"
                            }`}
                          >
                            {r.status === "skipped" ? "skipped" : `— ${r.details}`}
                          </span>
                          {r.duration > 0 && (
                            <span className="text-[9px] text-zinc-400 tabular-nums flex-shrink-0">
                              {r.duration}ms
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ Push Result — persistent, clear feedback ═══ */}
              {lastPush && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg border ${
                    lastPush.message === "No changes to push"
                      ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                      : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50"
                  }`}
                >
                  <Check
                    className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                      lastPush.message === "No changes to push"
                        ? "text-zinc-400"
                        : "text-emerald-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-bold ${
                        lastPush.message === "No changes to push"
                          ? "text-zinc-600 dark:text-zinc-300"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {lastPush.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {lastPush.commitHash && (
                        <span className="font-mono">
                          Commit: {lastPush.commitHash}
                        </span>
                      )}
                      <span>
                        {new Date(lastPush.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Per-target deploy results */}
                    {lastPush.deployResults && lastPush.message !== "No changes to push" && (
                      <div className="flex items-center gap-3 mt-2">
                        {Object.entries(lastPush.deployResults).map(([target, status]) => (
                          <span
                            key={target}
                            className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                              status === "success"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : status === "failed"
                                ? "text-red-500"
                                : "text-zinc-400"
                            }`}
                          >
                            {status === "success" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : status === "failed" ? (
                              <XCircle className="h-3 w-3" />
                            ) : (
                              <MinusCircle className="h-3 w-3" />
                            )}
                            {target.charAt(0).toUpperCase() + target.slice(1)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Quick links to verify */}
                    {lastPush.message !== "No changes to push" && githubUrl && (
                      <div className="flex items-center gap-2 mt-2">
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <Github className="h-3 w-3" />
                          Verify on GitHub
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                        {cloudflareUrl && (
                          <a
                            href={cloudflareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:underline"
                          >
                            Cloudflare
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {vercelUrl && (
                          <a
                            href={vercelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 hover:underline"
                          >
                            Vercel
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {netlifyUrl && (
                          <a
                            href={netlifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            Netlify
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ Export ═══ */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Export ZIP
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Flat structure with index.html at root, includes vercel.json
                  SPA rewrite. Ready for client handoff.
                </p>
              </div>

              <button
                onClick={handleExport}
                disabled={isDeploying}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {isDeploying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isDeploying ? "Exporting..." : "Export ZIP"}
              </button>
            </div>
          </>
        )}

        {/* ═══ Error Display ═══ */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-700 dark:text-red-400">
                Something went wrong
              </p>
              <p className="text-xs text-red-600 dark:text-red-400/80 whitespace-pre-wrap break-words mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={() => useDeployStore.setState({ error: null })}
              className="text-red-400 hover:text-red-600 flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
