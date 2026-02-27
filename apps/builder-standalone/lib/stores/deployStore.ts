import { create } from "zustand";

interface DeployState {
  projectName: string;
  githubUrl: string | null;
  vercelUrl: string | null;
  netlifyUrl: string | null;
  isDeploying: boolean;
  lastPush: string | null;
  error: string | null;

  initProject: (name: string, projectPath: string) => Promise<void>;
  pushProject: (projectPath: string) => Promise<void>;
  exportZip: (projectPath: string) => Promise<string | null>;
  reset: () => void;
}

export const useDeployStore = create<DeployState>()((set) => ({
  projectName: "",
  githubUrl: null,
  vercelUrl: null,
  netlifyUrl: null,
  isDeploying: false,
  lastPush: null,
  error: null,

  initProject: async (name, projectPath) => {
    set({ isDeploying: true, error: null, projectName: name });
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
        vercelUrl: data.vercelUrl || null,
        netlifyUrl: data.netlifyUrl || null,
      });
    } catch (err: any) {
      set({ isDeploying: false, error: err.message || "Network error" });
    }
  },

  pushProject: async (projectPath) => {
    set({ isDeploying: true, error: null });
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", projectPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isDeploying: false, error: data.error || "Push failed" });
        return;
      }
      set({
        isDeploying: false,
        lastPush: data.commitHash || new Date().toISOString(),
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
      projectName: "",
      githubUrl: null,
      vercelUrl: null,
      netlifyUrl: null,
      isDeploying: false,
      lastPush: null,
      error: null,
    }),
}));
