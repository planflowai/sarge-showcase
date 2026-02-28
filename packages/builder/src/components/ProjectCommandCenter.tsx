"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  X, Plus, Search, FolderOpen, Loader2, Trash2, Check, RefreshCw,
  Send, ExternalLink, MoreHorizontal, Pencil, Download,
  ArrowUpDown, Github, Globe, Cloud, ChevronDown,
} from "lucide-react";
import { useProjectCommandStore, type HubProjectExtended, type DeployTarget } from "../stores/projectCommandStore";
import { useBuilderStore } from "../stores/builderStore";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "../lib/projectTemplates";
import { cn } from "@sarge/core";
import { useUIStore } from "@sarge/core";

// ─── Platform config ─────────────────────────────────────────────────────────

const PLATFORMS: { id: DeployTarget; label: string; icon: typeof Github; color: string; bgClass: string }[] = [
  { id: "github", label: "GitHub", icon: Github, color: "text-zinc-300", bgClass: "bg-zinc-700" },
  { id: "vercel", label: "Vercel", icon: Globe, color: "text-zinc-300", bgClass: "bg-zinc-700" },
  { id: "netlify", label: "Netlify", icon: Globe, color: "text-teal-400", bgClass: "bg-teal-900/40" },
  { id: "cloudflare", label: "Cloudflare", icon: Cloud, color: "text-orange-400", bgClass: "bg-orange-900/40" },
];

function getUrl(p: HubProjectExtended, id: DeployTarget): string | null {
  if (id === "github") return p.githubUrl;
  if (id === "vercel") return p.vercelUrl;
  if (id === "netlify") return p.netlifyUrl;
  if (id === "cloudflare") return p.cloudflareUrl;
  return null;
}

// ─── Project Card ────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onOpen,
}: {
  project: HubProjectExtended;
  onOpen: (p: HubProjectExtended) => void;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const {
    renamingProject, renameValue, isRenaming,
    setRenamingProject, setRenameValue, renameProject,
    deleteConfirm, deleteGithub, isDeleting,
    setDeleteConfirm, setDeleteGithub, deleteProject,
    pushingProject, pushTargets, isPushing,
    setPushingProject, togglePushTarget, pushProject,
  } = useProjectCommandStore();

  const isRenameTarget = renamingProject?.path === project.path;
  const isDeleteTarget = deleteConfirm?.path === project.path;
  const isPushTarget = pushingProject?.path === project.path;
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Focus rename input
  useEffect(() => {
    if (isRenameTarget && renameRef.current) renameRef.current.focus();
  }, [isRenameTarget]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === project.name) { setRenamingProject(null); return; }
    const result = await renameProject(project, trimmed);
    if (result.success) {
      showToast({ message: `Renamed to "${trimmed}"`, type: "success" });
    } else {
      showToast({ message: result.error || "Rename failed", type: "error" });
    }
  };

  const handleDelete = async () => {
    const result = await deleteProject(project, deleteGithub);
    if (result.success) {
      showToast({ message: result.message || "Deleted", type: "success" });
    } else {
      showToast({ message: result.error || "Delete failed", type: "error" });
    }
  };

  const handlePush = async () => {
    const result = await pushProject(project, pushTargets);
    if (result.success) {
      const dr = result.deployResults || {};
      const ok = Object.entries(dr).filter(([, v]) => v === "success").map(([k]) => k);
      const msg = ok.length > 0 ? `Pushed to ${ok.join(", ")}` : "Push complete";
      showToast({ message: msg, type: "success" });
    } else {
      showToast({ message: result.error || "Push failed", type: "error" });
    }
  };

  const handleExport = async () => {
    setShowMenu(false);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", projectPath: project.path }),
      });
      const data = await res.json();
      if (data.success) {
        showToast({ message: `ZIP exported (${data.fileCount} files)`, type: "success" });
      } else {
        showToast({ message: data.error || "Export failed", type: "error" });
      }
    } catch {
      showToast({ message: "Export failed", type: "error" });
    }
  };

  // ─── Delete confirmation view ──────────────────────────────────────────────
  if (isDeleteTarget) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-6 flex flex-col gap-4">
        <p className="text-base font-bold text-red-300">Delete &quot;{project.name}&quot;?</p>
        <p className="text-sm text-zinc-400">
          The local folder will be permanently removed. This cannot be undone.
        </p>
        {project.githubRepo && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deleteGithub}
              onChange={(e) => setDeleteGithub(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 accent-red-500"
            />
            <span className="text-xs text-zinc-300">
              Also delete GitHub repo: <span className="font-mono text-zinc-400">{project.githubRepo}</span>
            </span>
          </label>
        )}
        <div className="flex gap-2 mt-1">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5"
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
          <button
            onClick={() => setDeleteConfirm(null)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── Push target picker view ───────────────────────────────────────────────
  if (isPushTarget) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-6 flex flex-col gap-4">
        <p className="text-base font-bold text-emerald-300">Push &quot;{project.name}&quot;</p>
        <div className="space-y-1.5">
          {PLATFORMS.map(({ id, label, icon: Icon }) => {
            const url = getUrl(project, id);
            const isConnected = !!url;
            const isSelected = pushTargets.includes(id);
            const isGh = id === "github";
            return (
              <button
                key={id}
                onClick={() => togglePushTarget(id)}
                disabled={isGh}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors",
                  isSelected ? "bg-emerald-900/30 border border-emerald-700" : "bg-zinc-800/50 border border-zinc-700",
                  !isConnected && !isGh && "opacity-40 cursor-not-allowed",
                  isGh && "cursor-default"
                )}
              >
                <div className={cn("w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0",
                  isSelected ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"
                )}>
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <Icon className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                <span className="font-semibold text-zinc-200">{label}</span>
                <span className="ml-auto text-[9px] text-zinc-500">
                  {isConnected ? "connected" : "not linked"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-1">
          <button
            onClick={handlePush}
            disabled={isPushing || pushTargets.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5"
          >
            {isPushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Push to {pushTargets.length}
          </button>
          <button
            onClick={() => setPushingProject(null)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── Normal card view ──────────────────────────────────────────────────────
  return (
    <div className="group relative rounded-2xl border border-zinc-700/80 bg-zinc-800/60 hover:border-zinc-600 hover:bg-zinc-800/90 transition-all p-6 flex flex-col gap-4">
      {/* Name row */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
          <FolderOpen className="h-7 w-7 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          {isRenameTarget ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenamingProject(null);
              }}
              onBlur={handleRename}
              disabled={isRenaming}
              className="w-full px-3 py-1.5 text-base font-bold rounded-lg bg-zinc-700 border border-indigo-500 text-zinc-100 focus:outline-none"
            />
          ) : (
            <p className="text-base font-bold text-zinc-100 truncate">{project.name}</p>
          )}
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            <span className="text-xs text-zinc-500">
              {new Date(project.lastModified).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span className="text-xs text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">{project.fileCount} files</span>
            {project.mainFile && (
              <>
                <span className="text-xs text-zinc-700">·</span>
                <span className="text-xs text-zinc-500 font-mono">{project.mainFile}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* All 4 platforms — always visible */}
      <div className="grid grid-cols-2 gap-2">
        {PLATFORMS.map(({ id, label, icon: Icon }) => {
          const url = getUrl(project, id);
          const isConnected = !!url;
          return (
            <div
              key={id}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors",
                isConnected
                  ? "bg-emerald-950/30 border-emerald-800/50"
                  : "bg-zinc-800/40 border-zinc-700/50"
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", isConnected ? "text-emerald-400" : "text-zinc-600")} />
              <div className="flex-1 min-w-0">
                <span className={cn("text-xs font-bold", isConnected ? "text-zinc-200" : "text-zinc-500")}>{label}</span>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] text-indigo-400 hover:underline truncate"
                  >
                    {url.replace(/https?:\/\/(www\.)?/, "").slice(0, 40)}
                  </a>
                )}
              </div>
              {isConnected ? (
                <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5 mt-auto pt-1">
        <button
          onClick={() => onOpen(project)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          <FolderOpen className="h-4 w-4" />
          Open
        </button>
        {project.hasGit && (
          <button
            onClick={() => setPushingProject(project)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-emerald-600/80 hover:bg-emerald-500 text-white transition-colors"
          >
            <Send className="h-4 w-4" />
            Push
          </button>
        )}

        {/* ··· menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
              <button
                onClick={() => { setShowMenu(false); setRenamingProject(project); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                <Pencil className="h-4 w-4" /> Rename
              </button>
              <button
                onClick={handleExport}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                <Download className="h-4 w-4" /> Export ZIP
              </button>
              <div className="my-1 border-t border-zinc-700" />
              <button
                onClick={() => { setShowMenu(false); setDeleteConfirm(project); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProjectCommandCenter() {
  const showToast = useUIStore((s) => s.showToast);
  const {
    isOpen, view, projects, isLoading, baseDir,
    searchQuery, sortBy, sortDir,
    close, loadProjects, setView,
    setSearchQuery, setSortBy, toggleSortDir,
  } = useProjectCommandStore();

  const setProject = useBuilderStore((s) => s.setProject);
  const projectPath = useBuilderStore((s) => s.projectPath);
  const clearProject = useBuilderStore((s) => s.clearProject);

  // New project form state (local to this component)
  const [newName, setNewName] = useState("");
  const [newTemplateId, setNewTemplateId] = useState("blank-html");
  const [isCreating, setIsCreating] = useState(false);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // Reset new project form when switching to new view
  useEffect(() => {
    if (view === "new") { setNewName(""); setNewTemplateId("blank-html"); }
  }, [view]);

  // ─── Filtered + sorted projects ─────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    let list = projects;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return dir * a.name.localeCompare(b.name);
      if (sortBy === "fileCount") return dir * (a.fileCount - b.fileCount);
      return dir * (new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime());
    });
    return list;
  }, [projects, searchQuery, sortBy, sortDir]);

  // ─── Open project handler ───────────────────────────────────────────────
  const handleOpen = useCallback(async (proj: HubProjectExtended) => {
    try {
      const res = await fetch("/api/builder/list-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: proj.path }),
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.projectPath, data.projectName, data.tree);
        close();
        showToast({ message: `Loaded "${proj.name}"`, type: "success" });
      } else {
        showToast({ message: data.error || "Failed to open", type: "error" });
      }
    } catch {
      showToast({ message: "Failed to open project", type: "error" });
    }
  }, [setProject, close, showToast]);

  // ─── Create project handler ─────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    if (/[/\\:*?"<>|]/.test(name)) {
      showToast({ message: "Invalid characters in project name", type: "error" });
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/builder/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: newTemplateId,
          projectPath: `${baseDir}/${name}`,
          projectName: name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Load the new project
        const dirRes = await fetch("/api/builder/list-directory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: data.projectPath }),
        });
        const dirData = await dirRes.json();
        if (dirData.success) {
          setProject(dirData.projectPath, dirData.projectName, dirData.tree);
        }
        close();
        showToast({ message: `Created "${name}"`, type: "success" });
      } else {
        showToast({ message: data.error || "Failed to create project", type: "error" });
      }
    } catch {
      showToast({ message: "Failed to create project", type: "error" });
    } finally {
      setIsCreating(false);
    }
  }, [newName, newTemplateId, baseDir, setProject, close, showToast]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 w-[1400px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">

        {/* ═══ Header ═══ */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xl">🚀</span>
            <div>
              <h2 className="text-lg font-bold text-white">Project Command Center</h2>
              <p className="text-[10px] text-zinc-500 font-mono truncate">{baseDir}</p>
            </div>
          </div>

          {/* Search (only on grid view) */}
          {view === "grid" && (
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <button
            onClick={close}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ═══ Tabs + sort controls ═══ */}
        <div className="px-6 pt-3 flex items-center gap-2 flex-shrink-0 border-b border-zinc-800 pb-0">
          <button
            onClick={() => { setView("grid"); loadProjects(); }}
            className={cn(
              "px-4 py-2 rounded-t-lg text-sm font-semibold transition-all border-b-2 -mb-px",
              view === "grid"
                ? "border-indigo-500 text-indigo-300 bg-indigo-500/10"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            <FolderOpen className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            My Projects
            {!isLoading && projects.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-zinc-700 text-zinc-400 rounded-full">{projects.length}</span>
            )}
          </button>
          <button
            onClick={() => setView("new")}
            className={cn(
              "px-4 py-2 rounded-t-lg text-sm font-semibold transition-all border-b-2 -mb-px",
              view === "new"
                ? "border-emerald-500 text-emerald-300 bg-emerald-500/10"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Plus className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            New Project
          </button>

          {/* Sort controls (grid only) */}
          {view === "grid" && (
            <div className="ml-auto flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-[10px] bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-400 focus:outline-none cursor-pointer"
              >
                <option value="lastModified">Last Modified</option>
                <option value="name">Name</option>
                <option value="fileCount">Files</option>
              </select>
              <button
                onClick={toggleSortDir}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title={sortDir === "asc" ? "Ascending" : "Descending"}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={loadProjects}
                disabled={isLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
              </button>
            </div>
          )}
        </div>

        {/* ═══ Content ═══ */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Grid view ── */}
          {view === "grid" && (
            <>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
                  <p className="text-sm text-zinc-500">Loading projects...</p>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FolderOpen className="h-14 w-14 text-zinc-700 mb-4" />
                  {searchQuery ? (
                    <>
                      <p className="text-zinc-400 font-semibold">No projects match &quot;{searchQuery}&quot;</p>
                      <button onClick={() => setSearchQuery("")} className="mt-3 text-sm text-indigo-400 hover:text-indigo-300">Clear search</button>
                    </>
                  ) : (
                    <>
                      <p className="text-zinc-400 font-semibold">No projects yet</p>
                      <p className="text-sm text-zinc-600 mt-1">Create your first project to get started</p>
                      <button
                        onClick={() => setView("new")}
                        className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                      >
                        <Plus className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                        Create a Project
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredProjects.map((proj) => (
                    <ProjectCard key={proj.path} project={proj} onOpen={handleOpen} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── New project view ── */}
          {view === "new" && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Name input */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-zinc-500 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  placeholder="e.g. my-portfolio-site"
                  className="w-full px-3 py-2.5 text-sm rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  autoFocus
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Will be created at:{" "}
                  <span className="text-zinc-400 font-mono">{baseDir}/{newName.trim() || "<name>"}</span>
                </p>
              </div>

              {/* Template picker */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-zinc-500 mb-2">
                  Starter Template
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PROJECT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setNewTemplateId(t.id)}
                      className={cn(
                        "flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all text-left",
                        newTemplateId === t.id
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
                onClick={handleCreate}
                disabled={!newName.trim() || isCreating}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {isCreating ? (
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
  );
}
