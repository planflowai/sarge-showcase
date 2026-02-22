"use client";

import { useEffect, useState, useRef } from "react";
import { Eye, RefreshCw, Maximize2, Minimize2, Radio, Code2 } from "lucide-react";
import { useWorkspaceStore } from "@/lib/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildPreviewContent } from "@/lib/contentDetector";

export default function PreviewPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [previewContent, setPreviewContent] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Workspace store
  const {
    hydrate,
    hydrated,
    setActiveWindow,
    previewCode,
    previewIsStreaming,
    projectName,
  } = useWorkspaceStore();

  // Hydrate store on mount and log state for debugging
  useEffect(() => {
    if (!hydrated) {
      hydrate();
      console.log('[WorkspacePreview] Hydrating workspace store...');
    }
  }, [hydrated, hydrate]);

  // Log when previewCode changes
  useEffect(() => {
    console.log('[WorkspacePreview] previewCode updated:', {
      length: previewCode?.length || 0,
      hasContent: !!previewCode,
      isStreaming: previewIsStreaming,
    });
  }, [previewCode, previewIsStreaming]);

  // Register window as active on mount
  useEffect(() => {
    setActiveWindow("preview", true);
    return () => setActiveWindow("preview", false);
  }, [setActiveWindow]);

  // Track window position
  useEffect(() => {
    const handleResize = () => {
      useWorkspaceStore.getState().setWindowPosition("preview", {
        x: window.screenX,
        y: window.screenY,
        width: window.outerWidth,
        height: window.outerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("beforeunload", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("beforeunload", handleResize);
    };
  }, []);

  // Stable preview update - only update when we have substantial new content
  const lastContentLengthRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingContentRef = useRef<string>("");
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MIN_UPDATE_INTERVAL = 300; // Minimum ms between updates during streaming
  const MIN_CONTENT_DELTA = 100; // Minimum new characters before updating during streaming

  // Build preview when code changes (debounced during streaming to prevent strobe)
  useEffect(() => {
    if (!previewCode) {
      setPreviewContent("");
      setPreviewError(null);
      lastContentLengthRef.current = 0;
      return;
    }

    try {
      const content = buildPreviewContent(previewCode);
      const contentLength = previewCode.length;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      const contentDelta = contentLength - lastContentLengthRef.current;

      if (previewIsStreaming) {
        // During streaming, only update when:
        // 1. Enough time has passed (300ms) AND
        // 2. We have enough new content (100+ chars) OR it's been a while (1s)
        pendingContentRef.current = content;

        const shouldUpdate = timeSinceLastUpdate >= MIN_UPDATE_INTERVAL &&
          (contentDelta >= MIN_CONTENT_DELTA || timeSinceLastUpdate > 1000);

        if (shouldUpdate) {
          setPreviewContent(content);
          lastUpdateTimeRef.current = now;
          lastContentLengthRef.current = contentLength;
          setPreviewError(null);
        } else if (!updateTimeoutRef.current) {
          // Schedule a delayed update to ensure we don't miss the final content
          updateTimeoutRef.current = setTimeout(() => {
            setPreviewContent(pendingContentRef.current);
            lastUpdateTimeRef.current = Date.now();
            lastContentLengthRef.current = previewCode.length;
            updateTimeoutRef.current = null;
          }, MIN_UPDATE_INTERVAL);
        }
      } else {
        // Not streaming - update immediately and apply any pending content
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
        }
        setPreviewContent(content);
        lastUpdateTimeRef.current = now;
        lastContentLengthRef.current = contentLength;
        setPreviewError(null);
      }
    } catch (err: any) {
      setPreviewError(err.message || "Failed to build preview");
    }
  }, [previewCode, previewIsStreaming]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Refresh preview
  const handleRefresh = () => {
    setIframeKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">Preview</span>
          </div>
          {projectName && (
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
              {projectName}
            </span>
          )}

          {/* Streaming indicator */}
          {previewIsStreaming && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Live</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle code view */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCode(!showCode)}
            className={cn(
              "text-zinc-400 hover:text-blue-400",
              showCode && "bg-zinc-800 text-blue-400"
            )}
          >
            <Code2 className="w-4 h-4" />
          </Button>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="text-zinc-400 hover:text-blue-400"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-zinc-400 hover:text-blue-400"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {!previewCode ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Eye className="w-16 h-16 text-zinc-700 mb-4" />
            <h2 className="text-xl font-medium text-zinc-400 mb-2">Preview Panel</h2>
            <p className="text-sm text-zinc-500 max-w-md">
              Code from the Builder will render here in real-time.
              Watch your page come to life as you build.
            </p>
          </div>
        ) : previewError ? (
          // Error state
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-red-500 mb-4">Preview Error</div>
            <p className="text-sm text-zinc-400">{previewError}</p>
          </div>
        ) : showCode ? (
          // Code view
          <div className="h-full overflow-auto p-4">
            <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">
              {previewCode}
            </pre>
          </div>
        ) : (
          // Preview iframe - stable rendering with no flash during streaming
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={previewContent}
            className="w-full h-full border-0 bg-zinc-950"
            style={{
              // Use opacity transition for smooth updates
              opacity: previewContent ? 1 : 0,
              transition: 'opacity 0.15s ease-in-out',
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            title="Preview"
          />
        )}

        {/* Streaming overlay effect */}
        {previewIsStreaming && previewCode && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-2 right-2 flex items-center gap-2 bg-blue-600/90 text-white text-xs px-2 py-1 rounded-full">
              <Radio className="w-3 h-3 animate-pulse" />
              Building...
            </div>
          </div>
        )}
      </div>

      {/* Footer with code stats */}
      {previewCode && (
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900 text-xs text-zinc-500 flex items-center gap-4">
          <span>{previewCode.length.toLocaleString()} characters</span>
          <span>{previewCode.split("\n").length} lines</span>
          {previewIsStreaming && (
            <span className="text-blue-400 animate-pulse">Streaming...</span>
          )}
        </div>
      )}
    </div>
  );
}
