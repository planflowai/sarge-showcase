import { create } from "zustand";

interface PushResult {
  success: boolean;
  commitHash: string;
  message: string;          // "Pushed successfully" or "No changes to commit"
  timestamp: string;        // ISO string
}

interface DeployState {
  currentProjectPath: string | null;  // Track which project this state belongs to
  projectName: string;
  githubUrl: string | null;
  cloudflareUrl: string | null;
  vercelUrl: string | null;
  netlifyUrl: string | null;
  isDeploying: boolean;
  isDetecting: boolean;
  lastPush: PushResult | null;
  error: string | null;

  detectProject: (projectPath: string) => Promise<void>;
  initProject: (name: string, projectPath: string) => Promise<void>;
  pushProject: (projectPath: string, projectName: string) => Promise<void>;
  exportZip: (projectPath: string) => Promise<string | null>;
  reset: () => void;
}

export const useDeployStore = create<DeployState>()((set, get) => ({
  currentProjectPath: null,
  projectName: "",
  githubUrl: null,
  cloudflareUrl: null,
  vercelUrl: null,
  netlifyUrl: null,
  isDeploying: false,
  isDetecting: false,
  lastPush: null,
  error: null,

  detectProject: async (projectPath) => {
    // If switching projects, reset all state first
    const current = get().currentProjectPath;
    if (current && current !== projectPath) {
      set({
        currentProjectPath: projectPath,
        projectName: "",
        githubUrl: null,
        cloudflareUrl: null,
        vercelUrl: null,
        netlifyUrl: null,
        lastPush: null,
        error: null,
        isDetecting: true,
      });
    } else {
      set({ currentProjectPath: projectPath, isDetecting: true });
    }

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detect", projectPath }),
      });
      const data = await res.json();
      // Only apply if still on the same project (user might have switched again)
      if (get().currentProjectPath !== projectPath) return;
      if (res.ok && data.success) {
        set({
          isDetecting: false,
          githubUrl: data.githubUrl || null,
          cloudflareUrl: data.cloudflareUrl || null,
          vercelUrl: data.vercelUrl || null,
          netlifyUrl: data.netlifyUrl || null,
        });
      } else {
        set({ isDetecting: false });
      }
    } catch {
      if (get().currentProjectPath === projectPath) {
        set({ isDetecting: false });
      }
    }
  },

  initProject: async (name, projectPath) => {
    set({ isDeploying: true, error: null, projectName: name, currentProjectPath: projectPath });
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init", projectName: name, projectPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isDeploying: false, error: data.error || "Init failed" });
        return;
      }
      set({
        isDeploying: false,
        githubUrl: data.githubUrl || null,
        cloudflareUrl: data.cloudflareUrl || null,
        vercelUrl: data.vercelUrl || null,
        netlifyUrl: data.netlifyUrl || null,
      });
    } catch (err: any) {
      set({ isDeploying: false, error: err.message || "Network error" });
    }
  },

  pushProject: async (projectPath, projectName) => {
    // Guard: don't push if store is tracking a different project
    const current = get().currentProjectPath;
    if (current && current !== projectPath) {
      set({ error: "Project mismatch — reopen the deploy tab" });
      return;
    }
    set({ isDeploying: true, error: null });
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", projectPath, projectName }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isDeploying: false, error: data.error || "Push failed" });
        return;
      }
      const noChanges = data.message === "No changes to commit";
      set({
        isDeploying: false,
        lastPush: {
          success: true,
          commitHash: data.commitHash || "",
          message: noChanges ? "No changes to push" : "Pushed successfully",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      set({ isDeploying: false, error: err.message || "Network error" });
    }
  },

  exportZip: async (projectPath) => {
    set({ isDeploying: true, error: null });
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", projectPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isDeploying: false, error: data.error || "Export failed" });
        return null;
      }
      set({ isDeploying: false });
      return data.zipPath || null;
    } catch (err: any) {
      set({ isDeploying: false, error: err.message || "Network error" });
      return null;
    }
  },

  reset: () =>
    set({
      currentProjectPath: null,
      projectName: "",
      githubUrl: null,
      cloudflareUrl: null,
      vercelUrl: null,
      netlifyUrl: null,
      isDeploying: false,
      isDetecting: false,
      lastPush: null,
      error: null,
    }),
}));
