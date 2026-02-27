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
} from "lucide-react";
import { useDeployStore } from "@/lib/stores/deployStore";
import { useBuilderStore } from "@sarge/core";
import { useUIStore } from "@sarge/core";

export default function DeployPanel() {
  const projectPath = useBuilderStore((s) => s.projectPath);
  const projectName = useBuilderStore((s) => s.projectName);
  const showToast = useUIStore((s) => s.showToast);

  const {
    githubUrl,
    vercelUrl,
    netlifyUrl,
    isDeploying,
    lastPush,
    error,
    initProject,
    pushProject,
    exportZip,
    reset,
  } = useDeployStore();

  const [pushSuccess, setPushSuccess] = useState(false);
  const isInitialized = !!(githubUrl || vercelUrl || netlifyUrl);

  // Reset deploy state when project changes
  useEffect(() => {
    reset();
    setPushSuccess(false);
  }, [projectPath, reset]);

  // Clear push success after 3s
  useEffect(() => {
    if (pushSuccess) {
      const t = setTimeout(() => setPushSuccess(false), 3000);
      return () => clearTimeout(t);
    }
  }, [pushSuccess]);

  const handleInit = async () => {
    if (!projectName || !projectPath) return;
    await initProject(projectName, projectPath);
    const state = useDeployStore.getState();
    if (state.error) {
      showToast({ message: `Deploy init failed: ${state.error}`, type: "error" });
    } else {
      showToast({ message: "GitHub, Vercel, Netlify connected", type: "success" });
    }
  };

  const handlePush = async () => {
    if (!projectPath) return;
    await pushProject(projectPath);
    const state = useDeployStore.getState();
    if (state.error) {
      showToast({ message: `Push failed: ${state.error}`, type: "error" });
    } else {
      setPushSuccess(true);
      showToast({
        message: `Pushed ${state.lastPush || "successfully"}`,
        type: "success",
      });
    }
  };

  const handleExport = async () => {
    if (!projectPath) return;
    const zipPath = await exportZip(projectPath);
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

  // ═══ No project open ═══
  if (!projectPath) {
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
          {projectName}
        </span>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* ═══ Init Section ═══ */}
        {!isInitialized ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Connect Services
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Creates a private GitHub repo, links Vercel and Netlify for
                auto-deploy on push.
              </p>
            </div>

            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 space-y-1">
              <p>Requires: <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">gh</code>, <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">vercel</code>, <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">netlify</code> CLIs installed and logged in.</p>
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
            {/* ═══ Service Links ═══ */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Connected Services
              </h3>
              <div className="flex flex-wrap gap-2">
                {githubUrl && (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-80 transition-opacity"
                  >
                    <Github className="h-3.5 w-3.5" />
                    GitHub
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                )}
                {vercelUrl && (
                  <a
                    href={vercelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Vercel Live
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                )}
                {netlifyUrl && (
                  <a
                    href={netlifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-teal-600 text-white hover:opacity-80 transition-opacity"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Netlify Live
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                )}
              </div>
            </div>

            {/* ═══ Push ═══ */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Push Changes
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Commits and pushes all current files. Vercel and Netlify
                  auto-deploy from the push.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePush}
                  disabled={isDeploying}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isDeploying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : pushSuccess ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isDeploying
                    ? "Pushing..."
                    : pushSuccess
                      ? "Deployed"
                      : "Push"}
                </button>

                {lastPush && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    Last: {lastPush}
                  </span>
                )}
              </div>
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
              <p className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap break-words">
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

        {/* ═══ Prerequisites ═══ */}
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 space-y-1 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <p className="font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Prerequisites
          </p>
          <p>
            <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">gh</code>{" "}
            — GitHub CLI, logged in (<code>gh auth login</code>)
          </p>
          <p>
            <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">vercel</code>{" "}
            — Vercel CLI, logged in (<code>vercel login</code>)
          </p>
          <p>
            <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">netlify</code>{" "}
            — Netlify CLI, logged in (<code>netlify login</code>)
          </p>
        </div>
      </div>
    </div>
  );
}
