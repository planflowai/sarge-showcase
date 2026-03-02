"use client";

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import {
  FolderOpen, Plus, FolderPlus, RefreshCw, X, Sparkles, Star,
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
import { PROJECT_TEMPLATES, type ProjectTemplate } from "../lib/projectTemplates";
import TemplateCard from "./TemplateCard";
import PromptGallery from "./PromptGallery";
import AIHelpersSection from "./AIHelpersSection";
import { Button } from "@/components/ui/button";
import FileTree from "./FileTree";
import { SkeletonFileTree } from "@/components/ui/skeleton";
import { useProjectCommandStore } from "../stores/projectCommandStore";

// Lazy-load heavy sidebar sections — prevents their stores from hydrating on mount
const ComponentLibrarySection = lazy(() => import("./ComponentLibrarySection"));
const RouterStatus = lazy(() => import("./RouterStatus"));
const AICapabilitiesPanel = lazy(() => import("./AICapabilitiesPanel"));
const DependencyGraph = lazy(() => import("./DependencyGraph"));

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
  {
    id: "todo-app",
    label: "Todo App",
    icon: "✅",
    description: "Task manager with local storage",
    details: "Builds a fully functional todo/task management app with add, complete, delete, filter, and persistent localStorage.",
    prompt: "Build a polished todo app with task creation, completion toggle, delete, priority levels, and category filters. Persist data in localStorage. Dark theme with smooth animations. Single HTML file with Tailwind CSS.",
  },
  {
    id: "calculator",
    label: "Calculator",
    icon: "🔢",
    description: "Scientific calculator app",
    details: "Creates a sleek calculator with standard and scientific modes, history log, and keyboard support.",
    prompt: "Build a scientific calculator with standard and scientific modes (sin, cos, tan, log, sqrt, powers). Include a calculation history panel, keyboard input support, and a dark OLED-style theme. Single HTML file.",
  },
  {
    id: "admin-dashboard",
    label: "Admin Panel",
    icon: "🖥️",
    description: "Admin dashboard with charts",
    details: "Creates a full admin dashboard with stat cards, charts, tables, and sidebar navigation.",
    prompt: "Build a dark-themed admin dashboard with: sidebar navigation, stat cards (revenue, users, orders, growth), a line chart and bar chart using Chart.js CDN, a recent orders table with status badges, and top performing items list. Single HTML file.",
  },
  {
    id: "kanban",
    label: "Kanban Board",
    icon: "📋",
    description: "Drag-and-drop project board",
    details: "Creates a Kanban board with drag-and-drop columns (To Do, In Progress, Done), card management, and task details.",
    prompt: "Build a Kanban board with drag-and-drop support, three columns (Backlog, In Progress, Done), add/delete cards, card priority colors, task count per column. Dark minimal theme. Single HTML file.",
  },
  {
    id: "saas-landing",
    label: "SaaS Landing",
    icon: "🌟",
    description: "SaaS product landing page",
    details: "Creates a high-converting SaaS landing page with hero, features, pricing tiers, testimonials, and FAQ.",
    prompt: "Build a high-converting SaaS landing page with: animated hero with email capture, 6-feature grid with icons, 3-tier pricing table (Free/Pro/Enterprise) with feature comparison, social proof testimonials, FAQ accordion, and CTA footer. Modern purple/indigo gradient theme. Single HTML file.",
  },
  {
    id: "ecommerce-store",
    label: "E-Commerce",
    icon: "🛒",
    description: "Product store with shopping cart",
    details: "Creates a product grid, detail modal, and fully functional shopping cart with localStorage persistence.",
    prompt: "Build an e-commerce product page with a responsive product grid (12 items), product detail modal with image, description, size selector and add-to-cart, a slide-out shopping cart sidebar with quantity controls and total, and checkout button. localStorage cart persistence. Single HTML file.",
  },
  {
    id: "notes-app",
    label: "Notes App",
    icon: "📝",
    description: "Markdown notes with local storage",
    details: "Builds a notes app with markdown rendering, tag system, search, and persistent localStorage.",
    prompt: "Build a markdown notes app with a sidebar listing notes (title + preview), markdown rendering in the editor, tags/categories, full-text search, and localStorage persistence. Split-pane layout: list left, editor right. Dark theme. Single HTML file.",
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
  { id: "files",      icon: FolderOpen,     label: "Project",      color: "text-amber-500 dark:text-amber-400",   hover: "hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300",   active: "bg-amber-500/15 border-amber-400/50 text-amber-700 dark:text-amber-300"   },
  { id: "templates",  icon: LayoutTemplate, label: "Quick Start",  color: "text-purple-500 dark:text-purple-400", hover: "hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300", active: "bg-purple-500/15 border-purple-400/50 text-purple-700 dark:text-purple-300" },
  { id: "prompts",    icon: BookOpen,       label: "Commands",     color: "text-blue-500 dark:text-blue-400",     hover: "hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300",     active: "bg-blue-500/15 border-blue-400/50 text-blue-700 dark:text-blue-300"     },
  { id: "helpers",    icon: Cpu,            label: "AI Team",      color: "text-cyan-500 dark:text-cyan-400",     hover: "hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-300",     active: "bg-cyan-500/15 border-cyan-400/50 text-cyan-700 dark:text-cyan-300"     },
  { id: "components", icon: Puzzle,         label: "UI Parts",     color: "text-emerald-500 dark:text-emerald-400", hover: "hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300", active: "bg-emerald-500/15 border-emerald-400/50 text-emerald-700 dark:text-emerald-300" },
  { id: "router",     icon: Layers,         label: "AI Router",    color: "text-rose-500 dark:text-rose-400",     hover: "hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300",     active: "bg-rose-500/15 border-rose-400/50 text-rose-700 dark:text-rose-300"     },
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

  // Projects Hub is now in ProjectCommandCenter (rendered by BuilderPage)

  // Inline toast system (replaces alert() calls)
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: "success" | "error" | "info" | "warning" }[]>([]);
  const showToast = useCallback((msg: string, type: "success" | "error" | "info" | "warning" = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Legacy — kept so the Files popover "Open Existing" button still works
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverNew, setIsDraggingOverNew] = useState(false);
  const [dropFailed, setDropFailed] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [recentPaths, setRecentPaths] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("builder-recent-paths") || "[]"); }
      catch { return []; }
    }
    return [];
  });

  // New Project modal state (legacy — kept for Files popover compat)
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

  // Quick-access: open Projects Hub (via ProjectCommandCenter store)
  const handleNewProjectQuick = () => useProjectCommandStore.getState().open("new");
  const handleOpenProjectQuick = () => useProjectCommandStore.getState().open("grid");

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
        showToast(data.error || "Failed to open project", "error");
      }
    } catch {
      showToast("Failed to open project", "error");
    } finally {
      setIsLoading(false);
    }
  }, [setProject, addToRecents]);

  // ─── Projects Hub delegated to ProjectCommandCenter (store-driven) ──────────

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
        showToast(data.error || "Browse failed", "error");
      }
    } catch {
      showToast("Could not open folder picker. Try typing the path manually.", "error");
    } finally {
      setIsBrowsing(false);
    }
  }, [handleOpenProject, showToast]);

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
        showToast(data.error || "Failed to create project", "error");
      }
    } catch {
      showToast("Failed to create project", "error");
    } finally {
      setIsCreatingProject(false);
    }
  }, [handleOpenProject, showToast]);

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
          <div className="w-[600px] flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <div>
                <span className="text-base font-bold text-zinc-800 dark:text-zinc-100">Project Files</span>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Browse, create, and manage your project files</p>
              </div>
              {projectPath && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowPathInput(!showPathInput)} title="Open project"
                    className="p-1.5 text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700">
                    <FolderOpen className="h-4 w-4" />
                  </button>
                  <button onClick={handleNewFile} title="New file"
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button onClick={handleRefresh} disabled={isLoading} title="Refresh"
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700">
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </button>
                  <button onClick={clearProject} title="Close project"
                    className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {projectPath ? (
                <>
                  {/* Inline path input for switching projects */}
                  {showPathInput && (
                    <div className="space-y-2 p-2 mb-3 border-b border-zinc-200 dark:border-zinc-700 pb-3">
                      <input
                        type="text"
                        value={pathInput}
                        onChange={(e) => setPathInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && pathInput.trim()) handleOpenProject(pathInput);
                          if (e.key === "Escape") setShowPathInput(false);
                        }}
                        placeholder="Enter folder path…"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleOpenProject(pathInput)}
                          disabled={!pathInput.trim() || isLoading}
                          className="flex-1 h-8 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                          {isLoading ? "Loading…" : "Open"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowPathInput(false)}
                          className="h-8 text-sm">Cancel</Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                    <FolderOpen className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    <span className="truncate">{projectName}</span>
                  </div>
                  {isLoading ? <SkeletonFileTree /> : <FileTree nodes={fileTree} onFileSelect={handleFileSelect} />}
                </>
              ) : showNewProjectInput && selectedTemplate ? (
                <div className="space-y-3 p-2">
                  <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-200 dark:border-indigo-500/20">
                    <span className="text-2xl">{selectedTemplate.icon}</span>
                    <div>
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{selectedTemplate.name}</span>
                      <p className="text-xs text-zinc-500">Choose a location for your new project</p>
                    </div>
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleCreateFromTemplate(selectedTemplate, newProjectPath)}
                      disabled={!newProjectPath.trim() || isCreatingProject}
                      className="flex-1 h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                      {isCreatingProject ? "Creating…" : "Create Project"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowNewProjectInput(false); setSelectedTemplate(null); }}
                      className="h-9 text-sm">Cancel</Button>
                  </div>
                </div>
              ) : showPathInput ? (
                <div className="space-y-3 p-2">
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleOpenProject(pathInput);
                      if (e.key === "Escape") setShowPathInput(false);
                    }}
                    placeholder="Enter folder path…"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleOpenProject(pathInput)}
                      disabled={!pathInput.trim() || isLoading}
                      className="flex-1 h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                      {isLoading ? "Loading…" : "Open Project"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowPathInput(false)}
                      className="h-9 text-sm">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-2">
                  {/* New Client Project — opens wizard modal */}
                  <button
                    onClick={() => { window.dispatchEvent(new CustomEvent("project:new-wizard")); setActivePopover(null); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all border-2 border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-400 hover:bg-indigo-500/10 group"
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }}>🚀</span>
                    <div>
                      <span className="text-sm font-bold text-white block">New Client Project</span>
                      <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors">Wizard — name, package, toggles, auto-deploy</span>
                    </div>
                  </button>

                  {/* New project template grid */}
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Quick Start Templates</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PROJECT_TEMPLATES.map((t) => (
                      <TemplateCard key={t.id} template={t} onClick={() => {
                        setSelectedTemplate(t);
                        setShowNewProjectInput(true);
                      }} />
                    ))}
                  </div>
                  <Button variant="outline" size="sm"
                    onClick={() => { setShowOpenModal(true); setActivePopover(null); }}
                    className="w-full h-9 text-sm gap-2 rounded-lg">
                    <FolderPlus className="h-4 w-4" /> Open Existing Project
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleNewFile}
                    className="w-full h-9 text-sm gap-2 text-zinc-500 rounded-lg">
                    <Plus className="h-4 w-4" /> New Blank File
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      // ── Quick Start / AI Templates popover ───────────────────────────────────
      case "templates":
        return (
          <div className="w-[640px] flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Quick Start Templates</h2>
              <p className="text-sm text-zinc-500 mt-1">Pick a template and the AI builds it for you. Click one to see details, then hit &quot;Build This&quot;.</p>
            </div>

            {selectedAiTemplate ? (
              /* Detail view */
              <div className="p-6 space-y-4">
                <button onClick={() => setSelectedAiTemplate(null)}
                  className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium">
                  <ChevronRight className="h-4 w-4 rotate-180" /> Back to templates
                </button>
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{selectedAiTemplate.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{selectedAiTemplate.label}</h3>
                    <p className="text-sm text-zinc-500">{selectedAiTemplate.description}</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{selectedAiTemplate.details}</p>
                <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 p-4">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">What the AI will build:</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-4">{selectedAiTemplate.prompt}</p>
                </div>
                <button
                  onClick={() => handleAiTemplateUse(selectedAiTemplate)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Build This
                </button>
              </div>
            ) : (
              /* Grid view — big cards */
              <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto">
                {AI_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedAiTemplate(t)}
                    className="flex items-start gap-4 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform flex-shrink-0 mt-0.5">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 block">{t.label}</span>
                      <span className="text-xs text-zinc-500 leading-relaxed mt-1 block">{t.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      // ── Commands / Prompts popover ───────────────────────────────────────────
      case "prompts":
        return (
          <div className="w-[1100px] flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">AI Commands</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Pre-written instructions for common tasks. Click &quot;Send&quot; to run one.</p>
              </div>
              <button onClick={() => setShowGallery(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                <Grid3X3 className="h-3.5 w-3.5" /> Browse All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {PROMPT_CATEGORIES.map((category) => {
                const prompts = getPromptsByCategory(category.id);
                const isExpanded = expandedCategories.has(category.id);
                if (category.id === "custom" && prompts.length === 0) return null;
                return (
                  <div key={category.id} className="mb-1">
                    {/* Category header */}
                    <button onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-zinc-400" />
                        : <ChevronRight className="h-4 w-4 text-zinc-400" />}
                      <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
                        style={{ backgroundColor: `${category.color}20` }}>{category.icon}</span>
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{category.name}</span>
                      <span className="text-xs text-zinc-400 ml-auto bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full font-medium">{prompts.length}</span>
                    </button>
                    {isExpanded && prompts.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-2 mx-2">
                        {prompts.map((prompt) => (
                          <div key={prompt.id}
                            className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/40 hover:border-indigo-400/50 dark:hover:border-indigo-500/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group flex flex-col">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{prompt.title}</span>
                              {prompt.complexity && (
                                <span className={cn("px-2 py-0.5 text-[9px] font-bold rounded-full flex-shrink-0", getComplexityColor(prompt.complexity))}>
                                  {prompt.complexity === "simple" ? "EASY" : prompt.complexity === "medium" ? "MED" : "ADV"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed flex-1 line-clamp-2">
                              {prompt.previewHint || prompt.prompt.slice(0, 80)}
                            </p>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/30">
                              {prompt.isCustom ? (
                                <button onClick={(e) => { e.stopPropagation(); removeCustomPrompt(prompt.id); }}
                                  className="p-1 text-zinc-400 hover:text-red-500 transition-colors rounded"
                                  title="Delete prompt">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : <span />}
                              <button
                                onClick={() => handlePromptClick(prompt)}
                                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors whitespace-nowrap"
                              >
                                Send
                              </button>
                            </div>
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

      // ── AI Team / Helpers popover ────────────────────────────────────────────
      case "helpers":
        return (
          <div className="w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Your AI Team</h2>
              <p className="text-sm text-zinc-500 mt-1">Autonomous agents that review your code in parallel. They work behind the scenes while you build.</p>
            </div>

            {/* Role cards */}
            <div className="px-4 pt-4 pb-2 grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center mb-3">
                  <span className="text-lg">🔍</span>
                </div>
                <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400">Reviewer</h3>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/60 mt-1 leading-relaxed">Finds bugs, security holes, and performance bottlenecks in your code.</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mb-3">
                  <span className="text-lg">⚖️</span>
                </div>
                <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">Judge</h3>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-1 leading-relaxed">Rates your code quality 1-10 and explains exactly why.</p>
              </div>
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center mb-3">
                  <span className="text-lg">💬</span>
                </div>
                <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400">Debater</h3>
                <p className="text-xs text-purple-600/70 dark:text-purple-400/60 mt-1 leading-relaxed">Suggests alternative approaches you might not have considered.</p>
              </div>
            </div>

            <div className="px-4 pb-4">
              <Suspense fallback={<div className="text-xs text-zinc-500 py-4 text-center">Loading...</div>}>
                <AICapabilitiesPanel />
              </Suspense>
              <AIHelpersSection />
            </div>
          </div>
        );

      // ── UI Parts / Components popover ────────────────────────────────────────
      case "components":
        return (
          <div className="w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Ready-Made UI Parts</h2>
              <p className="text-sm text-zinc-500 mt-1">Pre-built components you can drop into your project. Insert as-is, use as a starting point, or tell the AI to customize it.</p>
            </div>
            <Suspense fallback={<div className="text-xs text-zinc-500 py-8 text-center">Loading components...</div>}>
              <ComponentLibrarySection
                onInsertComponent={(code, id) => { onInsertComponent?.(code, id); setActivePopover(null); }}
                onUseAsBase={(code, id) => { onUseComponentAsBase?.(code, id); setActivePopover(null); }}
                onInsertWithAI={(code, id, mods) => { onInsertComponentWithAI?.(code, id, mods); setActivePopover(null); }}
                collapsed={false}
                onToggleCollapse={() => {}}
              />
            </Suspense>
          </div>
        );

      // ── AI Router / Flow popover ───────────────────────────────────────────
      case "router":
        return (
          <div className="w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">AI Router</h2>
              <p className="text-sm text-zinc-500 mt-1">Shows which AI model is handling your requests and how the system routes between local and cloud models.</p>
            </div>
            <div className="p-4 space-y-4">
              <Suspense fallback={<div className="text-xs text-zinc-500 py-4 text-center">Loading...</div>}>
                <RouterStatus />
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                  <p className="text-xs uppercase tracking-wider font-bold text-zinc-500 mb-3">Capability Flow</p>
                  <DependencyGraph compact />
                </div>
              </Suspense>
            </div>
          </div>
        );

      // ── Activity / Changes popover ─────────────────────────────────────────
      case "changes":
        return (
          <div className="w-[560px] flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Session Activity</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Files created and modified during this session. Click to jump to the change in chat.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                  {changes.length} changes
                </span>
                <button onClick={clearChanges}
                  className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg transition-colors" title="Clear history">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {changes.map((change) => (
                <button key={change.id} onClick={() => { onScrollToMessage?.(change.messageId); setActivePopover(null); }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                  <div className="flex items-center gap-3">
                    {change.status === "applied"
                      ? (change.action === "created"
                        ? <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><FilePlus className="h-4 w-4 text-emerald-500" /></div>
                        : <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0"><FileEdit className="h-4 w-4 text-blue-500" /></div>)
                      : <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0"><FileX className="h-4 w-4 text-red-400" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-semibold truncate",
                          change.status === "rejected" ? "text-zinc-400 line-through" : "text-zinc-800 dark:text-zinc-200"
                        )}>
                          {change.filePath.split("/").pop()}
                        </span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0",
                          change.status === "applied"
                            ? (change.action === "created" ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400")
                            : "bg-red-100 dark:bg-red-500/10 text-red-500"
                        )}>
                          {change.status === "applied" ? change.action : "rejected"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-500 truncate flex-1">{change.summary}</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-600 flex-shrink-0">
                          {new Date(change.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
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
      {/* DESKTOP ONLY — 27" 2560x1440 minimum. No mobile breakpoints. */}
      <div
        ref={toolbarRef}
        className="relative flex-shrink-0 flex flex-row items-center h-14 px-4 bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800"
      >
        {/* CENTER — colored, bigger toolbar items */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {TOOLBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePopover === item.id;
            return (
              <button
                key={item.id}
                onClick={(e) => handleToolbarClick(item.id, e)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border",
                  isActive
                    ? item.active
                    : cn("border-transparent", item.color, item.hover)
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {/* File badge */}
                {item.id === "files" && projectName && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                )}
              </button>
            );
          })}

          {/* Activity badge (collapsed — click to expand popover) */}
          {changes.length > 0 && (
            <button
              onClick={(e) => handleToolbarClick("changes", e)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all",
                activePopover === "changes"
                  ? "bg-orange-500/20 text-orange-600 dark:text-orange-300 ring-1 ring-orange-400/50"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-orange-500/10 hover:text-orange-500"
              )}
              title={`${changes.length} changes this session`}
            >
              <History className="h-3.5 w-3.5" />
              <span>{changes.length}</span>
            </button>
          )}
        </div>

      </div>

      {/* Fixed-position popover overlay */}
      {activePopover && popoverRect && (
        <div
          id="builder-toolbar-popover"
          className="fixed z-[200] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: Math.min(popoverRect.left, window.innerWidth - 1150),
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

      {/* Projects Hub is now in ProjectCommandCenter (rendered by BuilderPage) */}

      {/* ─── Toast notifications ──────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-sm",
              t.type === "success" && "bg-emerald-950 border-emerald-700/50 text-emerald-200",
              t.type === "error"   && "bg-red-950 border-red-700/50 text-red-200",
              t.type === "warning" && "bg-amber-950 border-amber-700/50 text-amber-200",
              t.type === "info"    && "bg-zinc-900 border-zinc-700 text-zinc-200"
            )}
          >
            <span className="flex-shrink-0 text-base leading-none mt-0.5">
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : t.type === "warning" ? "⚠" : "ℹ"}
            </span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

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
