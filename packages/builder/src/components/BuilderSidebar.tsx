"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FolderOpen, Plus, FolderPlus, RefreshCw, X, Sparkles, Zap, Star,
  Rocket, Code2, Save, Loader2, History, FileEdit, FilePlus, FileX,
  Check, XCircle, ChevronDown, ChevronRight, BookOpen, Trash2,
  LayoutTemplate, Grid3X3, Layers, Cpu, Puzzle,
} from "lucide-react";
import { useBuilderStore, getLanguageFromPath } from "../stores/builderStore";
import { useChangesStore, type ChangeEntry } from "../stores/changesStore";
import {
  usePromptLibraryStore, PROMPT_CATEGORIES, PREBUILT_PROMPTS,
  type LibraryPrompt as Prompt, getComplexityColor, getOutputTypeLabel, cn,
} from "@sarge/core";
import { useAIModeStore } from "@sarge/core";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "../lib/projectTemplates";
import TemplateCard from "./TemplateCard";
import PromptGallery from "./PromptGallery";
import ComponentLibrarySection from "./ComponentLibrarySection";
import AIHelpersSection from "./AIHelpersSection";
import RouterStatus from "./RouterStatus";
import AICapabilitiesPanel from "./AICapabilitiesPanel";
import DependencyGraph from "./DependencyGraph";
import { Button } from "@/components/ui/button";
import FileTree from "./FileTree";
import { SkeletonFileTree } from "@/components/ui/skeleton";

// ─── AI Template definitions ─────────────────────────────────────────────────

const AI_TEMPLATES = [
  {
    id: "web",
    label: "Web",
    icon: "🌐",
    description: "Modern responsive web page",
    details: "Creates a clean, visually impressive HTML page with Tailwind CSS, smooth animations, and mobile-first design.",
    prompt: "Build a modern, responsive web page with a clean hero section, navigation bar, feature grid, and footer. Use Tailwind CSS via CDN. Make it visually impressive with smooth hover effects and gradient accents.",
  },
  {
    id: "ai-games",
    label: "AI Games",
    icon: "🎮",
    description: "Interactive browser game with AI",
    details: "Builds a complete browser game (word guessing, puzzle, quiz, etc.) with AI opponents or AI-generated content.",
    prompt: "Build an interactive browser word-guessing game (like Wordle) with AI-generated word selection, animated feedback tiles, difficulty levels, and a score tracker. Pure HTML/CSS/JS in a single file. Make it polished and fun.",
  },
  {
    id: "ai-app",
    label: "AI App",
    icon: "🤖",
    description: "AI-powered single-page application",
    details: "Creates a polished AI application — chat interface, content generator, analyzer, or assistant UI.",
    prompt: "Build a polished AI assistant interface — single HTML file with a modern chat UI, streaming animation effect, code syntax highlighting, markdown rendering, and dark theme. Style it like a premium AI product.",
  },
  {
    id: "mental",
    label: "Mental",
    icon: "🧠",
    description: "Mental wellness & mindfulness app",
    details: "Builds a mental wellness app — mood tracker, breathing exercises, meditation timer, or daily journal.",
    prompt: "Build a mental wellness web app with a mood tracker (emoji scale), guided breathing exercise with animated circle, daily journal with local storage, and motivational quote display. Calm dark theme with soft gradients. Single HTML file.",
  },
  {
    id: "financial",
    label: "Financial",
    icon: "💰",
    description: "Financial dashboard or calculator",
    details: "Creates financial tools — budget tracker, investment calculator, expense analyzer, or savings dashboard.",
    prompt: "Build a financial dashboard with an expense tracker, visual budget breakdown (pie chart via Chart.js CDN), savings goal progress bars, and monthly summary cards. Dark theme, clean data visualization. Single HTML file.",
  },
  {
    id: "website",
    label: "Website",
    icon: "🏠",
    description: "Complete multi-section website",
    details: "Creates a full professional website with nav, hero, about, services, portfolio, testimonials, and contact.",
    prompt: "Build a complete professional website with sticky navigation, hero section with CTA, about section, services grid, portfolio gallery with lightbox, testimonials carousel, and contact form. Tailwind CSS, smooth scroll, fully mobile responsive. Single HTML file.",
  },
];

// ─── Toolbar item definitions ────────────────────────────────────────────────

type PopoverId = "files" | "templates" | "prompts" | "helpers" | "components" | "router" | "changes";

const TOOLBAR_ITEMS: {
  id: PopoverId;
  icon: React.ElementType;
  label: string;
  color: string;       // icon + text color
  hover: string;       // hover bg + text
  active: string;      // active bg + border + text
}[] = [
  { id: "files",      icon: FolderOpen,     label: "Files",      color: "text-amber-500 dark:text-amber-400",   hover: "hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300",   active: "bg-amber-500/15 border-amber-400/50 text-amber-700 dark:text-amber-300"   },
  { id: "templates",  icon: LayoutTemplate, label: "Templates",  color: "text-purple-500 dark:text-purple-400", hover: "hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300", active: "bg-purple-500/15 border-purple-400/50 text-purple-700 dark:text-purple-300" },
  { id: "prompts",    icon: BookOpen,       label: "Prompts",    color: "text-blue-500 dark:text-blue-400",     hover: "hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300",     active: "bg-blue-500/15 border-blue-400/50 text-blue-700 dark:text-blue-300"     },
  { id: "helpers",    icon: Cpu,            label: "Helpers",    color: "text-cyan-500 dark:text-cyan-400",     hover: "hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-300",     active: "bg-cyan-500/15 border-cyan-400/50 text-cyan-700 dark:text-cyan-300"     },
  { id: "components", icon: Puzzle,         label: "Components", color: "text-emerald-500 dark:text-emerald-400", hover: "hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300", active: "bg-emerald-500/15 border-emerald-400/50 text-emerald-700 dark:text-emerald-300" },
  { id: "router",     icon: Layers,         label: "Router",     color: "text-rose-500 dark:text-rose-400",     hover: "hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300",     active: "bg-rose-500/15 border-rose-400/50 text-rose-700 dark:text-rose-300"     },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface BuilderSidebarProps {
  onFileOpen?: (content: string, path: string, language: string) => void;
  onNewFile?: () => void;
  onScrollToMessage?: (messageId: string) => void;
  onPromptSelect?: (prompt: string) => void;
  onInsertComponent?: (code: string, componentId: string) => void;
  onUseComponentAsBase?: (code: string, componentId: string) => void;
  onInsertComponentWithAI?: (code: string, componentId: string, modifications: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuilderSidebar({
  onFileOpen,
  onNewFile,
  onScrollToMessage,
  onPromptSelect,
  onInsertComponent,
  onUseComponentAsBase,
  onInsertComponentWithAI,
}: BuilderSidebarProps) {
  const changes = useChangesStore((s) => s.changes);
  const clearChanges = useChangesStore((s) => s.clearChanges);

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

  const [isLoading, setIsLoading] = useState(false);
  const [showPathInput, setShowPathInput] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectPath, setNewProjectPath] = useState("");
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [hoveredPrompt, setHoveredPrompt] = useState<Prompt | null>(null);
  const [tooltipY, setTooltipY] = useState(0);
  const [selectedAiTemplate, setSelectedAiTemplate] = useState<(typeof AI_TEMPLATES)[0] | null>(null);

  // Open Project modal state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverNew, setIsDraggingOverNew] = useState(false);
  const [dropFailed, setDropFailed] = useState(false); // true when drop occurred but path couldn't be extracted
  const [isBrowsing, setIsBrowsing] = useState(false); // true while native folder picker is open
  const [recentPaths, setRecentPaths] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("builder-recent-paths") || "[]"); }
      catch { return []; }
    }
    return [];
  });

  // New Project modal state
  const [showNewModal, setShowNewModal] = useState(false);

  // Toolbar popover state
  const [activePopover, setActivePopover] = useState<PopoverId | null>(null);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const promptTooltipRef = useRef<HTMLDivElement>(null);

  // Prompt library
  const {
    expandedCategories,
    hydrated: promptsHydrated,
    hydrate: hydratePrompts,
    toggleCategory,
    removeCustomPrompt,
    getPromptsByCategory,
  } = usePromptLibraryStore();

  const aiModeDisplayName = useAIModeStore((s) => s.getDisplayName);
  const executionMode = useAIModeStore((s) => s.executionMode);

  useEffect(() => {
    if (!builderHydrated) hydrateBuilder();
    if (!promptsHydrated) hydratePrompts();
  }, [builderHydrated, hydrateBuilder, promptsHydrated, hydratePrompts]);

  // Click outside — close popover
  useEffect(() => {
    if (!activePopover) return;
    function handleClick(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        // Also allow clicks within the fixed popover overlay
        const popoverEl = document.getElementById("builder-toolbar-popover");
        if (popoverEl && popoverEl.contains(e.target as Node)) return;
        setActivePopover(null);
        setPopoverRect(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activePopover]);

  // Escape key — close modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowOpenModal(false);
        setShowNewModal(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Custom events — let BuilderPage buttons trigger these modals
  useEffect(() => {
    const openHandler = () => { setPathInput(""); setShowOpenModal(true); setActivePopover(null); };
    const newHandler = () => { setSelectedTemplate(null); setNewProjectPath(""); setShowNewModal(true); setActivePopover(null); };
    window.addEventListener("builder:open-project", openHandler);
    window.addEventListener("builder:new-project", newHandler);
    return () => {
      window.removeEventListener("builder:open-project", openHandler);
      window.removeEventListener("builder:new-project", newHandler);
    };
  }, []);

  // Save a path to recents list
  const addToRecents = useCallback((path: string) => {
    setRecentPaths((prev) => {
      const updated = [path, ...prev.filter((p) => p !== path)].slice(0, 8);
      localStorage.setItem("builder-recent-paths", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Extract folder path from drag event (Windows Explorer → Chrome gives path in text/plain)
  const extractDropPath = useCallback((e: React.DragEvent): string => {
    // text/plain often has the Windows path when dragging from Explorer
    const text = e.dataTransfer.getData("text/plain");
    if (text && (text.match(/^[A-Za-z]:\\/) || text.startsWith("/"))) {
      return text.trim();
    }
    // file:// URI fallback
    const uriList = e.dataTransfer.getData("text/uri-list");
    if (uriList) {
      const firstUri = uriList.split("\n")[0].trim();
      if (firstUri.startsWith("file:///")) {
        return decodeURIComponent(firstUri.slice(8)).replace(/\//g, "\\");
      }
    }
    return "";
  }, []);

  // Toolbar button click — toggle popover with fixed positioning
  const handleToolbarClick = (id: PopoverId, e: React.MouseEvent<HTMLButtonElement>) => {
    if (activePopover === id) {
      setActivePopover(null);
      setPopoverRect(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopoverRect(rect);
      setActivePopover(id);
      // Reset sub-states when opening new popover
      setShowPathInput(false);
      setShowNewProjectInput(false);
      setSelectedTemplate(null);
      setSelectedAiTemplate(null);
    }
  };

  // Quick-access: open New Project modal
  const handleNewProjectQuick = () => {
    setSelectedTemplate(null);
    setNewProjectPath("");
    setShowNewModal(true);
    setActivePopover(null);
  };

  // Quick-access: open Open Project modal
  const handleOpenProjectQuick = () => {
    setPathInput("");
    setDropFailed(false);
    setShowOpenModal(true);
    setActivePopover(null);
  };

  // ─── File operations ────────────────────────────────────────────────────────

  const handleOpenProject = useCallback(async (folderPath: string) => {
    if (!folderPath.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/builder/list-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.projectPath, data.projectName, data.tree);
        setShowPathInput(false);
        setPathInput("");
        setActivePopover(null);
        setShowOpenModal(false);
        addToRecents(folderPath.trim());
      } else {
        alert(`Failed to open project: ${data.error}`);
      }
    } catch {
      alert("Failed to open project");
    } finally {
      setIsLoading(false);
    }
  }, [setProject, addToRecents]);

  // Open native OS folder picker via backend API.
  // Necessary because Chrome blocks reading file paths from drag-and-drop events.
  const handleBrowseFolder = useCallback(async () => {
    setIsBrowsing(true);
    setDropFailed(false);
    try {
      const res = await fetch('/api/builder/browse-folder', { method: 'POST' });
      const data = await res.json();
      if (data.cancelled) return; // User dismissed the dialog — do nothing
      if (data.path) {
        setPathInput(data.path);
        await handleOpenProject(data.path);
      } else if (data.error) {
        alert(`Browse failed: ${data.error}`);
      }
    } catch {
      alert('Could not open folder picker. Try typing the path manually.');
    } finally {
      setIsBrowsing(false);
    }
  }, [handleOpenProject]);

  const handleRefresh = useCallback(async () => {
    if (!projectPath) return;
    await handleOpenProject(projectPath);
  }, [projectPath, handleOpenProject]);

  const handleFileSelect = useCallback(async (filePath: string) => {
    try {
      const res = await fetch("/api/builder/read-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, projectPath }),
      });
      const data = await res.json();
      if (data.success) {
        const language = getLanguageFromPath(filePath);
        setCurrentFile(filePath, data.content, language);
        onFileOpen?.(data.content, filePath, language);
      }
    } catch (err) {
      console.error("Error reading file:", err);
    }
  }, [setCurrentFile, onFileOpen, projectPath]);

  const handleNewFile = useCallback(() => {
    setCurrentFile("untitled", "", "plaintext");
    onNewFile?.();
  }, [setCurrentFile, onNewFile]);

  const handleCreateFromTemplate = useCallback(async (template: ProjectTemplate, path: string) => {
    if (!path.trim()) return;
    setIsCreatingProject(true);
    try {
      const res = await fetch("/api/builder/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          projectPath: path.trim(),
          projectName: path.split(/[/\\]/).pop() || "New Project",
        }),
      });
      const data = await res.json();
      if (data.success) {
        await handleOpenProject(data.projectPath);
        setShowNewProjectInput(false);
        setShowNewModal(false);
        setSelectedTemplate(null);
        setNewProjectPath("");
      } else {
        alert(`Failed to create project: ${data.error}`);
      }
    } catch {
      alert("Failed to create project");
    } finally {
      setIsCreatingProject(false);
    }
  }, [handleOpenProject]);

  const handlePromptClick = useCallback((prompt: Prompt) => {
    onPromptSelect?.(prompt.prompt);
    setActivePopover(null);
  }, [onPromptSelect]);

  const handleAiTemplateUse = useCallback((template: typeof AI_TEMPLATES[0]) => {
    onPromptSelect?.(template.prompt);
    setActivePopover(null);
    setSelectedAiTemplate(null);
  }, [onPromptSelect]);

  // ─── Popover content renderer ───────────────────────────────────────────────

  const renderPopoverContent = (id: PopoverId) => {
    switch (id) {

      // ── Files popover ────────────────────────────────────────────────────────
      case "files":
        return (
          <div className="w-72 flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">File Explorer</span>
              {projectPath && (
                <div className="flex items-center gap-0.5">
                  <button onClick={handleNewFile} title="New file"
                    className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 rounded transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={handleRefresh} disabled={isLoading} title="Refresh"
                    className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 rounded transition-colors">
                    <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                  </button>
                  <button onClick={clearProject} title="Close project"
                    className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
              {projectPath ? (
                <>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    <FolderOpen className="h-4 w-4 text-amber-500" />
                    <span className="truncate">{projectName}</span>
                  </div>
                  {isLoading ? <SkeletonFileTree /> : <FileTree nodes={fileTree} onFileSelect={handleFileSelect} />}
                </>
              ) : showNewProjectInput && selectedTemplate ? (
                <div className="space-y-2 p-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{selectedTemplate.icon}</span>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{selectedTemplate.name}</span>
                  </div>
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newProjectPath.trim()) handleCreateFromTemplate(selectedTemplate, newProjectPath);
                      if (e.key === "Escape") { setShowNewProjectInput(false); setSelectedTemplate(null); }
                    }}
                    placeholder="Enter project path…"
                    className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => handleCreateFromTemplate(selectedTemplate, newProjectPath)}
                      disabled={!newProjectPath.trim() || isCreatingProject}
                      className="flex-1 h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                      {isCreatingProject ? "Creating…" : "Create"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowNewProjectInput(false); setSelectedTemplate(null); }}
                      className="h-7 text-xs">Cancel</Button>
                  </div>
                </div>
              ) : showPathInput ? (
                <div className="space-y-2 p-1">
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleOpenProject(pathInput);
                      if (e.key === "Escape") setShowPathInput(false);
                    }}
                    placeholder="Enter folder path…"
                    className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => handleOpenProject(pathInput)}
                      disabled={!pathInput.trim() || isLoading}
                      className="flex-1 h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                      {isLoading ? "Loading…" : "Open"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowPathInput(false)}
                      className="h-7 text-xs">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 p-1">
                  {/* New project template grid */}
                  <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-2">New Project</p>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {PROJECT_TEMPLATES.map((t) => (
                      <TemplateCard key={t.id} template={t} onClick={() => {
                        setSelectedTemplate(t);
                        setShowNewProjectInput(true);
                      }} />
                    ))}
                  </div>
                  <Button variant="outline" size="sm"
                    onClick={() => { setShowOpenModal(true); setActivePopover(null); }}
                    className="w-full h-7 text-xs gap-1">
                    <FolderPlus className="h-3 w-3" /> Open Existing
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleNewFile}
                    className="w-full h-7 text-xs gap-1 text-zinc-500">
                    <Plus className="h-3 w-3" /> New File
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      // ── AI Templates popover ─────────────────────────────────────────────────
      case "templates":
        return (
          <div className="w-80 flex flex-col max-h-[70vh]">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">AI Templates</span>
              <p className="text-[10px] text-zinc-500 mt-0.5">Click a template to preview — then inject into chat</p>
            </div>

            {selectedAiTemplate ? (
              /* Detail view */
              <div className="p-4 space-y-3">
                <button onClick={() => setSelectedAiTemplate(null)}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                  <ChevronRight className="h-3 w-3 rotate-180" /> Back
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedAiTemplate.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedAiTemplate.label}</h3>
                    <p className="text-[10px] text-zinc-500">{selectedAiTemplate.description}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{selectedAiTemplate.details}</p>
                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-2">
                  <p className="text-[10px] text-zinc-500 mb-1 font-medium">Will inject:</p>
                  <p className="text-[10px] text-zinc-600 dark:text-zinc-300 line-clamp-3">{selectedAiTemplate.prompt}</p>
                </div>
                <button
                  onClick={() => handleAiTemplateUse(selectedAiTemplate)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Use Template
                </button>
              </div>
            ) : (
              /* Grid view */
              <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto">
                {AI_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedAiTemplate(t)}
                    className="flex flex-col items-start gap-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">{t.icon}</span>
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t.label}</span>
                    <span className="text-[9px] text-zinc-500 leading-tight">{t.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      // ── Prompts popover ──────────────────────────────────────────────────────
      case "prompts":
        return (
          <div className="w-72 flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Prompt Library</span>
              <button onClick={() => setShowGallery(true)}
                className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors">
                <Grid3X3 className="h-2.5 w-2.5" /> Browse All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-1 py-1.5">
              {PROMPT_CATEGORIES.map((category) => {
                const prompts = getPromptsByCategory(category.id);
                const isExpanded = expandedCategories.has(category.id);
                if (category.id === "custom" && prompts.length === 0) return null;
                return (
                  <div key={category.id} className="mb-1">
                    <button onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors group">
                      {isExpanded
                        ? <ChevronDown className="h-2.5 w-2.5 text-zinc-400" />
                        : <ChevronRight className="h-2.5 w-2.5 text-zinc-400" />}
                      <span className="w-5 h-5 flex items-center justify-center rounded text-xs"
                        style={{ backgroundColor: `${category.color}20` }}>{category.icon}</span>
                      <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">{category.name}</span>
                      <span className="text-[9px] text-zinc-400 ml-auto">{prompts.length}</span>
                    </button>
                    {isExpanded && prompts.length > 0 && (
                      <div className="ml-4 space-y-0.5 mt-0.5">
                        {prompts.map((prompt) => (
                          <div key={prompt.id} className="group relative flex items-center gap-1"
                            onMouseEnter={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setTooltipY(Math.max(8, Math.min(rect.top + rect.height / 2, window.innerHeight - 200)));
                              setHoveredPrompt(prompt);
                            }}
                            onMouseLeave={() => setHoveredPrompt(null)}>
                            <button onClick={() => handlePromptClick(prompt)}
                              className={cn(
                                "flex-1 text-left px-2 py-1.5 text-[10px] rounded truncate transition-all",
                                "text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400",
                                "border border-transparent hover:border-indigo-500/30 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10"
                              )}>
                              <span className="flex items-center gap-1.5">
                                {prompt.title}
                                {prompt.complexity && (
                                  <span className={cn("px-1 py-0 text-[7px] rounded", getComplexityColor(prompt.complexity))}>
                                    {prompt.complexity === "simple" ? "S" : prompt.complexity === "medium" ? "M" : "C"}
                                  </span>
                                )}
                              </span>
                            </button>
                            {prompt.isCustom && (
                              <button onClick={() => removeCustomPrompt(prompt.id)}
                                className="p-0.5 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete prompt">
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
          </div>
        );

      // ── AI Helpers popover ───────────────────────────────────────────────────
      case "helpers":
        return (
          <div className="w-72 max-h-[70vh] overflow-y-auto">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">AI Helpers</span>
              <p className="text-[10px] text-zinc-500 mt-0.5">Add reviewers, judges, and debaters</p>
            </div>
            <div className="p-2">
              <AICapabilitiesPanel />
              <AIHelpersSection />
            </div>
          </div>
        );

      // ── Components popover ───────────────────────────────────────────────────
      case "components":
        return (
          <div className="w-72 max-h-[70vh] overflow-y-auto">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Component Library</span>
              <p className="text-[10px] text-zinc-500 mt-0.5">Insert, use as base, or modify with AI</p>
            </div>
            <ComponentLibrarySection
              onInsertComponent={(code, id) => { onInsertComponent?.(code, id); setActivePopover(null); }}
              onUseAsBase={(code, id) => { onUseComponentAsBase?.(code, id); setActivePopover(null); }}
              onInsertWithAI={(code, id, mods) => { onInsertComponentWithAI?.(code, id, mods); setActivePopover(null); }}
              collapsed={false}
              onToggleCollapse={() => {}}
            />
          </div>
        );

      // ── Router / Flow popover ────────────────────────────────────────────────
      case "router":
        return (
          <div className="w-72 max-h-[70vh] overflow-y-auto">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Smart Router</span>
              <p className="text-[10px] text-zinc-500 mt-0.5">AI routing decisions and capability flow</p>
            </div>
            <div className="p-2 space-y-2">
              <RouterStatus />
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2">
                <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 px-1">Flow</p>
                <DependencyGraph compact />
              </div>
            </div>
          </div>
        );

      // ── Changes popover ──────────────────────────────────────────────────────
      case "changes":
        return (
          <div className="w-72 flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Changes</span>
                <span className="text-[9px] bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-1.5 rounded-full">
                  {changes.length}
                </span>
              </div>
              <button onClick={clearChanges}
                className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors" title="Clear history">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              {changes.map((change) => (
                <button key={change.id} onClick={() => { onScrollToMessage?.(change.messageId); setActivePopover(null); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                  <div className="flex items-center gap-1.5">
                    {change.status === "applied"
                      ? (change.action === "created"
                        ? <FilePlus className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        : <FileEdit className="h-3 w-3 text-blue-500 flex-shrink-0" />)
                      : <FileX className="h-3 w-3 text-red-400 flex-shrink-0" />}
                    <span className={cn(
                      "text-[10px] font-medium truncate flex-1",
                      change.status === "rejected" ? "text-zinc-400 line-through" : "text-zinc-700 dark:text-zinc-300"
                    )}>
                      {change.filePath.split("/").pop()}
                    </span>
                    {change.status === "applied"
                      ? <Check className="h-2.5 w-2.5 text-emerald-500 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                      : <XCircle className="h-2.5 w-2.5 text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100" />}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] text-zinc-400 truncate flex-1">
                      {change.summary.slice(0, 40)}{change.summary.length > 40 ? "…" : ""}
                    </span>
                    <span className="text-[8px] text-zinc-400 dark:text-zinc-600 flex-shrink-0">
                      {new Date(change.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Render: horizontal toolbar ─────────────────────────────────────────────

  return (
    <>
      <div
        ref={toolbarRef}
        className="relative flex-shrink-0 flex flex-row items-center h-12 px-3 bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800"
      >
        {/* CENTER — colored, bigger toolbar items */}
        <div className="flex-1 flex items-center justify-center gap-1">
          {TOOLBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePopover === item.id;
            return (
              <button
                key={item.id}
                onClick={(e) => handleToolbarClick(item.id, e)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border",
                  isActive
                    ? item.active
                    : cn("border-transparent", item.color, item.hover)
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {/* File badge */}
                {item.id === "files" && projectName && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                )}
              </button>
            );
          })}

          {/* Changes button (conditional) */}
          {changes.length > 0 && (
            <button
              onClick={(e) => handleToolbarClick("changes", e)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border",
                activePopover === "changes"
                  ? "bg-orange-500/15 border-orange-400/50 text-orange-700 dark:text-orange-300"
                  : "border-transparent text-orange-500 dark:text-orange-400 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-300"
              )}
            >
              <History className="h-4 w-4" />
              <span>Changes</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full">
                {changes.length}
              </span>
            </button>
          )}
        </div>

        {/* RIGHT — AI mode indicator */}
        <span className={cn(
          "flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium",
          executionMode === "local" && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
          executionMode === "cloud" && "bg-violet-500/20 text-violet-600 dark:text-violet-400",
          executionMode === "hybrid" && "bg-amber-500/20 text-amber-600 dark:text-amber-400"
        )}>
          <Zap className="h-2.5 w-2.5" />
          <span className="hidden sm:inline">{aiModeDisplayName()}</span>
        </span>
      </div>

      {/* Fixed-position popover overlay */}
      {activePopover && popoverRect && (
        <div
          id="builder-toolbar-popover"
          className="fixed z-[200] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: Math.min(popoverRect.left, window.innerWidth - 320),
            top: popoverRect.bottom + 4,
          }}
        >
          {renderPopoverContent(activePopover)}
        </div>
      )}

      {/* Prompt hover tooltip — rendered at fixed position */}
      {hoveredPrompt && (
        <div
          ref={promptTooltipRef}
          className="fixed z-[300] pointer-events-none w-64"
          style={{ left: "50%", top: tooltipY, transform: "translateY(-50%)" }}
        >
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-b border-zinc-800">
              <h4 className="text-sm font-medium text-zinc-100">{hoveredPrompt.title}</h4>
              {hoveredPrompt.outputType && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Layers className="w-3 h-3 text-zinc-500" />
                  <span className="text-[10px] text-zinc-500">{getOutputTypeLabel(hoveredPrompt.outputType)}</span>
                </div>
              )}
            </div>
            {hoveredPrompt.previewHint && (
              <div className="px-3 py-2 border-b border-zinc-800/50">
                <p className="text-[10px] text-zinc-400 leading-relaxed">{hoveredPrompt.previewHint}</p>
              </div>
            )}
            <div className="px-3 py-2 max-h-20 overflow-hidden">
              <p className="text-[9px] text-zinc-500 line-clamp-3">{hoveredPrompt.prompt}</p>
            </div>
            <div className="px-3 py-2 bg-zinc-900/50 flex items-center gap-2">
              {hoveredPrompt.complexity && (
                <span className={cn("px-2 py-0.5 text-[8px] font-medium rounded-full", getComplexityColor(hoveredPrompt.complexity))}>
                  {hoveredPrompt.complexity === "simple" ? "Simple" : hoveredPrompt.complexity === "medium" ? "Medium" : "Complex"}
                </span>
              )}
              {hoveredPrompt.techStack && hoveredPrompt.techStack.length > 0 && (
                <div className="flex gap-1 ml-auto">
                  {hoveredPrompt.techStack.slice(0, 3).map((tech) => (
                    <span key={tech} className="px-1.5 py-0.5 text-[7px] bg-zinc-800 text-zinc-400 rounded">{tech}</span>
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
        onSelectPrompt={(prompt) => { onPromptSelect?.(prompt); setActivePopover(null); }}
      />

      {/* ─── Open Project Modal ─────────────────────────────────────────────── */}
      {showOpenModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowOpenModal(false); }}
        >
          <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 w-[560px] max-w-[95vw] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Open Project</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Load a folder from your computer</p>
              </div>
              <button onClick={() => setShowOpenModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Primary action: Browse button (native OS picker — always reliable) */}
              <button
                onClick={handleBrowseFolder}
                disabled={isBrowsing || isLoading}
                className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {isBrowsing ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Opening folder picker...</>
                ) : (
                  <><FolderOpen className="h-5 w-5" /> Browse for Folder</>
                )}
              </button>

              {/* Drag & Drop Zone — visual affordance; path extraction works when browser allows it */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); setDropFailed(false); }}
                onDragEnter={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  const droppedPath = extractDropPath(e);
                  if (droppedPath) {
                    setDropFailed(false);
                    setPathInput(droppedPath);
                    handleOpenProject(droppedPath);
                  } else {
                    // Chrome blocks reading paths from file system drags — show fallback
                    setDropFailed(true);
                  }
                }}
                className={cn(
                  "rounded-xl border-2 border-dashed h-28 flex flex-col items-center justify-center cursor-default transition-all duration-200",
                  isDraggingOver
                    ? "border-indigo-400 bg-indigo-500/15 scale-[1.01]"
                    : dropFailed
                    ? "border-amber-500/60 bg-amber-500/5"
                    : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/40"
                )}
              >
                {dropFailed ? (
                  <>
                    <p className="text-sm font-semibold text-amber-400">Browser blocked the path</p>
                    <p className="text-xs text-zinc-500 mt-1 text-center px-6">
                      Chrome can't read folder paths from drag-and-drop.
                      Use the Browse button above or paste the path below.
                    </p>
                  </>
                ) : (
                  <>
                    <FolderOpen className={cn("h-8 w-8 mb-1.5 transition-colors", isDraggingOver ? "text-indigo-400" : "text-zinc-600")} />
                    <p className={cn("text-xs font-medium transition-colors", isDraggingOver ? "text-indigo-300" : "text-zinc-500")}>
                      {isDraggingOver ? "Release to open folder" : "or drag a folder here"}
                    </p>
                  </>
                )}
              </div>

              {/* Recent Folders */}
              {recentPaths.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-2">Recent Folders</p>
                  <div className="space-y-1">
                    {recentPaths.slice(0, 6).map((path) => (
                      <button
                        key={path}
                        onClick={() => handleOpenProject(path)}
                        disabled={isLoading}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2.5 group"
                      >
                        <FolderOpen className="h-4 w-4 flex-shrink-0 text-amber-500 group-hover:text-amber-400" />
                        <span className="truncate flex-1">{path}</span>
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600 group-hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual path input */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-2">
                  Or paste / type a path
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => { setPathInput(e.target.value); setDropFailed(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && pathInput.trim()) handleOpenProject(pathInput); }}
                    placeholder="e.g. L:\projects\my-site"
                    className={cn(
                      "flex-1 px-3 py-2.5 text-sm rounded-lg bg-zinc-800 border text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1",
                      dropFailed
                        ? "border-amber-500/60 focus:border-amber-400 focus:ring-amber-500/30"
                        : "border-zinc-700 focus:border-indigo-500 focus:ring-indigo-500/30"
                    )}
                    autoFocus={dropFailed || recentPaths.length === 0}
                  />
                  <button
                    onClick={() => pathInput.trim() && handleOpenProject(pathInput)}
                    disabled={!pathInput.trim() || isLoading}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FolderOpen className="h-4 w-4" /> Open</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── New Project Modal ──────────────────────────────────────────────── */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}
        >
          <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 w-[640px] max-w-[95vw] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">New Project</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Choose a template to get started</p>
              </div>
              <button onClick={() => { setShowNewModal(false); setSelectedTemplate(null); setNewProjectPath(""); }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {!selectedTemplate ? (
                /* Step 1 — Pick a template */
                <div className="grid grid-cols-3 gap-3">
                  {PROJECT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className="flex flex-col items-start gap-2 p-4 rounded-xl border border-zinc-700 bg-zinc-800/50 hover:border-indigo-500 hover:bg-indigo-900/20 transition-all text-left group"
                    >
                      <span className="text-3xl group-hover:scale-110 transition-transform">{t.icon}</span>
                      <span className="text-sm font-bold text-zinc-200">{t.name}</span>
                      <span className="text-[10px] text-zinc-500 leading-tight">{t.description}</span>
                    </button>
                  ))}
                </div>
              ) : (
                /* Step 2 — Pick where to create it */
                <div className="space-y-5">
                  <button onClick={() => setSelectedTemplate(null)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                    <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                    Back to templates
                  </button>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800 border border-zinc-700">
                    <span className="text-2xl">{selectedTemplate.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-zinc-200">{selectedTemplate.name}</p>
                      <p className="text-xs text-zinc-500">{selectedTemplate.description}</p>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-zinc-300">Where should the project be created?</p>

                  {/* Drag zone for parent folder */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOverNew(true); }}
                    onDragEnter={(e) => { e.preventDefault(); setIsDraggingOverNew(true); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOverNew(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOverNew(false);
                      const path = extractDropPath(e);
                      if (path) setNewProjectPath(path);
                    }}
                    className={cn(
                      "rounded-xl border-2 border-dashed h-24 flex flex-col items-center justify-center cursor-default transition-all",
                      isDraggingOverNew
                        ? "border-emerald-400 bg-emerald-500/10"
                        : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/40"
                    )}
                  >
                    <FolderPlus className={cn("h-8 w-8 mb-1 transition-colors", isDraggingOverNew ? "text-emerald-400" : "text-zinc-600")} />
                    <p className={cn("text-xs font-medium transition-colors", isDraggingOverNew ? "text-emerald-300" : "text-zinc-500")}>
                      {isDraggingOverNew ? "Drop parent folder" : "Drop a parent folder here"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProjectPath}
                      onChange={(e) => setNewProjectPath(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && newProjectPath.trim() && selectedTemplate) handleCreateFromTemplate(selectedTemplate, newProjectPath); }}
                      placeholder="e.g. L:\projects\my-new-site"
                      className="flex-1 px-3 py-2.5 text-sm rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                      autoFocus
                    />
                    <button
                      onClick={() => selectedTemplate && newProjectPath.trim() && handleCreateFromTemplate(selectedTemplate, newProjectPath)}
                      disabled={!newProjectPath.trim() || isCreatingProject}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5"
                    >
                      {isCreatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Create</>}
                    </button>
                  </div>

                  {/* Recent paths as quick picks */}
                  {recentPaths.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1.5">Recent locations</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recentPaths.slice(0, 4).map((p) => (
                          <button key={p} onClick={() => setNewProjectPath(p)}
                            className="px-2 py-1 rounded-md text-[10px] bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700 transition-colors truncate max-w-[200px]"
                            title={p}>
                            {p.split(/[/\\]/).pop() || p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
