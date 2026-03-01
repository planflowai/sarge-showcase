"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Code2, Eye, RefreshCw, AlertTriangle, Download, Copy, Check, Maximize2, Minimize2, Radio, GitCompare, X, Library, ChevronLeft, ChevronRight, Save, RotateCcw, Server, Monitor, Rocket } from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildPreviewContent, detectLanguage, detectContentType } from "@/lib/contentDetector";
import { STREAMING_MIN_UPDATE_INTERVAL_MS, STREAMING_MIN_CONTENT_DELTA } from "@/lib/constants";
import { exportToZip, downloadZip } from "@/lib/sarge-build";
import { useUIStore } from "@/lib/stores/uiStore";
import { useArtifactStore } from "@/lib/stores/artifactStore";
import { useBuilderStore } from "@/lib/stores/builderStore";
import { useAirGapStore } from "@/lib/stores/airGapStore";
import BuilderDiffEditor from "./BuilderDiffEditor";
import BuilderProgress from "./BuilderProgress";
import SaveToLibraryDialog from "./SaveToLibraryDialog";

export interface DiffViewState {
  filePath: string;
  originalContent: string;
  proposedContent: string;
}

type ArtifactTab = "code" | "preview" | "diff" | "deploy";

interface ArtifactPanelProps {
  code: string;
  onCodeChange: (code: string) => void;
  activeTab: ArtifactTab;
  onTabChange: (tab: ArtifactTab) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isStreaming?: boolean;
  diffView?: DiffViewState | null;
  onCloseDiff?: () => void;
  lastPrompt?: string; // The prompt that generated the current code
  projectName?: string | null; // If set, use API-based preview with CSS/JS inlining
  deployContent?: React.ReactNode; // Optional deploy panel content
  generationStartTime?: number | null; // When streaming started (for elapsed timer)
}

// Check if HTML code is complete (has closing </html> tag)
function isHtmlComplete(code: string): boolean {
  return /<\/html>/i.test(code);
}

/** Live elapsed-time counter for the streaming progress overlay */
function StreamingTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 200);
    return () => clearInterval(interval);
  }, [startTime]);
  return (
    <span className="text-[10px] text-zinc-400 font-mono">{elapsed}s</span>
  );
}

/** Inline Deploy Panel — export/download options + deployment guidance */
function DeployPanel({
  code,
  projectPath,
  projectName,
  onExport,
  onDownload,
}: {
  code: string;
  projectPath: string | null;
  projectName?: string;
  onExport: () => void;
  onDownload: () => void;
}) {
  const hasCode = code && code.trim().length > 0;
  const name = projectName || 'my-site';

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-1">Deploy Your Build</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Export your code and deploy it anywhere.</p>
      </div>

      {!hasCode ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <Rocket className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Generate some code first, then come back to deploy.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Export as ZIP */}
          <button
            onClick={onExport}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Export as ZIP</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Download {name}.zip with HTML, CSS, and JS — ready to upload to any host.
              </div>
            </div>
          </button>

          {/* Download single file */}
          <button
            onClick={onDownload}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Download File</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Save the current artifact as a single file.
              </div>
            </div>
          </button>

          {/* Deployment guides */}
          <div className="pt-2">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Quick Deploy To</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Vercel', hint: 'vercel deploy' },
                { name: 'Netlify', hint: 'netlify deploy' },
                { name: 'GitHub Pages', hint: 'Push to gh-pages branch' },
                { name: 'Cloudflare', hint: 'wrangler pages deploy' },
              ].map((target) => (
                <div key={target.name} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{target.name}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-0.5 font-mono">{target.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArtifactPanelInner({
  code,
  onCodeChange,
  activeTab,
  onTabChange,
  isFullscreen,
  onToggleFullscreen,
  isStreaming = false,
  diffView,
  onCloseDiff,
  lastPrompt = "",
  projectName = null,
  deployContent,
  generationStartTime = null,
}: ArtifactPanelProps) {
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isFading, setIsFading] = useState(false);  // For smooth fade transitions
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // API-based preview URL
  const [isSaving, setIsSaving] = useState(false);
  // Dev server preview
  const [devPreviewMode, setDevPreviewMode] = useState<'srcdoc' | 'localhost'>('srcdoc');
  const [devServerRunning, setDevServerRunning] = useState(false);
  const [showDevBadge, setShowDevBadge] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastCodeRef = useRef<string>("");
  const lastContentLengthRef = useRef<number>(0); // Track content length for streaming debounce
  const lastUpdateTimeRef = useRef<number>(0); // Track last update time for debounce
  const hadPreviousPreviewRef = useRef<boolean>(false);
  const streamingStartedWithPreviewRef = useRef<boolean>(false);
  const codeEditorRef = useRef<any>(null);
  const showToast = useUIStore((s) => s.showToast);
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);

  // Auto-detect dev server on mount and when preview tab is opened
  useEffect(() => {
    if (activeTab !== 'preview') return;
    let cancelled = false;
    fetch('/api/builder/dev-status')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setDevServerRunning(!!data.running);
        if (data.running && devPreviewMode === 'srcdoc') {
          console.log('[ArtifactPanel] Dev server detected, auto-switching to localhost preview');
          setDevPreviewMode('localhost'); // Auto-switch to live dev server
        }
      })
      .catch(() => {
        if (!cancelled) setDevServerRunning(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Auto-switch to preview tab when streaming completes and there's code to show
  useEffect(() => {
    if (!isStreaming && code && code.length > 50 && activeTab === 'code') {
      console.log('[ArtifactPanel] Streaming complete, auto-switching to preview tab');
      onTabChange('preview');
    }
  }, [isStreaming, code, activeTab, onTabChange]);

  // Artifact versioning
  const { versions, currentVersionIndex, goToVersion, setCode: setArtifactCode, path: artifactStorePath } = useArtifactStore();
  const totalVersions = versions.length + 1; // +1 for current (not yet in history)
  const isAtLatest = currentVersionIndex === versions.length;
  const displayVersion = isAtLatest ? totalVersions : currentVersionIndex + 1;

  const handleVersionPrev = useCallback(() => {
    const target = isAtLatest ? versions.length - 1 : currentVersionIndex - 1;
    if (target >= 0) goToVersion(target);
  }, [isAtLatest, currentVersionIndex, versions.length, goToVersion]);

  const handleVersionNext = useCallback(() => {
    if (isAtLatest) return;
    if (currentVersionIndex < versions.length - 1) {
      goToVersion(currentVersionIndex + 1);
    } else {
      // Restore to latest: set code back and reset index
      const latest = useArtifactStore.getState();
      // The "latest" code is not stored in versions — we need to restore via setCode
      // which saves current to history. Since we're on an old version, call goToVersion
      // with versions.length to conceptually "return to latest" — but goToVersion only
      // works for existing indices. Instead, restore by navigating out of history:
      // We'll call setCode with the most recent version's code (last in array).
      if (versions.length > 0) {
        goToVersion(versions.length - 1);
      }
    }
  }, [isAtLatest, currentVersionIndex, versions.length, goToVersion]);

  const handleRestoreVersion = useCallback(async () => {
    if (isAtLatest) return;
    const versionCode = versions[currentVersionIndex]?.code;
    if (versionCode) {
      // Restore: make this version the new current code
      setArtifactCode(versionCode, artifactStorePath ?? null, null);

      // Write restored version to disk if we have a file path
      const { projectPath: projPath } = useBuilderStore.getState();
      if (artifactStorePath && projPath) {
        // Construct absolute path — same logic as handleApplyFile
        const cleanRelativePath = artifactStorePath.replace(/^[\/\\]+/, '');
        const fullPath = artifactStorePath.match(/^[A-Z]:/i)
          ? artifactStorePath.replace(/\\/g, '/')
          : `${projPath}/${cleanRelativePath}`.replace(/\\/g, '/');
        try {
          const res = await fetch('/api/builder/write-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: fullPath,
              content: versionCode,
              projectPath: projPath,
            }),
          });
          if (!res.ok) {
            console.error('[ArtifactPanel] Failed to write restored version to disk');
          }
        } catch (err) {
          console.error('[ArtifactPanel] Failed to write restored version:', err);
        }
      }

      showToast({ message: `Restored to v${displayVersion}`, type: 'success' });
    }
  }, [isAtLatest, currentVersionIndex, versions, setArtifactCode, artifactStorePath, displayVersion, showToast]);

  // Project save
  const { projectPath, projectName: storeProjectName, markClean } = useBuilderStore();

  const handleSaveToProject = useCallback(async () => {
    if (!code) return;

    let savePath = artifactStorePath || null;

    if (!savePath) {
      // Prompt for filename
      const defaultName = detectLanguage(code) === 'html' ? 'index.html' :
                          detectLanguage(code) === 'css'  ? 'styles.css'  : 'script.js';
      const filename = window.prompt('Save as filename:', defaultName);
      if (!filename) return;
      savePath = projectPath ? `${projectPath}/${filename}` : filename;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/builder/write-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: savePath,
          content: code,
          projectPath: projectPath || savePath,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }

      markClean();
      // Update artifact path in store
      setArtifactCode(code, savePath, null);
      showToast({ message: `Saved to ${savePath.split(/[\\/]/).pop()}`, type: 'success' });

      // Fire-and-forget log update
      if (projectPath && storeProjectName) {
        fetch('/api/builder/update-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            projectName: storeProjectName,
            action: 'append',
            entry: {
              type: 'save',
              filePath: savePath,
              description: `Saved ${savePath.split(/[\\/]/).pop()} from artifact panel`,
              timestamp: Date.now(),
            },
          }),
        }).catch(() => {});
      }
    } catch (err: any) {
      showToast({ message: `Save failed: ${err.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [code, artifactStorePath, projectPath, storeProjectName, markClean, setArtifactCode, showToast]);

  // Memoize code-derived values to prevent unnecessary re-renders
  const memoizedCode = useMemo(() => code || "", [code]);
  const codeLineCount = useMemo(() => memoizedCode.split('\n').length, [memoizedCode]);

  // Streaming debounce constants - prevent strobe effect (values from lib/constants.ts)
  const MIN_UPDATE_INTERVAL = STREAMING_MIN_UPDATE_INTERVAL_MS;
  const MIN_CONTENT_DELTA = STREAMING_MIN_CONTENT_DELTA;

  // Log the projectName prop on render
  console.log(`[ArtifactPanel] Render: projectName="${projectName}", isStreaming=${isStreaming}, code length=${code?.length || 0}`);

  // When project is set and not streaming, use API-based preview for multi-file support
  // DISABLED: API endpoint doesn't exist - use srcdoc instead for inline preview
  useEffect(() => {
    console.log(`[ArtifactPanel] previewUrl effect: projectName="${projectName}", isStreaming=${isStreaming}, activeTab="${activeTab}"`);
    // Always use srcdoc for now - API-based preview not implemented
    console.log(`[ArtifactPanel] Using srcdoc preview (API not implemented)`);
    setPreviewUrl(null);
  }, [projectName, isStreaming, iframeKey]);

  // Detect language for Monaco - memoized to prevent re-renders
  const language = useMemo(() => detectLanguage(memoizedCode), [memoizedCode]);
  const contentType = useMemo(() => detectContentType(memoizedCode), [memoizedCode]);

  /**
   * Rewrite relative asset paths (images, fonts, etc.) to use the asset proxy API.
   * This allows srcdoc iframes to load project files via absolute URLs.
   */
  const rewriteAssetPaths = useCallback((html: string): string => {
    if (!projectPath) return html;
    const encodedProject = encodeURIComponent(projectPath);

    // Rewrite <img src="relative/path.png"> (skip data:, http://, https://, //)
    let result = html.replace(
      /(<img\s[^>]*\bsrc=["'])(?!data:|https?:\/\/|\/\/)([^"']+)(["'])/gi,
      (match, before, src, after) => {
        const encodedFile = encodeURIComponent(src);
        return `${before}/api/builder/asset?projectPath=${encodedProject}&file=${encodedFile}${after}`;
      }
    );

    // Rewrite CSS url('relative/path') in inline styles and <style> blocks
    result = result.replace(
      /url\(["']?(?!data:|https?:\/\/|\/\/)([^"')]+)["']?\)/gi,
      (match, src) => {
        const encodedFile = encodeURIComponent(src);
        return `url('/api/builder/asset?projectPath=${encodedProject}&file=${encodedFile}')`;
      }
    );

    // Rewrite <source src="..."> for video/audio
    result = result.replace(
      /(<source\s[^>]*\bsrc=["'])(?!data:|https?:\/\/|\/\/)([^"']+)(["'])/gi,
      (match, before, src, after) => {
        const encodedFile = encodeURIComponent(src);
        return `${before}/api/builder/asset?projectPath=${encodedProject}&file=${encodedFile}${after}`;
      }
    );

    // Rewrite <link href="style.css"> for stylesheets
    result = result.replace(
      /(<link\s[^>]*\bhref=["'])(?!data:|https?:\/\/|\/\/)([^"']+)(["'])/gi,
      (match, before, href, after) => {
        const encodedFile = encodeURIComponent(href);
        return `${before}/api/builder/asset?projectPath=${encodedProject}&file=${encodedFile}${after}`;
      }
    );

    // Rewrite <script src="script.js">
    result = result.replace(
      /(<script\s[^>]*\bsrc=["'])(?!data:|https?:\/\/|\/\/)([^"']+)(["'])/gi,
      (match, before, src, after) => {
        const encodedFile = encodeURIComponent(src);
        return `${before}/api/builder/asset?projectPath=${encodedProject}&file=${encodedFile}${after}`;
      }
    );

    return result;
  }, [projectPath]);

  // Build preview content and update state - NO iframe remount to prevent flicker
  const buildPreview = useCallback((newCode: string, forceUpdate: boolean = false) => {
    try {
      let content = buildPreviewContent(newCode, airGapEnabled);

      // Rewrite relative asset paths to use the proxy (so images load in srcdoc)
      content = rewriteAssetPaths(content);

      // CRITICAL: Never remount iframe during streaming - just update srcDoc
      // The browser will handle the update smoothly without flashing white
      if (forceUpdate && previewContent.length > 0 && !isStreaming) {
        // Only use fade transition for major updates (not streaming)
        setIsFading(true);
        setTimeout(() => {
          setPreviewContent(content);
          // DON'T increment iframeKey - this causes remount and flash
          setTimeout(() => {
            setIsFading(false);
          }, 50);
        }, 100);
      } else {
        // Direct update without fade - prevents strobe during streaming
        setPreviewContent(content);
      }
      setPreviewError(null);
    } catch (err: any) {
      console.error('[ArtifactPanel] buildPreview error:', err);
      setPreviewError(err.message || "Failed to build preview");
    }
  }, [previewContent.length, isStreaming, airGapEnabled, rewriteAssetPaths]);

  // Track when streaming starts - do we already have a preview?
  useEffect(() => {
    if (isStreaming) {
      // Remember if we had a preview when streaming started
      streamingStartedWithPreviewRef.current = previewContent.length > 0;
      console.log('[ArtifactPanel] Streaming started, had previous preview:', streamingStartedWithPreviewRef.current);
    }
  }, [isStreaming, previewContent.length]);

  // Update preview when code changes - with anti-flicker debouncing
  useEffect(() => {
    if (!code) {
      setPreviewContent('');
      lastCodeRef.current = '';
      lastContentLengthRef.current = 0;
      hadPreviousPreviewRef.current = false;
      return;
    }

    // Skip if code hasn't actually changed
    if (code === lastCodeRef.current) {
      return;
    }
    lastCodeRef.current = code;

    const now = Date.now();
    const contentLength = code.length;
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    const contentDelta = contentLength - lastContentLengthRef.current;

    if (isStreaming) {
      // STREAMING MODE - prevent strobe by careful debouncing
      if (streamingStartedWithPreviewRef.current) {
        // UPDATE MODE: We have an existing preview - hold it until code is complete
        // Only update when we see </html> (complete HTML)
        if (isHtmlComplete(code)) {
          console.log('[ArtifactPanel] Update mode: HTML complete, swapping preview');
          buildPreview(code, true);
          lastUpdateTimeRef.current = now;
          lastContentLengthRef.current = contentLength;
        }
        // Don't update otherwise - keep showing old preview (prevents strobe)
      } else {
        // FIRST BUILD MODE: No existing preview - show live streaming with debounce
        // Only update when enough time has passed AND enough new content
        const shouldUpdate = timeSinceLastUpdate >= MIN_UPDATE_INTERVAL &&
          (contentDelta >= MIN_CONTENT_DELTA || timeSinceLastUpdate > 1000);

        if (shouldUpdate) {
          // Clear any pending update
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
          }
          buildPreview(code, false);
          lastUpdateTimeRef.current = now;
          lastContentLengthRef.current = contentLength;
        } else if (!debounceRef.current) {
          // Schedule a delayed update to ensure we don't miss content
          debounceRef.current = setTimeout(() => {
            buildPreview(code, false);
            lastUpdateTimeRef.current = Date.now();
            lastContentLengthRef.current = code.length;
            debounceRef.current = null;
          }, MIN_UPDATE_INTERVAL);
        }
      }
    } else {
      // NOT STREAMING - immediate update
      // Clear any pending debounced update
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      buildPreview(code, true);
      lastUpdateTimeRef.current = now;
      lastContentLengthRef.current = contentLength;
      hadPreviousPreviewRef.current = true;
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, isStreaming, buildPreview]);

  // When streaming ends, ensure we have the final preview
  useEffect(() => {
    if (!isStreaming && code && streamingStartedWithPreviewRef.current) {
      // Streaming just ended in update mode - make sure we show final code
      console.log('[ArtifactPanel] Streaming ended in update mode, showing final preview');
      buildPreview(code, true);
      streamingStartedWithPreviewRef.current = false;
    }
  }, [isStreaming, code, buildPreview]);

  // Handle editor change
  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || "";
    onCodeChange(newCode);
  };

  // Capture Monaco editor instance for auto-scroll
  const handleEditorMount = useCallback((editor: any) => {
    codeEditorRef.current = editor;
  }, []);

  // Auto-scroll Code tab to bottom during streaming
  useEffect(() => {
    if (isStreaming && codeEditorRef.current && activeTab === 'code') {
      const editor = codeEditorRef.current;
      const model = editor.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        editor.revealLine(lineCount);
      }
    }
  }, [code, isStreaming, activeTab]);

  // Force refresh preview
  const handleRefresh = () => {
    try {
      let content = buildPreviewContent(code, airGapEnabled);
      content = rewriteAssetPaths(content);
      setPreviewContent(content);
      setPreviewError(null);
    } catch (err: any) {
      setPreviewError(err.message || "Failed to build preview");
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download as file
  const handleDownload = () => {
    const ext = language === 'typescript' || language === 'javascript' ? 'tsx' :
                language === 'html' ? 'html' :
                language === 'css' ? 'css' :
                language === 'json' ? 'json' : 'txt';
    const filename = `artifact.${ext}`;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ message: `Downloaded ${filename}`, type: "success" });
  };

  // Content type badge
  const getContentTypeBadge = () => {
    switch (contentType) {
      case "html-document":
        return { label: "HTML", color: "bg-orange-500" };
      case "react-jsx":
        return { label: "React", color: "bg-cyan-500" };
      case "html-snippet":
        return { label: "HTML", color: "bg-orange-500" };
      default:
        return { label: "Text", color: "bg-zinc-500" };
    }
  };

  const badge = getContentTypeBadge();

  return (
    <div
      className={cn(
        "h-full bg-white dark:bg-zinc-900 flex flex-col",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => onTabChange("code")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === "code"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
              Code
            </button>
            <button
              onClick={() => onTabChange("preview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === "preview"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            {/* Diff tab - only shown when diffView is active */}
            {diffView && (
              <button
                onClick={() => onTabChange("diff")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  activeTab === "diff"
                    ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shadow-sm"
                    : "text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                )}
              >
                <GitCompare className="h-3.5 w-3.5" />
                Diff
              </button>
            )}
            {/* Deploy tab - always visible */}
            <button
              onClick={() => onTabChange("deploy")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === "deploy"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Rocket className="h-3.5 w-3.5" />
              Deploy
            </button>
          </div>

          {/* Content type badge */}
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium text-white", badge.color)}>
            {badge.label}
          </span>

          {/* Live streaming indicator */}
          {isStreaming && (
            <span className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded border",
              streamingStartedWithPreviewRef.current
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "bg-red-500/10 border-red-500/30 text-red-500"
            )}>
              <Radio className="h-3 w-3 animate-pulse" />
              <span className="text-[10px] font-medium">
                {streamingStartedWithPreviewRef.current ? "Updating..." : "Live"}
              </span>
            </span>
          )}

          {/* Version navigator — only show when there are multiple versions */}
          {totalVersions > 1 && !isStreaming && (
            <div className="flex items-center gap-1 pl-2 border-l border-zinc-200 dark:border-zinc-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleVersionPrev}
                disabled={currentVersionIndex === 0 || (!isAtLatest && currentVersionIndex === 0)}
                className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30"
                title="Previous version"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] font-medium text-zinc-500 whitespace-nowrap">
                v{displayVersion} of {totalVersions}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleVersionNext}
                disabled={isAtLatest}
                className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30"
                title="Next version"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              {/* Restore button — only when viewing an older version */}
              {!isAtLatest && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestoreVersion}
                  className="h-6 gap-1 px-2 text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                  title="Restore this version as current"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restore
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Dev Server toggle (preview tab only) */}
          {activeTab === "preview" && (
            <>
              {/* Auto-detect badge: "Dev Server Detected" */}
              {showDevBadge && devServerRunning && devPreviewMode === 'srcdoc' && (
                <div className="flex items-center gap-1.5 mr-1 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400">
                  <Server className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Dev Server Detected</span>
                  <button
                    onClick={() => { setDevPreviewMode('localhost'); setShowDevBadge(false); }}
                    className="text-[10px] underline hover:no-underline ml-1"
                  >
                    Switch
                  </button>
                  <button
                    onClick={() => setShowDevBadge(false)}
                    className="ml-0.5 hover:text-blue-800 dark:hover:text-blue-200"
                    title="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {/* Preview mode toggle: srcdoc ⇄ localhost */}
              <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden mr-1">
                <button
                  onClick={() => setDevPreviewMode('srcdoc')}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors",
                    devPreviewMode === 'srcdoc'
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                  title="Preview from generated code (srcdoc)"
                >
                  <Monitor className="h-3 w-3" />
                  srcdoc
                </button>
                <button
                  onClick={() => setDevPreviewMode('localhost')}
                  disabled={!devServerRunning}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors border-l border-zinc-200 dark:border-zinc-700",
                    devPreviewMode === 'localhost'
                      ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      : devServerRunning
                        ? "text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
                        : "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                  )}
                  title={devServerRunning ? "Preview from localhost:3000" : "No dev server running"}
                >
                  <Server className="h-3 w-3" />
                  localhost
                </button>
              </div>
            </>
          )}

          {/* Refresh button (preview tab only) */}
          {activeTab === "preview" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              title="Refresh preview"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          {/* Fullscreen toggle button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFullscreen}
            className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "code" && (
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 12 },
              readOnly: isStreaming,
            }}
          />
        )}

        {activeTab === "preview" && (
          <div className="h-full w-full bg-white dark:bg-zinc-900 relative">
            {/* Streaming progress overlay — shows at top of preview during generation */}
            {isStreaming && (previewContent || previewUrl) && code && code.trim().length > 0 && (
              <div className="absolute top-0 left-0 right-0 z-10">
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" style={{ width: '60%' }} />
                </div>
                <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-700/50">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-medium text-emerald-400">Building...</span>
                  <span className="text-[10px] text-zinc-400 font-mono">{code.length.toLocaleString()} chars</span>
                  {generationStartTime && (
                    <StreamingTimer startTime={generationStartTime} />
                  )}
                </div>
              </div>
            )}

            {/* Dev server mode — point iframe directly at localhost */}
            {devPreviewMode === 'localhost' && devServerRunning && !isStreaming ? (
              <iframe
                key="localhost-preview"
                src="http://localhost:3000"
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
                title="Dev Server Preview (localhost:3000)"
                style={{ display: 'block', minHeight: '100%' }}
              />
            ) : previewError ? (
              <div className="flex items-center gap-2 p-4 text-red-500">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">{previewError}</span>
              </div>
            ) : previewUrl ? (
              // API-based preview for multi-file projects (inlines CSS/JS)
              // Use key for API preview since URL changes require reload
              <iframe
                key={previewUrl}
                ref={iframeRef}
                src={previewUrl}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
                title="Preview"
                style={{
                  display: 'block',
                  minHeight: '100%',
                  opacity: isFading ? 0.3 : 1,
                  transition: 'opacity 0.15s ease-in-out',
                }}
              />
            ) : previewContent && code && code.trim().length > 0 ? (
              // srcdoc-based preview for streaming/no project
              // CRITICAL: No key prop - prevents iframe remount which causes white flash
              <iframe
                ref={iframeRef}
                srcDoc={previewContent}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
                title="Preview"
                style={{
                  display: 'block',
                  minHeight: '100%',
                  // Smooth opacity for non-streaming updates only
                  opacity: isFading ? 0.3 : 1,
                  transition: 'opacity 0.1s ease-in-out',
                }}
              />
            ) : isStreaming ? (
              // Streaming but no preview content yet — show rich progress panel
              <BuilderProgress
                isGenerating={true}
                hasCode={code.length > 0}
                codeLength={code.length}
                startTime={generationStartTime || undefined}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500">
                <Eye className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm font-medium">No preview available</p>
                <p className="text-xs mt-1 text-zinc-400 dark:text-zinc-600">
                  Generate some code to see it here
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "diff" && diffView && (
          <div className="h-full flex flex-col">
            {/* Diff header with file path and close button */}
            <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-200 dark:border-indigo-500/30">
              <div className="flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {diffView.filePath}
                </span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">
                  {diffView.originalContent ? "Modified" : "New File"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCloseDiff}
                className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                title="Close diff"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <BuilderDiffEditor
                originalContent={diffView.originalContent}
                modifiedContent={diffView.proposedContent}
                filePath={diffView.filePath}
              />
            </div>
          </div>
        )}

        {activeTab === "deploy" && (
          <div className="h-full overflow-auto">
            {deployContent ? (
              React.isValidElement(deployContent)
                ? React.cloneElement(deployContent as React.ReactElement<any>, { projectPath, projectName: storeProjectName })
                : deployContent
            ) : (
              <DeployPanel
                code={code}
                projectPath={projectPath}
                projectName={projectName || storeProjectName || undefined}
                onExport={async () => {
                  if (!code) return;
                  const name = projectName || storeProjectName || 'client-site';
                  const blob = await exportToZip(code, '', undefined, name);
                  downloadZip(blob, name);
                  showToast({ message: `Exported ${name} as zip`, type: 'success' });
                }}
                onDownload={handleDownload}
              />
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="h-10 flex-shrink-0 flex items-center justify-between px-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
        <div className="flex items-center gap-1">
          {/* Export for Client (SargeBuild) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (!code) return;
              const name = projectName || storeProjectName || 'client-site';
              const blob = await exportToZip(code, '', undefined, name);
              downloadZip(blob, name);
              showToast({ message: `Exported ${name} as zip`, type: 'success' });
            }}
            disabled={!code}
            className="h-7 gap-1.5 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
            title="Export as client-ready zip (HTML/CSS/JS + deploy instructions)"
          >
            <Download className="h-3.5 w-3.5" />
            Export for Client
          </Button>

          {/* Download */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={!code}
            className="h-7 gap-1.5 px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Download file"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>

          {/* Copy */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!code}
            className="h-7 gap-1.5 px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>

          {/* Save to Library */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            disabled={!code}
            className="h-7 gap-1.5 px-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
            title="Save to component library"
          >
            <Library className="h-3.5 w-3.5" />
            Save to Library
          </Button>

          {/* Save to Project / Save as File */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveToProject}
            disabled={!code || isSaving}
            className={cn(
              "h-7 gap-1.5 px-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-500/10",
              projectPath
                ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
            title={projectPath ? "Save to project folder" : "Save as file (no project open)"}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : projectPath ? "Save to Project" : "Save as File"}
          </Button>
        </div>

        {/* Code line count - uses memoized value */}
        {memoizedCode && (
          <span className="text-[10px] text-zinc-500">
            {codeLineCount} lines
          </span>
        )}
      </div>

      {/* Save to Library Dialog */}
      <SaveToLibraryDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        code={memoizedCode}
        prompt={lastPrompt}
        thumbnail={null}
      />
    </div>
  );
}

// Memoize the entire component to prevent unnecessary re-renders
// Only re-renders when props actually change (shallow comparison)
const ArtifactPanel = memo(ArtifactPanelInner, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these props changed
  return (
    prevProps.code === nextProps.code &&
    prevProps.activeTab === nextProps.activeTab &&
    prevProps.isFullscreen === nextProps.isFullscreen &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.projectName === nextProps.projectName &&
    prevProps.diffView === nextProps.diffView &&
    prevProps.lastPrompt === nextProps.lastPrompt &&
    prevProps.generationStartTime === nextProps.generationStartTime
  );
});

ArtifactPanel.displayName = 'ArtifactPanel';

export default ArtifactPanel;
