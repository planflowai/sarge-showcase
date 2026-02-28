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

  // ─── Projects Hub modal (replaces separate Open + New modals) ───────────────
  const [showProjectsHub, setShowProjectsHub] = useState(false);
  const [projectsHubView, setProjectsHubView] = useState<"list" | "new">("list");

  // Projects list state
  interface HubProject { name: string; path: string; fileCount: number; hasGit: boolean; githubRepo: string | null; mainFile: string | null; lastModified: string; }
  const [hubProjects, setHubProjects] = useState<HubProject[]>([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubBaseDir, setHubBaseDir] = useState("L:\\AI_MASTER_BUILDS");

  // New project form
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTemplateId, setNewProjectTemplateId] = useState("blank-html");
  const [isCreatingProjectHub, setIsCreatingProjectHub] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<HubProject | null>(null);
  const [deleteGithub, setDeleteGithubFlag] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        setShowProjectsHub(false);
        setDeleteConfirm(null);
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

  // Quick-access: open Projects Hub
  const handleNewProjectQuick = () => openProjectsHub("new");
  const handleOpenProjectQuick = () => openProjectsHub("list");

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

  // ─── Projects Hub handlers ───────────────────────────────────────────────────

  const loadHubProjects = useCallback(async () => {
    setHubLoading(true);
    try {
      const res = await fetch("/api/builder/list-projects");
      const data = await res.json();
      if (data.success) {
        setHubProjects(data.projects);
        setHubBaseDir(data.baseDir);
      } else {
        showToast(data.error || "Failed to load projects", "error");
      }
    } catch {
      showToast("Could not reach server", "error");
    } finally {
      setHubLoading(false);
    }
  }, [showToast]);

  const openProjectsHub = useCallback((view: "list" | "new" = "list") => {
    setProjectsHubView(view);
    setNewProjectName("");
    setNewProjectTemplateId("blank-html");
    setDeleteConfirm(null);
    setShowProjectsHub(true);
    setActivePopover(null);
    if (view === "list") loadHubProjects();
  }, [loadHubProjects]);

  // Custom events — let BuilderPage toolbar buttons trigger Projects Hub
  useEffect(() => {
    const openHandler = () => openProjectsHub("list");
    const newHandler = () => openProjectsHub("new");
    window.addEventListener("builder:open-project", openHandler);
    window.addEventListener("builder:new-project", newHandler);
    return () => {
      window.removeEventListener("builder:open-project", openHandler);
      window.removeEventListener("builder:new-project", newHandler);
    };
  }, [openProjectsHub]);

  const handleCreateProjectHub = useCallback(async () => {
    const name = newProjectName.trim();
    if (!name) { showToast("Enter a project name", "warning"); return; }
    // Sanitize: no slashes, no dots at start
    if (/[/\\:*?"<>|]/.test(name)) { showToast("Project name contains invalid characters", "error"); return; }

    setIsCreatingProjectHub(true);
    try {
      const res = await fetch("/api/builder/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: newProjectTemplateId,
          projectPath: `${hubBaseDir}/${name}`,
          projectName: name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.projectPath, data.projectName, []);
        addToRecents(data.projectPath);
        setShowProjectsHub(false);
        showToast(`Project "${data.projectName}" created`, "success");
        // Reload the file tree
        await handleOpenProject(data.projectPath);
      } else {
        showToast(data.error || "Failed to create project", "error");
      }
    } catch {
      showToast("Failed to create project", "error");
    } finally {
      setIsCreatingProjectHub(false);
    }
  }, [newProjectName, newProjectTemplateId, hubBaseDir, setProject, addToRecents, handleOpenProject, showToast]);

  const handleLoadProject = useCallback(async (proj: HubProject) => {
    try {
      const res = await fetch("/api/builder/list-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: proj.path }),
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.projectPath, data.projectName, data.tree);
        addToRecents(proj.path);
        setShowProjectsHub(false);
        showToast(`Loaded "${proj.name}"`, "success");
      } else {
        showToast(data.error || "Failed to open project", "error");
      }
    } catch {
      showToast("Failed to open project", "error");
    }
  }, [setProject, addToRecents, showToast]);

  const handleDeleteProject = useCallback(async (proj: HubProject, withGithub: boolean) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/builder/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: proj.path, deleteGithub: withGithub }),
      });
      const data = await res.json();
      if (data.success) {
        setHubProjects(prev => prev.filter(p => p.path !== proj.path));
        setDeleteConfirm(null);
        // Clear project if it was the active one
        if (projectPath === proj.path) clearProject();
        let msg = `"${proj.name}" deleted`;
        if (withGithub) {
          msg += data.github?.deleted
            ? " + GitHub repo removed"
            : ` (folder deleted; GitHub: ${data.github?.error || "not deleted"})`;
        }
        showToast(msg, data.github?.error && withGithub ? "warning" : "success");
      } else {
        showToast(data.error || "Failed to delete project", "error");
      }
    } catch {
      showToast("Failed to delete project", "error");
    } finally {
      setIsDeleting(false);
    }
  }, [projectPath, clearProject, showToast]);

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
          <div className="w-72 flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">File Explorer</span>
              {projectPath && (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setShowPathInput(!showPathInput)} title="Open project"
                    className="p-1 text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 rounded transition-colors">
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
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
                  {/* Inline path input for switching projects */}
                  {showPathInput && (
                    <div className="space-y-1.5 p-1 mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                      <input
                        type="text"
                        value={pathInput}
                        onChange={(e) => setPathInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && pathInput.trim()) handleOpenProject(pathInput);
                          if (e.key === "Escape") setShowPathInput(false);
                        }}
                        placeholder="Enter folder path…"
                        className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleOpenProject(pathInput)}
                          disabled={!pathInput.trim() || isLoading}
                          className="flex-1 h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white">
                          {isLoading ? "Loading…" : "Open"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowPathInput(false)}
                          className="h-6 text-[10px]">Cancel</Button>
                      </div>
                    </div>
                  )}
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
          <div className="w-96 flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Prompt Library</span>
              <button onClick={() => setShowGallery(true)}
                className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors">
                <Grid3X3 className="h-2.5 w-2.5" /> Browse All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {PROMPT_CATEGORIES.map((category) => {
                const prompts = getPromptsByCategory(category.id);
                const isExpanded = expandedCategories.has(category.id);
                if (category.id === "custom" && prompts.length === 0) return null;
                return (
                  <div key={category.id} className="mb-1">
                    {/* Category header */}
                    <button onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                      {isExpanded
                        ? <ChevronDown className="h-2.5 w-2.5 text-zinc-400" />
                        : <ChevronRight className="h-2.5 w-2.5 text-zinc-400" />}
                      <span className="w-5 h-5 flex items-center justify-center rounded text-xs"
                        style={{ backgroundColor: `${category.color}20` }}>{category.icon}</span>
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">{category.name}</span>
                      <span className="text-[9px] text-zinc-400 ml-auto bg-zinc-200 dark:bg-zinc-700 px-1.5 rounded-full">{prompts.length}</span>
                    </button>
                    {isExpanded && prompts.length > 0 && (
                      <div className="space-y-1.5 mt-1 ml-1 mr-1">
                        {prompts.map((prompt) => (
                          <div key={prompt.id}
                            className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/40 hover:border-indigo-400/50 dark:hover:border-indigo-500/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 truncate">{prompt.title}</span>
                                  {prompt.complexity && (
                                    <span className={cn("px-1.5 py-0 text-[7px] font-bold rounded-full flex-shrink-0", getComplexityColor(prompt.complexity))}>
                                      {prompt.complexity === "simple" ? "EASY" : prompt.complexity === "medium" ? "MED" : "ADV"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-zinc-500 line-clamp-2 leading-tight">
                                  {prompt.previewHint || prompt.prompt.slice(0, 90)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                                {prompt.isCustom && (
                                  <button onClick={(e) => { e.stopPropagation(); removeCustomPrompt(prompt.id); }}
                                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors rounded"
                                    title="Delete prompt">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handlePromptClick(prompt)}
                                  className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors whitespace-nowrap"
                                >
                                  Use →
                                </button>
                              </div>
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

      // ── AI Helpers popover ───────────────────────────────────────────────────
      case "helpers":
        return (
          <div className="w-80 max-h-[70vh] overflow-y-auto">
            <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">AI Helpers</span>
              <p className="text-[10px] text-zinc-500 mt-0.5">Autonomous agents that analyze your code in parallel</p>
              <div className="mt-2 space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500 dark:text-blue-400 font-bold flex-shrink-0 mt-0.5">Reviewer</span>
                  <span className="text-[9px] text-zinc-500">Finds bugs, security issues, and performance improvements</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold flex-shrink-0 mt-0.5">Judge</span>
                  <span className="text-[9px] text-zinc-500">Rates code quality 1–10 with detailed reasoning</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex-shrink-0 mt-0.5">Debater</span>
                  <span className="text-[9px] text-zinc-500">Argues for alternative approaches or architecture choices</span>
                </div>
              </div>
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

      {/* ─── Projects Hub Modal ─────────────────────────────────────────────── */}
      {showProjectsHub && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowProjectsHub(false); setDeleteConfirm(null); } }}
        >
          <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 w-[680px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏗️</span>
                <div>
                  <h2 className="text-lg font-bold text-white">Projects Hub</h2>
                  <p className="text-xs text-zinc-500 mt-0.5 font-mono">{hubBaseDir}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowProjectsHub(false); setDeleteConfirm(null); }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="px-6 pt-4 flex gap-2 flex-shrink-0 border-b border-zinc-800 pb-0">
              <button
                onClick={() => { setProjectsHubView("list"); loadHubProjects(); }}
                className={cn(
                  "px-4 py-2 rounded-t-lg text-sm font-semibold transition-all border-b-2 -mb-px",
                  projectsHubView === "list"
                    ? "border-indigo-500 text-indigo-300 bg-indigo-500/10"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                )}
              >
                <FolderOpen className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                My Projects
                {!hubLoading && hubProjects.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-zinc-700 text-zinc-400 rounded-full">{hubProjects.length}</span>
                )}
              </button>
              <button
                onClick={() => setProjectsHubView("new")}
                className={cn(
                  "px-4 py-2 rounded-t-lg text-sm font-semibold transition-all border-b-2 -mb-px",
                  projectsHubView === "new"
                    ? "border-emerald-500 text-emerald-300 bg-emerald-500/10"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                )}
              >
                <Plus className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                New Project
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* ── My Projects list ── */}
              {projectsHubView === "list" && (
                <>
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={loadHubProjects}
                      disabled={hubLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", hubLoading && "animate-spin")} />
                      Refresh
                    </button>
                  </div>

                  {hubLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
                      <p className="text-sm text-zinc-500">Loading projects...</p>
                    </div>
                  ) : hubProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <FolderOpen className="h-12 w-12 text-zinc-700 mb-4" />
                      <p className="text-zinc-400 font-semibold">No projects yet</p>
                      <p className="text-sm text-zinc-600 mt-1">Create your first project using the New Project tab</p>
                      <button
                        onClick={() => setProjectsHubView("new")}
                        className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                      >
                        <Plus className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                        Create a Project
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hubProjects.map((proj) => (
                        <div key={proj.path}>
                          {deleteConfirm?.path === proj.path ? (
                            /* Delete confirmation row */
                            <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-4">
                              <p className="text-sm font-semibold text-red-300 mb-1">Delete &quot;{proj.name}&quot;?</p>
                              <p className="text-xs text-zinc-500 mb-3">
                                The local folder will be permanently removed. This cannot be undone.
                              </p>
                              {proj.githubRepo && (
                                <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={deleteGithub}
                                    onChange={(e) => setDeleteGithubFlag(e.target.checked)}
                                    className="rounded border-zinc-600 bg-zinc-800 accent-red-500"
                                  />
                                  <span className="text-xs text-zinc-300">
                                    Also delete GitHub repo:{" "}
                                    <span className="text-zinc-400 font-mono">{proj.githubRepo}</span>
                                  </span>
                                </label>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteProject(proj, deleteGithub)}
                                  disabled={isDeleting}
                                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5"
                                >
                                  {isDeleting
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />
                                  }
                                  Yes, Delete
                                </button>
                                <button
                                  onClick={() => { setDeleteConfirm(null); setDeleteGithubFlag(false); }}
                                  className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Project card */
                            <div className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-800/40 hover:border-zinc-700 hover:bg-zinc-800/70 transition-all">
                              <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                                <FolderOpen className="h-5 w-5 text-indigo-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-zinc-200 truncate">{proj.name}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-zinc-500">
                                    {new Date(proj.lastModified).toLocaleDateString("en-US", {
                                      month: "short", day: "numeric", year: "numeric",
                                    })}
                                  </span>
                                  <span className="text-[10px] text-zinc-700">·</span>
                                  <span className="text-[10px] text-zinc-500">{proj.fileCount} files</span>
                                  {proj.hasGit && (
                                    <>
                                      <span className="text-[10px] text-zinc-700">·</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">git</span>
                                    </>
                                  )}
                                  {proj.githubRepo && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400">github</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button
                                  onClick={() => handleLoadProject(proj)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                                >
                                  Load
                                </button>
                                <button
                                  onClick={() => { setDeleteConfirm(proj); setDeleteGithubFlag(false); }}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                                  title="Delete project"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── New Project form ── */}
              {projectsHubView === "new" && (
                <div className="space-y-6">
                  {/* Name input */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-zinc-500 mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateProjectHub(); }}
                      placeholder="e.g. my-portfolio-site"
                      className="w-full px-3 py-2.5 text-sm rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                      autoFocus
                    />
                    <p className="text-[11px] text-zinc-500 mt-1.5">
                      Will be created at:{" "}
                      <span className="text-zinc-400 font-mono">
                        {hubBaseDir}\{newProjectName.trim() || "<name>"}
                      </span>
                    </p>
                  </div>

                  {/* Template picker */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-zinc-500 mb-2">
                      Starter Template
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PROJECT_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setNewProjectTemplateId(t.id)}
                          className={cn(
                            "flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all text-left",
                            newProjectTemplateId === t.id
                              ? "border-emerald-500 bg-emerald-900/20"
                              : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800"
                          )}
                        >
                          <span className="text-2xl">{t.icon}</span>
                          <span className="text-xs font-bold text-zinc-200">{t.name}</span>
                          <span className="text-[10px] text-zinc-500 leading-tight">{t.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Create button */}
                  <button
                    onClick={handleCreateProjectHub}
                    disabled={!newProjectName.trim() || isCreatingProjectHub}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                  >
                    {isCreatingProjectHub ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Creating project...</>
                    ) : (
                      <><Plus className="h-4 w-4" /> Create Project</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
