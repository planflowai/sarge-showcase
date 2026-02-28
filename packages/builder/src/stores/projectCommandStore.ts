/**
 * Project Command Center Store
 *
 * State for the full-screen project dashboard overlay.
 * Not persisted — transient UI state that resets when closed.
 */

import { create } from "zustand";

export type DeployTarget = "github" | "vercel" | "netlify" | "cloudflare";

export interface HubProjectExtended {
  name: string;
  path: string;
  fileCount: number;
  hasGit: boolean;
  githubRepo: string | null;
  mainFile: string | null;
  lastModified: string;
  // Deploy URLs (null = not connected)
  githubUrl: string | null;
  vercelUrl: string | null;
  netlifyUrl: string | null;
  cloudflareUrl: string | null;
}

interface ProjectCommandState {
  isOpen: boolean;
  view: "grid" | "new";
  projects: HubProjectExtended[];
  isLoading: boolean;
  baseDir: string;
  searchQuery: string;
  sortBy: "name" | "lastModified" | "fileCount";
  sortDir: "asc" | "desc";

  // Rename
  renamingProject: HubProjectExtended | null;
  renameValue: string;
  isRenaming: boolean;

  // Delete
  deleteConfirm: HubProjectExtended | null;
  deleteGithub: boolean;
  isDeleting: boolean;

  // Push (inline from command center)
  pushingProject: HubProjectExtended | null;
  pushTargets: DeployTarget[];
  isPushing: boolean;

  // Actions
  open: (view?: "grid" | "new") => void;
  close: () => void;
  loadProjects: () => Promise<void>;
  setView: (v: "grid" | "new") => void;
  setSearchQuery: (q: string) => void;
  setSortBy: (sort: "name" | "lastModified" | "fileCount") => void;
  toggleSortDir: () => void;

  // CRUD actions
  renameProject: (project: HubProjectExtended, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  deleteProject: (project: HubProjectExtended, withGithub: boolean) => Promise<{ success: boolean; message?: string; error?: string }>;
  pushProject: (project: HubProjectExtended, targets: DeployTarget[]) => Promise<{ success: boolean; deployResults?: Record<string, string>; error?: string }>;

  // UI state setters
  setRenamingProject: (p: HubProjectExtended | null) => void;
  setRenameValue: (v: string) => void;
  setDeleteConfirm: (p: HubProjectExtended | null) => void;
  setDeleteGithub: (v: boolean) => void;
  setPushingProject: (p: HubProjectExtended | null) => void;
  setPushTargets: (targets: DeployTarget[]) => void;
  togglePushTarget: (target: DeployTarget) => void;
}

export const useProjectCommandStore = create<ProjectCommandState>((set, get) => ({
  isOpen: false,
  view: "grid",
  projects: [],
  isLoading: false,
  baseDir: "",
  searchQuery: "",
  sortBy: "lastModified",
  sortDir: "desc",

  renamingProject: null,
  renameValue: "",
  isRenaming: false,

  deleteConfirm: null,
  deleteGithub: false,
  isDeleting: false,

  pushingProject: null,
  pushTargets: ["github"],
  isPushing: false,

  open: (view = "grid") => {
    set({ isOpen: true, view, searchQuery: "", deleteConfirm: null, renamingProject: null, pushingProject: null });
    get().loadProjects();
  },

  close: () => {
    set({ isOpen: false, deleteConfirm: null, renamingProject: null, pushingProject: null });
  },

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/builder/list-projects");
      const data = await res.json();
      if (data.success) {
        set({ projects: data.projects, baseDir: data.baseDir });
      }
    } catch {
      // silent
    } finally {
      set({ isLoading: false });
    }
  },

  setView: (v) => set({ view: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSortBy: (sort) => set({ sortBy: sort }),
  toggleSortDir: () => set((s) => ({ sortDir: s.sortDir === "asc" ? "desc" : "asc" })),

  // ─── Rename ────────────────────────────────────────────────────────────────
  setRenamingProject: (p) => set({ renamingProject: p, renameValue: p?.name || "" }),
  setRenameValue: (v) => set({ renameValue: v }),

  renameProject: async (project, newName) => {
    set({ isRenaming: true });
    try {
      const res = await fetch("/api/builder/rename-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: project.path, newName }),
      });
      const data = await res.json();
      if (data.success) {
        // Update project in list
        set((s) => ({
          projects: s.projects.map((p) =>
            p.path === project.path ? { ...p, name: data.newName, path: data.newPath } : p
          ),
          renamingProject: null,
        }));
        return { success: true, newPath: data.newPath };
      }
      return { success: false, error: data.error || "Failed to rename" };
    } catch {
      return { success: false, error: "Failed to rename project" };
    } finally {
      set({ isRenaming: false });
    }
  },

  // ─── Delete ────────────────────────────────────────────────────────────────
  setDeleteConfirm: (p) => set({ deleteConfirm: p, deleteGithub: false }),
  setDeleteGithub: (v) => set({ deleteGithub: v }),

  deleteProject: async (project, withGithub) => {
    set({ isDeleting: true });
    try {
      const res = await fetch("/api/builder/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: project.path, deleteGithub: withGithub }),
      });
      const data = await res.json();
      if (data.success) {
        set((s) => ({
          projects: s.projects.filter((p) => p.path !== project.path),
          deleteConfirm: null,
        }));
        let msg = `"${project.name}" deleted`;
        if (withGithub) {
          msg += data.github?.deleted
            ? " + GitHub repo removed"
            : ` (folder deleted; GitHub: ${data.github?.error || "not deleted"})`;
        }
        return { success: true, message: msg };
      }
      return { success: false, error: data.error || "Failed to delete" };
    } catch {
      return { success: false, error: "Failed to delete project" };
    } finally {
      set({ isDeleting: false });
    }
  },

  // ─── Push ──────────────────────────────────────────────────────────────────
  setPushingProject: (p) => {
    if (p) {
      // Pre-select connected targets
      const targets: DeployTarget[] = ["github"];
      if (p.vercelUrl) targets.push("vercel");
      if (p.netlifyUrl) targets.push("netlify");
      if (p.cloudflareUrl) targets.push("cloudflare");
      set({ pushingProject: p, pushTargets: targets });
    } else {
      set({ pushingProject: null, pushTargets: ["github"] });
    }
  },
  setPushTargets: (targets) => set({ pushTargets: targets }),
  togglePushTarget: (target) => {
    if (target === "github") return; // always on
    set((s) => ({
      pushTargets: s.pushTargets.includes(target)
        ? s.pushTargets.filter((t) => t !== target)
        : [...s.pushTargets, target],
    }));
  },

  pushProject: async (project, targets) => {
    set({ isPushing: true });
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", projectPath: project.path, projectName: project.name, targets }),
      });
      const data = await res.json();
      if (data.success) {
        set({ pushingProject: null });
        return { success: true, deployResults: data.deployResults };
      }
      return { success: false, error: data.error || "Push failed" };
    } catch {
      return { success: false, error: "Push failed" };
    } finally {
      set({ isPushing: false });
    }
  },
}));
