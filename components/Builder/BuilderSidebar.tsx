"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FolderOpen, Settings, Plus, FolderPlus, RefreshCw, X, Terminal, Sparkles, Zap, Star, Rocket, Code2, Save, Loader2, History, FileEdit, FilePlus, FileX, Check, XCircle, ChevronDown, ChevronRight, BookOpen, Trash2, LayoutTemplate, Grid3X3, Clock, Layers } from "lucide-react";
import { useModelStore } from "@/lib/stores/modelStore";
import { useBuilderStore, getLanguageFromPath } from "@/lib/stores/builderStore";
import { useBuilderChatStore } from "@/lib/stores/builderChatStore";
import { useChangesStore, type ChangeEntry } from "@/lib/stores/changesStore";
import { usePromptLibraryStore, PROMPT_CATEGORIES, PREBUILT_PROMPTS, type Prompt, getComplexityColor, getOutputTypeLabel } from "@/lib/stores/promptLibraryStore";
import { useAIModeStore } from "@/lib/stores/aiModeStore";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "@/lib/projectTemplates";
import TemplateCard from "./TemplateCard";
import PromptGallery from "./PromptGallery";
import ComponentLibrarySection from "./ComponentLibrarySection";
import AIHelpersSection from "./AIHelpersSection";
import RouterStatus from "./RouterStatus";
import AICapabilitiesPanel from "./AICapabilitiesPanel";
import DependencyGraph from "./DependencyGraph";
import { fetchOllamaModels, fetchLMStudioModels, type LocalModel } from "@/lib/providers/localModels";
import { providers, getCloudProviders, getLocalProviders } from "@/lib/providers";
import { groupOllamaModels } from "@/lib/ollamaModelGroups";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import FileTree from "./FileTree";
import { SkeletonFileTree } from "@/components/ui/skeleton";
import type { Provider } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

// Provider icons (same as ProviderBadge)
const providerIcons: Record<Provider, LucideIcon> = {
  anthropic: Sparkles,
  openai: Zap,
  google: Star,
  xai: Rocket,
  deepseek: Code2,
  ollama: Terminal,
  lmstudio: Terminal,
};

interface BuilderSidebarProps {
  selectedModel: string | null;
  selectedProvider: string;
  onModelSelect: (modelId: string, provider: string) => void;
  onFileOpen?: (content: string, path: string, language: string) => void;
  onNewFile?: () => void;
  terminalOpen?: boolean;
  onTerminalToggle?: () => void;
  onScrollToMessage?: (messageId: string) => void;
  onPromptSelect?: (prompt: string) => void;
  onInsertComponent?: (code: string, componentId: string) => void;
  onUseComponentAsBase?: (code: string, componentId: string) => void;
  onInsertComponentWithAI?: (code: string, componentId: string, modifications: string) => void;
  onNewBuild?: () => void;
}

export default function BuilderSidebar({ selectedModel, selectedProvider, onModelSelect, onFileOpen, onNewFile, terminalOpen, onTerminalToggle, onScrollToMessage, onPromptSelect, onInsertComponent, onUseComponentAsBase, onInsertComponentWithAI, onNewBuild }: BuilderSidebarProps) {
  const { hydrated, hydrate, getBuilderModels, isBuilderModel, getDisplayName, getEffectiveModels } = useModelStore();
  const changes = useChangesStore(state => state.changes);
  const clearChanges = useChangesStore(state => state.clearChanges);
  const {
    projectPath,
    projectName,
    fileTree,
    setProject,
    clearProject,
    setCurrentFile,
    hydrated: builderHydrated,
    hydrate: hydrateBuilder,
  } = useBuilderStore();

  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPathInput, setShowPathInput] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectPath, setNewProjectPath] = useState("");
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const [componentsExpanded, setComponentsExpanded] = useState(false);
  const [depGraphExpanded, setDepGraphExpanded] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [hoveredPrompt, setHoveredPrompt] = useState<Prompt | null>(null);
  const [tooltipY, setTooltipY] = useState(0);
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const promptTooltipRef = useRef<HTMLDivElement>(null);

  // Prompt library store
  const {
    customPrompts,
    expandedCategories,
    hydrated: promptsHydrated,
    hydrate: hydratePrompts,
    toggleCategory,
    removeCustomPrompt,
    getPromptsByCategory,
  } = usePromptLibraryStore();

  // AI Mode store
  const aiModeDisplayName = useAIModeStore((s) => s.getDisplayName);
  const executionMode = useAIModeStore((s) => s.executionMode);

  // Hydrate stores on mount
  useEffect(() => {
    if (!hydrated) hydrate();
    if (!builderHydrated) hydrateBuilder();
    if (!promptsHydrated) hydratePrompts();
  }, [hydrated, hydrate, builderHydrated, hydrateBuilder, promptsHydrated, hydratePrompts]);

  // Close template dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLocalProvider = selectedProvider === "ollama" || selectedProvider === "lmstudio";

  // Auto-select model for cloud providers (like DeepSeek) on initial load
  useEffect(() => {
    if (!hydrated || isLocalProvider || selectedModel) return;

    const allModels = getEffectiveModels(selectedProvider);
    const builderModels = allModels.filter(m => isBuilderModel(m.id, selectedProvider));
    if (builderModels.length > 0) {
      onModelSelect(builderModels[0].id, selectedProvider);
    }
  }, [hydrated, selectedProvider, selectedModel, isLocalProvider, getEffectiveModels, isBuilderModel, onModelSelect]);

  // Fetch local models when ollama or lmstudio is selected
  useEffect(() => {
    if (!isLocalProvider) return;

    setOllamaLoading(true);
    setOllamaError(null);

    const fetchFn = selectedProvider === "lmstudio" ? fetchLMStudioModels : fetchOllamaModels;
    fetchFn()
      .then((models) => {
        setOllamaModels(models);
        if (!selectedModel && models.length > 0) {
          onModelSelect(models[0].id, selectedProvider);
        }
      })
      .catch(() => {
        setOllamaModels([]);
        setOllamaError(selectedProvider === "lmstudio" ? "LM Studio not running" : "Ollama not running");
      })
      .finally(() => {
        setOllamaLoading(false);
      });
  }, [selectedProvider, isLocalProvider, selectedModel, onModelSelect]);

  // Get providers that have builder models
  // Always show ALL cloud providers - they all have models auto-tagged as builders
  const providersWithBuilderModels = useMemo(() => {
    if (!hydrated) return [];

    // All cloud providers should always be available (per CLAUDE.md Phase 5A)
    // Their models are auto-tagged as builders
    const allowedProviderIds = new Set(['anthropic', 'openai', 'google', 'xai', 'deepseek', 'ollama', 'lmstudio']);

    return providers.filter(p => allowedProviderIds.has(p.id));
  }, [hydrated]);

  // Get cloud and local providers separately
  const cloudProviders = providersWithBuilderModels.filter(p => p.type === "cloud");
  const localProviders = providersWithBuilderModels.filter(p => p.type === "local");

  // Get models for current provider
  const currentProviderModels = useMemo(() => {
    if (!hydrated) return [];

    if (isLocalProvider) {
      // Show all local models — no builder flag filter
      return ollamaModels;
    }

    // For cloud providers, get effective models and filter to builder only
    const allModels = getEffectiveModels(selectedProvider);
    return allModels.filter(m => isBuilderModel(m.id, selectedProvider));
  }, [hydrated, selectedProvider, isLocalProvider, ollamaModels, isBuilderModel, getEffectiveModels]);

  // Get current provider config
  const activeProvider = providers.find(p => p.id === selectedProvider);

  // Open project folder
  const handleOpenProject = useCallback(async (folderPath: string) => {
    if (!folderPath.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/builder/list-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setProject(data.projectPath, data.projectName, data.tree);
        setShowPathInput(false);
        setPathInput("");
      } else {
        console.error('Failed to open project:', data.error);
        alert(`Failed to open project: ${data.error}`);
      }
    } catch (error) {
      console.error('Error opening project:', error);
      alert('Failed to open project');
    } finally {
      setIsLoading(false);
    }
  }, [setProject]);

  // Refresh file tree
  const handleRefresh = useCallback(async () => {
    if (!projectPath) return;
    await handleOpenProject(projectPath);
  }, [projectPath, handleOpenProject]);

  // Handle file selection
  const handleFileSelect = useCallback(async (filePath: string) => {
    try {
      const response = await fetch('/api/builder/read-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, projectPath }),
      });

      const data = await response.json();
      if (data.success) {
        const language = getLanguageFromPath(filePath);
        setCurrentFile(filePath, data.content, language);
        if (onFileOpen) {
          onFileOpen(data.content, filePath, language);
        }
      } else {
        console.error('Failed to read file:', data.error);
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }
  }, [setCurrentFile, onFileOpen]);

  // Handle new file
  const handleNewFile = useCallback(() => {
    setCurrentFile('untitled', '', 'plaintext');
    if (onNewFile) {
      onNewFile();
    }
  }, [setCurrentFile, onNewFile]);

  // Handle provider selection
  const handleProviderSelect = useCallback((providerId: string) => {
    if (providerId === "ollama" || providerId === "lmstudio") {
      // For local providers, select first available model (no builder flag filter)
      if (ollamaModels.length > 0) {
        onModelSelect(ollamaModels[0].id, providerId);
      } else {
        onModelSelect("", providerId);
      }
    } else {
      const allModels = getEffectiveModels(providerId);
      const builderModels = allModels.filter(m => isBuilderModel(m.id));
      if (builderModels.length > 0) {
        onModelSelect(builderModels[0].id, providerId);
      }
    }
  }, [ollamaModels, isBuilderModel, getEffectiveModels, onModelSelect]);

  // Handle creating project from template
  const handleCreateFromTemplate = useCallback(async (template: ProjectTemplate, projectPath: string) => {
    if (!projectPath.trim()) return;

    setIsCreatingProject(true);
    try {
      const response = await fetch('/api/builder/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          projectPath: projectPath.trim(),
          projectName: projectPath.split(/[/\\]/).pop() || 'New Project',
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Open the newly created project
        await handleOpenProject(data.projectPath);
        setShowNewProjectInput(false);
        setSelectedTemplate(null);
        setNewProjectPath("");
        setShowTemplateDropdown(false);
      } else {
        console.error('Failed to create project:', data.error);
        alert(`Failed to create project: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
    } finally {
      setIsCreatingProject(false);
    }
  }, [handleOpenProject]);

  // Handle prompt click
  const handlePromptClick = useCallback((prompt: Prompt) => {
    if (onPromptSelect) {
      onPromptSelect(prompt.prompt);
    }
  }, [onPromptSelect]);

  // Handle save progress - generates/updates BUILDER_LOG.md
  const handleSaveProgress = useCallback(async () => {
    if (!projectPath || !projectName) return;

    setIsSavingProgress(true);
    setSaveSuccess(false);

    try {
      // Generate a session summary with current state
      const response = await fetch('/api/builder/update-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          projectName,
          action: 'summary',
          sessionSummary: {
            recentChanges: [], // Changes are already tracked via auto-append
            currentState: `Working on ${projectName}. File explorer is active.`,
            nextSteps: [
              'Review recent changes',
              'Continue development',
              'Test functionality'
            ]
          }
        }),
      });

      if (response.ok) {
        setSaveSuccess(true);
        console.log('[BuilderSidebar] Progress saved to BUILDER_LOG.md');
        // Reset success indicator after 2 seconds
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        const error = await response.json();
        console.error('[BuilderSidebar] Failed to save progress:', error);
        alert('Failed to save progress: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('[BuilderSidebar] Error saving progress:', error);
      alert('Failed to save progress');
    } finally {
      setIsSavingProgress(false);
    }
  }, [projectPath, projectName]);

  return (
    <div className="flex flex-col h-full bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800 overflow-hidden">
      {/* Header - fixed at top */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-zinc-300 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Builder
          </h2>
          {/* AI Mode Quick Toggle */}
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all",
              "hover:ring-1 hover:ring-zinc-500",
              executionMode === "local" && "bg-emerald-500/20 text-emerald-500 dark:text-emerald-400",
              executionMode === "cloud" && "bg-violet-500/20 text-violet-500 dark:text-violet-400",
              executionMode === "hybrid" && "bg-amber-500/20 text-amber-500 dark:text-amber-400"
            )}
            title="AI Orchestration Mode"
          >
            <Zap className="h-2.5 w-2.5" />
            {aiModeDisplayName()}
          </Link>
        </div>
      </div>

      {/* Content area - NO scrolling */}
      <div className="flex-1 min-h-0">
        {/* Provider & Model - Combined compact section */}
        <div className="px-2 py-1.5 border-b border-zinc-300 dark:border-zinc-800 space-y-1">
          {/* Provider row - Cloud and Local side by side */}
          <div className="flex gap-1">
            <select
              value={cloudProviders.some(p => p.id === selectedProvider) ? selectedProvider : ""}
              onChange={(e) => handleProviderSelect(e.target.value)}
              className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
              title="Cloud Provider"
            >
              <option value="" disabled>Cloud...</option>
              {cloudProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <select
              value={localProviders.some(p => p.id === selectedProvider) ? selectedProvider : ""}
              onChange={(e) => handleProviderSelect(e.target.value)}
              className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
              title="Local Provider"
            >
              <option value="" disabled>Local...</option>
              {localProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Dropdown - fixed height to prevent sidebar jiggling */}
          <div className="h-[28px] flex items-center">
            {isLocalProvider ? (
              ollamaLoading ? (
                <div className="text-[10px] text-zinc-500">Loading...</div>
              ) : ollamaError ? (
                <div className="text-[10px] text-red-400 line-clamp-1">{ollamaError}</div>
              ) : currentProviderModels.length === 0 ? (
                <div className="text-[10px] text-zinc-500">
                  No models. <Link href="/settings" className="text-indigo-500 hover:underline">Settings</Link>
                </div>
              ) : (
                <select
                  value={selectedModel || ""}
                  onChange={(e) => onModelSelect(e.target.value, selectedProvider)}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
                  title={selectedModel || "Select a model"}
                >
                  <option value="" disabled>Model...</option>
                  {groupOllamaModels(currentProviderModels.map(m => m.id)).map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.models.map((model) => (
                        <option key={model.id} value={model.id} title={model.id}>
                          {getDisplayName(model.id, model.name)}{model.hint ? ` · ${model.hint}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )
            ) : currentProviderModels.length === 0 ? (
              <div className="text-[10px] text-zinc-500">
                No models. <Link href="/settings" className="text-indigo-500 hover:underline">Settings</Link>
              </div>
            ) : (
              <select
                value={selectedModel || ""}
                onChange={(e) => onModelSelect(e.target.value, selectedProvider)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
                title={selectedModel || "Select a model"}
              >
                <option value="" disabled>Model...</option>
                {currentProviderModels.map((model) => (
                  <option key={model.id} value={model.id} title={model.id}>
                    {getDisplayName(model.id, model.name)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

      {/* File Explorer */}
      <div className="flex flex-col min-h-0 border-b border-zinc-300 dark:border-zinc-800">
        {/* Files header */}
        <div className="flex items-center justify-between px-2 py-1">
          <label className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Files
          </label>
          <div className="flex items-center gap-0.5">
            {projectPath ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPathInput(true)}
                  className="h-6 w-6 p-0 text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400"
                  title="Open different project"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewFile}
                  className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  title="New file"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  title="Refresh"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearProject}
                  className="h-6 w-6 p-0 text-zinc-500 hover:text-red-500"
                  title="Close project"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPathInput(true)}
                className="h-6 w-6 p-0 text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400"
                title="Open project"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Project content */}
        <div className="flex-1 px-1">
          {/* Inline path input — shown when FolderOpen clicked while project is open */}
          {projectPath && showPathInput && (
            <div className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-800">
              <input
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenProject(pathInput);
                  if (e.key === 'Escape') setShowPathInput(false);
                }}
                placeholder="Enter folder path..."
                className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                autoFocus
              />
              <div className="flex gap-1 mt-1">
                <Button
                  size="sm"
                  onClick={() => handleOpenProject(pathInput)}
                  disabled={!pathInput.trim() || isLoading}
                  className="flex-1 h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isLoading ? "Loading..." : "Open"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPathInput(false)}
                  className="h-6 text-[10px]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {projectPath ? (
            <>
              {/* Project name header */}
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 mb-1">
                <FolderOpen className="h-4 w-4 text-amber-500" />
                <span className="truncate">{projectName}</span>
              </div>

              {/* File tree */}
              {isLoading ? (
                <SkeletonFileTree />
              ) : (
                <FileTree nodes={fileTree} onFileSelect={handleFileSelect} />
              )}
            </>
          ) : (
            <div className="px-2 py-2">
              {showNewProjectInput && selectedTemplate ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{selectedTemplate.icon}</span>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{selectedTemplate.name}</span>
                  </div>
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newProjectPath.trim()) {
                        handleCreateFromTemplate(selectedTemplate, newProjectPath);
                      }
                      if (e.key === 'Escape') {
                        setShowNewProjectInput(false);
                        setSelectedTemplate(null);
                      }
                    }}
                    placeholder="Enter project path (e.g., /projects/my-app)"
                    className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleCreateFromTemplate(selectedTemplate, newProjectPath)}
                      disabled={!newProjectPath.trim() || isCreatingProject}
                      className="flex-1 h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {isCreatingProject ? "Creating..." : "Create"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewProjectInput(false);
                        setSelectedTemplate(null);
                      }}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : showPathInput ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleOpenProject(pathInput);
                      if (e.key === 'Escape') setShowPathInput(false);
                    }}
                    placeholder="Enter folder path..."
                    className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleOpenProject(pathInput)}
                      disabled={!pathInput.trim() || isLoading}
                      className="flex-1 h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {isLoading ? "Loading..." : "Open"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPathInput(false)}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* New Project with template dropdown */}
                  <div className="relative" ref={templateDropdownRef}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                      className="w-full h-6 text-[10px] gap-1 justify-between"
                    >
                      <span className="flex items-center gap-1">
                        <LayoutTemplate className="h-3 w-3" />
                        New Project
                      </span>
                      <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", showTemplateDropdown && "rotate-180")} />
                    </Button>

                    {showTemplateDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-[320px] bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden">
                        {/* Template grid */}
                        <div className="p-2 grid grid-cols-2 gap-1.5">
                          {PROJECT_TEMPLATES.map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              onClick={() => {
                                setSelectedTemplate(template);
                                setShowNewProjectInput(true);
                                setShowTemplateDropdown(false);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPathInput(true)}
                    className="w-full h-6 text-[10px] gap-1"
                  >
                    <FolderPlus className="h-3 w-3" />
                    Open Existing
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNewFile}
                    className="w-full h-6 text-[10px] gap-1 text-zinc-500"
                  >
                    <Plus className="h-3 w-3" />
                    New File
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Prompts Section */}
      <div className="flex flex-col min-h-0 border-b border-zinc-300 dark:border-zinc-800">
        {/* Prompts header */}
        <div className="flex items-center justify-between px-2 py-1">
          <button
            onClick={() => setPromptsExpanded(!promptsExpanded)}
            className="flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1 py-0.5 transition-colors"
          >
            <BookOpen className="h-2.5 w-2.5 text-zinc-500" />
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500 cursor-pointer">
              Prompts
            </label>
            {promptsExpanded ? (
              <ChevronDown className="h-2.5 w-2.5 text-zinc-400" />
            ) : (
              <ChevronRight className="h-2.5 w-2.5 text-zinc-400" />
            )}
          </button>

          {/* Browse All button */}
          <button
            onClick={() => setShowGallery(true)}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
          >
            <Grid3X3 className="h-2.5 w-2.5" />
            Browse All
          </button>
        </div>

        {promptsExpanded && (
          <div className="px-1 pb-2">
            {PROMPT_CATEGORIES.map((category) => {
              const prompts = getPromptsByCategory(category.id);
              const isExpanded = expandedCategories.has(category.id);

              // Don't show custom category if empty
              if (category.id === 'custom' && prompts.length === 0) return null;

              return (
                <div key={category.id} className="mb-1">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors group"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-2.5 w-2.5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="h-2.5 w-2.5 text-zinc-400" />
                    )}
                    <span
                      className="w-5 h-5 flex items-center justify-center rounded text-xs transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      {category.icon}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                      {category.name}
                    </span>
                    <span className="text-[9px] text-zinc-400 ml-auto">
                      {prompts.length}
                    </span>
                  </button>

                  {isExpanded && prompts.length > 0 && (
                    <div className="ml-4 space-y-0.5 mt-0.5">
                      {prompts.map((prompt) => (
                        <div
                          key={prompt.id}
                          className="group relative flex items-center gap-1"
                          onMouseEnter={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const y = Math.max(8, Math.min(rect.top + rect.height / 2, window.innerHeight - 200));
                            setTooltipY(y);
                            setHoveredPrompt(prompt);
                          }}
                          onMouseLeave={() => setHoveredPrompt(null)}
                        >
                          <button
                            onClick={() => handlePromptClick(prompt)}
                            className={cn(
                              "flex-1 text-left px-2 py-1.5 text-[10px] rounded truncate transition-all duration-200",
                              "text-zinc-600 dark:text-zinc-400",
                              "hover:text-indigo-600 dark:hover:text-indigo-400",
                              "border border-transparent",
                              "hover:border-indigo-500/30 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10"
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              {prompt.title}
                              {prompt.complexity && (
                                <span className={cn(
                                  "px-1 py-0 text-[7px] rounded",
                                  getComplexityColor(prompt.complexity)
                                )}>
                                  {prompt.complexity === 'simple' ? 'S' : prompt.complexity === 'medium' ? 'M' : 'C'}
                                </span>
                              )}
                            </span>
                          </button>
                          {prompt.isCustom && (
                            <button
                              onClick={() => removeCustomPrompt(prompt.id)}
                              className="p-0.5 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete prompt"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Capabilities Panel - Unified orchestration controls */}
      <AICapabilitiesPanel />

      {/* Dependency Graph - Visual flow of active capabilities (collapsible) */}
      <div className="border-b border-zinc-300 dark:border-zinc-800">
        <button
          onClick={() => setDepGraphExpanded(!depGraphExpanded)}
          className="w-full flex items-center justify-between px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-1">
            <Layers className="h-2.5 w-2.5 text-blue-500" />
            <span className="text-[9px] font-medium text-zinc-700 dark:text-zinc-300">
              Flow
            </span>
          </div>
          <ChevronDown className={cn("h-2.5 w-2.5 text-zinc-500", depGraphExpanded && "rotate-180")} />
        </button>
        {depGraphExpanded && (
          <div className="px-2 pb-1">
            <DependencyGraph compact />
          </div>
        )}
      </div>

      {/* AI Helpers Section - Add reviewers, judges, debaters */}
      <AIHelpersSection />

      {/* Component Library Section */}
      <ComponentLibrarySection
        onInsertComponent={(code, id) => onInsertComponent?.(code, id)}
        onUseAsBase={(code, id) => onUseComponentAsBase?.(code, id)}
        onInsertWithAI={(code, id, mods) => onInsertComponentWithAI?.(code, id, mods)}
        collapsed={!componentsExpanded}
        onToggleCollapse={() => setComponentsExpanded(!componentsExpanded)}
      />

      {/* Changes History Section */}
      {changes.length > 0 && (
        <div className="flex flex-col border-b border-zinc-300 dark:border-zinc-800">
          {/* Changes header */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-1">
              <History className="h-2.5 w-2.5 text-zinc-500" />
              <label className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                Changes
              </label>
              <span className="text-[8px] bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-1 rounded-full">
                {changes.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChanges}
              className="h-4 w-4 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              title="Clear history"
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>

          {/* Changes list */}
          <div className="px-1 py-1">
            {changes.map((change) => (
              <button
                key={change.id}
                onClick={() => onScrollToMessage?.(change.messageId)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
              >
                <div className="flex items-center gap-1.5">
                  {/* Status icon */}
                  {change.status === 'applied' ? (
                    change.action === 'created' ? (
                      <FilePlus className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <FileEdit className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    )
                  ) : (
                    <FileX className="h-3 w-3 text-red-400 flex-shrink-0" />
                  )}

                  {/* File name */}
                  <span className={cn(
                    "text-[10px] font-medium truncate flex-1",
                    change.status === 'rejected'
                      ? "text-zinc-400 dark:text-zinc-500 line-through"
                      : "text-zinc-700 dark:text-zinc-300"
                  )}>
                    {change.filePath.split('/').pop()}
                  </span>

                  {/* Status badge */}
                  {change.status === 'applied' ? (
                    <Check className="h-2.5 w-2.5 text-emerald-500 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  ) : (
                    <XCircle className="h-2.5 w-2.5 text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  )}
                </div>

                {/* Summary and time */}
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate flex-1">
                    {change.summary.slice(0, 40)}{change.summary.length > 40 ? '...' : ''}
                  </span>
                  <span className="text-[8px] text-zinc-400 dark:text-zinc-600 flex-shrink-0">
                    {new Date(change.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

        {/* Smart Router Status - Shows routing decisions */}
        <div className="border-b border-zinc-300 dark:border-zinc-800">
          <RouterStatus />
        </div>
      </div>
      {/* End scrollable content area */}

      {/* Footer - compact horizontal row */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
        <div className="flex items-center gap-1">
          {/* New Build button */}
          <button
            onClick={onNewBuild}
            className="flex items-center gap-1 flex-1 text-[10px] font-medium transition-colors rounded px-2 py-1 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-300 dark:border-purple-700"
            title="New Build"
          >
            <Plus className="h-3 w-3" />
            <span>New</span>
          </button>

          {/* Save Progress button - only when project is open */}
          {projectPath && (
            <button
              onClick={handleSaveProgress}
              disabled={isSavingProgress}
              className={cn(
                "flex items-center gap-1 flex-1 text-[10px] font-medium transition-colors rounded px-2 py-1",
                saveSuccess
                  ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30"
                  : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
              )}
              title={saveSuccess ? "Progress Saved!" : "Save Progress"}
            >
              {isSavingProgress ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              <span>{saveSuccess ? "Saved" : "Save"}</span>
            </button>
          )}

          {/* Terminal toggle */}
          <button
            onClick={onTerminalToggle}
            className={cn(
              "flex items-center gap-1 flex-1 text-[10px] font-medium transition-colors rounded px-2 py-1",
              terminalOpen
                ? "text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30"
                : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
            title="Terminal"
          >
            <Terminal className="h-3 w-3" />
            <span>Term</span>
            {terminalOpen && <span className="text-[8px] font-bold">●</span>}
          </button>
        </div>
      </div>

      {/* Prompt hover tooltip */}
      {hoveredPrompt && (
        <div
          ref={promptTooltipRef}
          className="fixed z-[100] pointer-events-none"
          style={{
            left: '220px',
            top: tooltipY,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200">
            {/* Header with gradient */}
            <div className="px-3 py-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-b border-zinc-800">
              <h4 className="text-sm font-medium text-zinc-100">{hoveredPrompt.title}</h4>
              {hoveredPrompt.outputType && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Layers className="w-3 h-3 text-zinc-500" />
                  <span className="text-[10px] text-zinc-500">{getOutputTypeLabel(hoveredPrompt.outputType)}</span>
                </div>
              )}
            </div>

            {/* Preview hint */}
            {hoveredPrompt.previewHint && (
              <div className="px-3 py-2 border-b border-zinc-800/50">
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  {hoveredPrompt.previewHint}
                </p>
              </div>
            )}

            {/* Prompt preview */}
            <div className="px-3 py-2 max-h-20 overflow-hidden">
              <p className="text-[9px] text-zinc-500 line-clamp-3">
                {hoveredPrompt.prompt}
              </p>
            </div>

            {/* Footer with metadata */}
            <div className="px-3 py-2 bg-zinc-900/50 flex items-center gap-2">
              {hoveredPrompt.complexity && (
                <span className={cn(
                  "px-2 py-0.5 text-[8px] font-medium rounded-full",
                  getComplexityColor(hoveredPrompt.complexity)
                )}>
                  {hoveredPrompt.complexity === 'simple' ? 'Simple' : hoveredPrompt.complexity === 'medium' ? 'Medium' : 'Complex'}
                </span>
              )}
              {hoveredPrompt.techStack && hoveredPrompt.techStack.length > 0 && (
                <div className="flex gap-1 ml-auto">
                  {hoveredPrompt.techStack.slice(0, 3).map(tech => (
                    <span key={tech} className="px-1.5 py-0.5 text-[7px] bg-zinc-800 text-zinc-400 rounded">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prompt Gallery Modal */}
      <PromptGallery
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        onSelectPrompt={(prompt) => {
          if (onPromptSelect) {
            onPromptSelect(prompt);
          }
        }}
      />
    </div>
  );
}
