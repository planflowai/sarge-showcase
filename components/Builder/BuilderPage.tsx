"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import BuilderSidebar from "./BuilderSidebar";
import BuilderChat from "./BuilderChat";
// BuilderProgress removed — redundant with ProgressCards in chat
import SessionActivity from "./SessionActivity";
import ArtifactPanel from "./ArtifactPanel";
import BuilderTerminal from "./BuilderTerminal";
import { useBuilderStore } from "@/lib/stores/builderStore";
import { useBuilderChatStore } from "@/lib/stores/builderChatStore";
import { useArtifactStore } from "@/lib/stores/artifactStore";
import { useBuilderDocumentStore } from "@/lib/stores/builderDocumentStore";
import { flattenFileTree } from "@/lib/contextInjector";
import { applyEditBlocks, type EditBlock, getDiffSummary } from "@/lib/editBlockParser";
import { useWorkspaceStore, launchWorkspace, recallWorkspace } from "@/lib/stores/workspaceStore";
import { Rocket, LayoutGrid, X, FolderPlus, FolderOpen as FolderOpenIcon } from "lucide-react";
import ThreadGuardianIndicator from "@/components/chat/ThreadGuardianIndicator";

/**
 * BuilderPage - Main container for the Builder tab
 *
 * NEW Layout (flipped):
 * - Slim sidebar (200px): model buttons + file explorer
 * - Builder chat (400px): narrow left column
 * - Artifact panel (rest of screen): ALWAYS visible on right, drag-resizable
 * - Terminal (bottom): hidden by default, toggled from sidebar
 */

export default function BuilderPage({ deployContent }: { deployContent?: React.ReactNode } = {}) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("deepseek");

  // Artifact panel state - NOW PERSISTED via artifactStore
  const {
    code: artifactCode,
    path: artifactPath,
    activeTab,
    isStreaming,
    streamingCode,
    setCode: setArtifactCode,
    setStreamingCode,
    setIsStreaming,
    setActiveTab,
    finalizeStreaming,
    clear: clearArtifact,
    hydrated: artifactHydrated,
    hydrate: hydrateArtifact,
  } = useArtifactStore();

  // Hydrate stores + restore localStorage values on mount (avoids SSR mismatch)
  useEffect(() => {
    if (!artifactHydrated) {
      hydrateArtifact();
    }
    // One-time cleanup of old builder chat messages
    const cleanupKey = 'builder-chat-cleanup-v2';
    if (!localStorage.getItem(cleanupKey)) {
      localStorage.removeItem('builder-chat-messages');
      localStorage.setItem(cleanupKey, 'done');
    }
    // Restore persisted selections
    const savedModel = localStorage.getItem('builder-selected-model');
    if (savedModel) setSelectedModel(savedModel);
    const savedProvider = localStorage.getItem('builder-selected-provider');
    if (savedProvider) setSelectedProvider(savedProvider);
    const savedWidth = localStorage.getItem('builder-chat-panel-width');
    if (savedWidth) setChatPanelWidth(parseInt(savedWidth, 10));
  }, [artifactHydrated, hydrateArtifact]);

  // Local state for artifact path setter (wrapper for store)
  const setArtifactPath = useCallback((path: string | null) => {
    setArtifactCode(artifactCode, path);
  }, [artifactCode, setArtifactCode]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Resizable chat panel width (restored from localStorage in useEffect above)
  const [chatPanelWidth, setChatPanelWidth] = useState<number>(480);
  const isResizing = useRef(false);

  // Terminal state
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Workspace state
  const { isWorkspaceActive, activeWindows, hydrate: hydrateWorkspace, hydrated: workspaceHydrated } = useWorkspaceStore();

  // Hydrate workspace store
  useEffect(() => {
    if (!workspaceHydrated) hydrateWorkspace();
  }, [workspaceHydrated, hydrateWorkspace]);

  // Generation timing
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);

  // Builder store for file and project state
  const { updateCurrentContent, projectPath, projectName, fileTree, setFileTree, clearProject, isDirty, markClean, autoApply } = useBuilderStore();

  // Document store for project management (multi-file projects)
  const { currentProject: docProject, hydrated: docHydrated, hydrate: hydrateDocuments } = useBuilderDocumentStore();

  // Hydrate document store
  useEffect(() => {
    if (!docHydrated) hydrateDocuments();
  }, [docHydrated, hydrateDocuments]);

  // Use document store project name if available, otherwise fall back to builder store
  const activeProjectName = docProject?.name || projectName;

  // Flatten file tree for context injection
  const projectFileTree = projectPath ? flattenFileTree(fileTree) : [];

  // Builder log content for AI context
  const [builderLogContent, setBuilderLogContent] = useState<string | null>(null);

  // Fetch or auto-generate BUILDER_LOG.md when project opens
  useEffect(() => {
    if (!projectPath) {
      setBuilderLogContent(null);
      return;
    }

    const fetchOrScanLog = async () => {
      try {
        // First, try to read existing log
        const res = await fetch(`/api/builder/update-log?projectPath=${encodeURIComponent(projectPath)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.exists && data.content) {
            setBuilderLogContent(data.content);
            console.log('[BuilderPage] Loaded existing BUILDER_LOG.md for context');
            return;
          }
        }

        // No existing log — auto-generate via full tree scan
        console.log('[BuilderPage] No BUILDER_LOG.md found, running scan...');
        const scanRes = await fetch('/api/builder/update-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            projectName: projectName || 'Project',
            action: 'scan',
          }),
        });
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          // Re-read the newly created log
          const reRead = await fetch(`/api/builder/update-log?projectPath=${encodeURIComponent(projectPath)}`);
          if (reRead.ok) {
            const reData = await reRead.json();
            if (reData.exists && reData.content) {
              setBuilderLogContent(reData.content);
              console.log('[BuilderPage] Auto-generated BUILDER_LOG.md from scan');
            }
          }
        }
      } catch (err) {
        console.log('[BuilderPage] Failed to fetch/generate BUILDER_LOG.md:', err);
        setBuilderLogContent(null);
      }
    };

    fetchOrScanLog();
  }, [projectPath, projectName]);

  // Auto-load index.html into preview when project opens
  useEffect(() => {
    if (!projectPath || fileTree.length === 0) return;

    // Find index.html (or similar entry point) in the file tree
    const findEntryFile = (nodes: typeof fileTree): string | null => {
      for (const node of nodes) {
        if (node.type === 'file') {
          const name = node.name.toLowerCase();
          if (name === 'index.html' || name === 'index.htm') return node.path;
        }
        if (node.type === 'directory' && node.children) {
          const found = findEntryFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const entryFile = findEntryFile(fileTree);
    if (!entryFile) return;

    // Only auto-load if artifact panel is empty (don't overwrite active work)
    if (artifactCode && artifactCode.trim().length > 0) return;

    const loadEntry = async () => {
      try {
        const res = await fetch('/api/builder/read-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: entryFile, projectPath }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.content) {
            setArtifactCode(data.content, entryFile);
            setActiveTab("preview");
            console.log('[BuilderPage] Auto-loaded entry file:', entryFile);
          }
        }
      } catch (err) {
        console.log('[BuilderPage] Failed to auto-load entry file:', err);
      }
    };

    loadEntry();
  }, [projectPath, fileTree, artifactCode, setArtifactCode, setActiveTab]);

  // Diff view state
  const [diffView, setDiffView] = useState<{
    filePath: string;
    originalContent: string;
    proposedContent: string;
  } | null>(null);

  // Pending prompt from sidebar
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // Track last prompt for saving to library
  const [lastPrompt, setLastPrompt] = useState<string>("");

  // Get sending state from chat store for progress indicator
  const sending = useBuilderChatStore((state) => state.sending);

  // Refs for debugging layout
  const sidebarRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const artifactRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debug layout on mount
  useEffect(() => {
    const logLayout = () => {
      console.log('[BuilderPage] Layout debug:');
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        console.log('  Container:', { width: rect.width, height: rect.height });
      }
      if (sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        console.log('  Sidebar:', { width: rect.width, height: rect.height });
      }
      if (chatRef.current) {
        const rect = chatRef.current.getBoundingClientRect();
        console.log('  Chat:', { width: rect.width, height: rect.height });
      }
      if (artifactRef.current) {
        const rect = artifactRef.current.getBoundingClientRect();
        const styles = window.getComputedStyle(artifactRef.current);
        console.log('  Artifact Panel:', {
          width: rect.width,
          height: rect.height,
          display: styles.display,
          visibility: styles.visibility,
          flex: styles.flex,
          minWidth: styles.minWidth
        });
      }
    };

    // Log immediately and after a short delay
    logLayout();
    const timer = setTimeout(logLayout, 500);
    return () => clearTimeout(timer);
  }, []);

  // Save chat panel width to localStorage
  useEffect(() => {
    localStorage.setItem('builder-chat-panel-width', String(chatPanelWidth));
  }, [chatPanelWidth]);

  // Handle escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Warn before page unload when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleModelSelect = (modelId: string, provider: string) => {
    console.log('[BuilderPage] Model selection changed:', { modelId, provider });
    setSelectedModel(modelId);
    setSelectedProvider(provider);
    // Persist selection so it survives navigation
    localStorage.setItem('builder-selected-model', modelId);
    localStorage.setItem('builder-selected-provider', provider);
  };

  // Handle opening code in the artifact panel (from chat code blocks)
  const handleOpenInEditor = useCallback((code: string, language?: string) => {
    setArtifactCode(code, null);
    setActiveTab("code");
  }, [setArtifactCode, setActiveTab]);

  // Handle opening preview directly (from artifact card Preview button)
  const handleOpenPreview = useCallback((code: string) => {
    setArtifactCode(code, null);
    setActiveTab("preview");
  }, [setArtifactCode, setActiveTab]);

  // Handle opening a file from the file explorer
  const handleFileOpen = useCallback((content: string, path: string, language: string) => {
    setArtifactCode(content, path);
    setActiveTab("code");
  }, [setArtifactCode, setActiveTab]);

  // Handle new file
  const handleNewFile = useCallback(() => {
    setArtifactCode("", null);
    setActiveTab("code");
  }, [setArtifactCode, setActiveTab]);

  // Handle code changes in artifact panel
  const handleCodeChange = useCallback((code: string) => {
    setArtifactCode(code, artifactPath);
    updateCurrentContent(code);
  }, [updateCurrentContent, setArtifactCode, artifactPath]);

  // Handle streaming updates from chat (for live preview)
  const handleStreamingUpdate = useCallback((code: string, streaming: boolean) => {
    setStreamingCode(code);
    setIsStreaming(streaming);
    if (streaming) {
      // Auto-switch to preview during streaming for live feedback
      setActiveTab("preview");
      // Track generation start time
      if (!generationStartTime) {
        setGenerationStartTime(Date.now());
      }
    } else {
      // Streaming ended - PERSIST the new code as the artifact via store
      // This prevents reverting to the old code AND survives navigation
      if (code) {
        finalizeStreaming();
        updateCurrentContent(code);
      }
      // Reset start time when streaming ends
      setGenerationStartTime(null);
    }
  }, [generationStartTime, updateCurrentContent, setStreamingCode, setIsStreaming, setActiveTab, finalizeStreaming]);

  // Toggle terminal
  const handleTerminalToggle = useCallback(() => {
    setTerminalOpen(prev => !prev);
  }, []);

  // Handle view diff request from FileActionCard
  const handleViewDiff = useCallback((filePath: string, originalContent: string, proposedContent: string) => {
    setDiffView({ filePath, originalContent, proposedContent });
    setActiveTab("diff");  // Switch to diff tab to show the comparison
  }, []);

  // Handle closing diff view
  const handleCloseDiff = useCallback(() => {
    setDiffView(null);
    setActiveTab("preview");  // Return to preview tab
  }, []);

  // Handle surgical edit blocks from Edit Mode
  const handleApplyEditBlocks = useCallback((originalCode: string, editBlocks: EditBlock[]) => {
    const modifiedCode = applyEditBlocks(originalCode, editBlocks);
    const diff = getDiffSummary(originalCode, modifiedCode);
    console.log('[BuilderPage] Applied surgical edits:', {
      blocks: editBlocks.length,
      linesAdded: diff.added,
      linesRemoved: diff.removed,
    });
    // The code update is handled by onStreamingUpdate, but we can add additional tracking here
  }, []);

  // Handle scroll to message from Changes sidebar
  const handleScrollToMessage = useCallback((messageId: string) => {
    // Find the message element in the chat and scroll to it
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a brief highlight effect
      messageElement.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
      }, 2000);
    }
  }, []);

  // Refresh file tree after file operations
  const handleRefreshFileTree = useCallback(async () => {
    if (!projectPath) return;
    try {
      const res = await fetch('/api/builder/list-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setFileTree(data.tree);
        }
      }
    } catch (err) {
      console.error('[BuilderPage] Failed to refresh file tree:', err);
    }
  }, [projectPath, setFileTree]);

  // Handle prompt selection from sidebar
  const handlePromptSelect = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
  }, []);

  // Clear pending prompt after it's consumed
  const handlePendingPromptConsumed = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  // Handle prompt sent (for tracking last prompt)
  const handlePromptSent = useCallback((prompt: string) => {
    setLastPrompt(prompt);
  }, []);

  // Handle new build - clears chat, artifact, and project to start fresh
  const clearMessages = useBuilderChatStore((state) => state.clearMessages);
  const handleNewBuild = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Start a new build anyway? Your current file changes will be lost.'
      );
      if (!confirmed) return;
    }
    markClean();
    clearMessages();
    clearArtifact(); // Clears persisted artifact state
    clearProject(); // Clears project so preview uses srcdoc instead of API URL
    setLastPrompt("");
    setDiffView(null);
    console.log('[BuilderPage] Started new build - cleared chat, artifact, and project');
  }, [isDirty, markClean, clearMessages, clearArtifact, clearProject]);

  // Handle inserting a component from the library
  const handleInsertComponent = useCallback((code: string, componentId: string) => {
    // Append the component code to the current artifact
    const separator = artifactCode ? "\n\n<!-- Inserted Component -->\n" : "";
    const newCode = artifactCode + separator + code;
    setArtifactCode(newCode, artifactPath);
    updateCurrentContent(newCode);
    setActiveTab("preview");
    console.log('[BuilderPage] Inserted component:', componentId);
  }, [artifactCode, artifactPath, updateCurrentContent, setArtifactCode, setActiveTab]);

  // Handle using a component as the base for iteration
  const handleUseComponentAsBase = useCallback((code: string, componentId: string) => {
    // Replace the current artifact with the component code
    setArtifactCode(code, null);
    updateCurrentContent(code);
    setActiveTab("preview");
    console.log('[BuilderPage] Using component as base:', componentId);
  }, [updateCurrentContent, setArtifactCode, setActiveTab]);

  // Handle inserting a component with AI modifications
  const handleInsertComponentWithAI = useCallback((code: string, componentId: string, modifications: string) => {
    // Set the component code as the base so AI has context
    setArtifactCode(code, null);
    updateCurrentContent(code);

    // Create a prompt for the AI to modify the component
    const aiPrompt = `I have a component from my library. Please modify it with the following changes: "${modifications}"

Here is the original component code:
\`\`\`html
${code}
\`\`\`

Please provide the complete modified version of this component. Make only the requested changes while keeping the rest intact.`;

    // Set the prompt as pending so it will be sent via the chat
    setPendingPrompt(aiPrompt);
    setActiveTab("preview");
    console.log('[BuilderPage] Inserting component with AI modifications:', componentId, modifications);
  }, [updateCurrentContent, setArtifactCode, setActiveTab]);

  // Handle resize drag — controls chat panel width
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    // Add overlay to prevent iframe from capturing mouse events during drag
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:col-resize;';
    document.body.appendChild(overlay);

    // Get the chat panel's left edge dynamically (accounts for sidebar width)
    const chatLeft = chatRef.current?.getBoundingClientRect().left || 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newChatWidth = e.clientX - chatLeft;
      // Clamp: min 250px chat, leave at least 300px for artifact panel
      const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
      const sidebarWidth = chatLeft - (containerRef.current?.getBoundingClientRect().left || 0);
      const maxChatWidth = containerWidth - sidebarWidth - 300 - 8; // 300px artifact min + handle
      const clampedWidth = Math.max(250, Math.min(maxChatWidth, newChatWidth));
      setChatPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      overlay.remove();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Double-click resize handle to reset to 50/50 split
  const handleResizeDoubleClick = useCallback(() => {
    const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
    const sidebarWidth = chatRef.current ? (chatRef.current.getBoundingClientRect().left - (containerRef.current?.getBoundingClientRect().left || 0)) : 320;
    const available = containerWidth - sidebarWidth - 8; // 8px for handle
    setChatPanelWidth(Math.round(available / 2));
  }, []);

  // Determine which code to show in preview (streaming or final)
  const previewCode = isStreaming ? streamingCode : artifactCode;

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950">
        <ArtifactPanel
          code={previewCode}
          onCodeChange={handleCodeChange}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isFullscreen={true}
          onToggleFullscreen={() => setIsFullscreen(false)}
          isStreaming={isStreaming}
          diffView={diffView}
          onCloseDiff={handleCloseDiff}
          lastPrompt={lastPrompt}
          projectName={activeProjectName}
          deployContent={deployContent}
          generationStartTime={generationStartTime}
        />
      </div>
    );
  }

  // If workspace is active, show control panel instead
  if (isWorkspaceActive && activeWindows.length > 0) {
    return (
      <div className="flex flex-col h-full w-full bg-zinc-950 items-center justify-center">
        <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800 max-w-md w-full mx-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <LayoutGrid className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Workspace Active</h2>
              <p className="text-sm text-zinc-400">Multi-window mode is running</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-lg">
              <span className="text-sm text-zinc-300">Studio (Architect + Builder)</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeWindows.includes('builder') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                {activeWindows.includes('builder') ? 'Open' : 'Closed'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-lg">
              <span className="text-sm text-zinc-300">Preview</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeWindows.includes('preview') ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-700 text-zinc-500'}`}>
                {activeWindows.includes('preview') ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>

          <button
            onClick={recallWorkspace}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm font-medium"
          >
            <X className="w-4 h-4" />
            Close Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full w-full bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar - Thread Guardian + Launch Workspace - fixed position to always show */}
      <div className="fixed top-4 right-4 z-[100] flex items-center gap-3">
        {/* Thread Guardian Indicator */}
        <ThreadGuardianIndicator conversationId="builder-chat" />

        {/* Launch Workspace Button */}
        <button
          onClick={launchWorkspace}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg shadow-lg transition-all text-sm font-medium"
          title="Launch multi-window workspace across your monitors"
        >
          <Rocket className="w-4 h-4" />
          Launch Workspace
        </button>

        {/* New Project */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("builder:new-project"))}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg transition-all text-sm font-medium"
          title="New Project"
        >
          <FolderPlus className="w-4 h-4" />
          New
        </button>

        {/* Open Project */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("builder:open-project"))}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-lg transition-all text-sm font-medium"
          title="Open Project"
        >
          <FolderOpenIcon className="w-4 h-4" />
          Open
        </button>
      </div>

      {/* Main content area */}
      <div ref={containerRef} className="flex flex-row flex-1 min-h-0 w-full overflow-hidden">
        {/* Sidebar - 320px fixed width (fits 2x2 template grid, scrollable) */}
        <div
          ref={sidebarRef}
          className="w-[320px] h-full flex-shrink-0 flex-grow-0 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto"
        >
          <BuilderSidebar
            selectedModel={selectedModel}
            selectedProvider={selectedProvider}
            onModelSelect={handleModelSelect}
            onFileOpen={handleFileOpen}
            onNewFile={handleNewFile}
            terminalOpen={terminalOpen}
            onTerminalToggle={handleTerminalToggle}
            onScrollToMessage={handleScrollToMessage}
            onPromptSelect={handlePromptSelect}
            onInsertComponent={handleInsertComponent}
            onUseComponentAsBase={handleUseComponentAsBase}
            onInsertComponentWithAI={handleInsertComponentWithAI}
            onNewBuild={handleNewBuild}
          />
        </div>

        {/* Chat area - wider (480px) to fit controls better */}
        <div
          ref={chatRef}
          className="h-full flex-shrink-0 flex-grow-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 overflow-hidden"
          style={{ width: `${chatPanelWidth}px`, minWidth: '250px' }}
        >
          <BuilderChat
            selectedModel={selectedModel}
            selectedProvider={selectedProvider}
            onOpenInEditor={handleOpenInEditor}
            onOpenPreview={handleOpenPreview}
            artifactCode={artifactCode}
            onStreamingUpdate={handleStreamingUpdate}
            projectPath={projectPath}
            projectName={projectName}
            projectFileTree={projectFileTree}
            builderLogContent={builderLogContent}
            onViewDiff={handleViewDiff}
            pendingPrompt={pendingPrompt}
            onPendingPromptConsumed={handlePendingPromptConsumed}
            onPromptSent={handlePromptSent}
            onRefreshFileTree={handleRefreshFileTree}
            autoApply={autoApply}
          />
        </div>

        {/* Resize handle — wider grab target with visible indicator */}
        <div
          className="w-2 h-full cursor-col-resize flex-shrink-0 flex-grow-0 group relative flex items-center justify-center hover:bg-indigo-500/10 active:bg-indigo-500/20 transition-colors"
          onMouseDown={handleResizeStart}
          onDoubleClick={handleResizeDoubleClick}
        >
          <div className="w-0.5 h-8 rounded-full bg-zinc-400 dark:bg-zinc-600 group-hover:bg-indigo-500 group-active:bg-indigo-400 transition-colors" />
        </div>

        {/* Artifact Panel - takes rest of screen, ALWAYS visible */}
        <div
          ref={artifactRef}
          className="flex-1 flex-shrink-0 h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden"
          style={{ minWidth: '300px' }}
        >
          {/* Session Activity - shows when NOT generating and there's activity */}
          {!sending && !isStreaming && (
            <SessionActivity
              onScrollToMessage={handleScrollToMessage}
              className="border-b border-zinc-200 dark:border-zinc-800"
            />
          )}

          <ArtifactPanel
            code={previewCode}
            onCodeChange={handleCodeChange}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isFullscreen={false}
            onToggleFullscreen={() => setIsFullscreen(true)}
            isStreaming={isStreaming}
            diffView={diffView}
            onCloseDiff={handleCloseDiff}
            lastPrompt={lastPrompt}
            projectName={activeProjectName}
            deployContent={deployContent}
            generationStartTime={generationStartTime}
          />
        </div>
      </div>

      {/* Terminal - at bottom, hidden by default */}
      <BuilderTerminal
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
      />
    </div>
  );
}
