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
} from "lucide-react";
import { useDeployStore } from "@/lib/stores/deployStore";
import { useUIStore } from "@sarge/core";

interface DeployPanelProps {
  projectPath?: string | null;
  projectName?: string | null;
}

export default function DeployPanel({ projectPath, projectName }: DeployPanelProps) {
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

  // When project changes, reset then auto-detect existing connections
  useEffect(() => {
    reset();
    if (projectPath) {
      detectProject(projectPath);
    }
  }, [projectPath, reset, detectProject]);

  const handleInit = async () => {
    if (!projectName || !projectPath) return;
    await initProject(projectName, projectPath);
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

  const handlePush = async () => {
    if (!projectPath) return;
    await pushProject(projectPath, projectName || "");
    const state = useDeployStore.getState();
    if (state.error) {
      showToast({ message: `Push failed: ${state.error}`, type: "error" });
    }
    // Success feedback is shown inline — no toast needed
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
                  <Globe className="h-5 w-5 text-orange-500 flex-shrink-0" />
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
            </div>

            {/* ═══ Push ═══ */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Push Changes
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Commits and pushes all current files to GitHub.
                  {(cloudflareUrl || vercelUrl || netlifyUrl) &&
                    " Connected services auto-deploy from the push."}
                </p>
              </div>

              <button
                onClick={handlePush}
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
