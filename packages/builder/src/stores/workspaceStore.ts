/**
 * Workspace Store - Shared Context for Multi-Window Workspace
 *
 * Uses BroadcastChannel API to sync state across multiple browser windows.
 * All windows (Architect, Builder, Preview) share:
 * - Project context (path, files, log)
 * - Architect's plan/conversation summary
 * - Builder's completed actions
 * - Current preview code
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@sarge/core";
import { useUIStore } from './uiStore';

// Types for shared context
export interface BuildAction {
  id: string;
  timestamp: number;
  action: 'created' | 'modified' | 'deleted';
  filePath: string;
  summary: string;
  model: string;
}

export interface AgentConfig {
  id: string;
  model: string;
  provider: string;
  role: string;
  roleDescription?: string;
  isActive: boolean;
}

export interface WorkspaceState {
  // Workspace status
  isWorkspaceActive: boolean;
  activeWindows: ('architect' | 'builder' | 'preview')[];

  // Project context (shared across all panels)
  projectPath: string | null;
  projectName: string | null;
  projectFiles: string[];
  builderLogContent: string | null;

  // Architect context
  architectPlan: string | null;
  architectLastMessage: string | null;
  architectModel: string | null;
  architectProvider: string | null;

  // Builder context
  builderActions: BuildAction[];
  builderLastSummary: string | null;
  builderModel: string | null;
  builderProvider: string | null;

  // Dynamic agents
  agents: AgentConfig[];

  // Preview context
  previewCode: string;
  previewIsStreaming: boolean;

  // Window positions (remembered for next launch)
  windowPositions: {
    architect?: { x: number; y: number; width: number; height: number };
    builder?: { x: number; y: number; width: number; height: number };
    preview?: { x: number; y: number; width: number; height: number };
  };

  // Hydration
  hydrated: boolean;
}

export interface WorkspaceActions {
  // Hydration
  hydrate: () => void;

  // Workspace lifecycle
  activateWorkspace: () => void;
  deactivateWorkspace: () => void;
  setActiveWindow: (window: 'architect' | 'builder' | 'preview', active: boolean) => void;

  // Project
  setProject: (path: string | null, name: string | null, files?: string[]) => void;
  setBuilderLog: (content: string | null) => void;

  // Architect
  setArchitectPlan: (plan: string | null) => void;
  setArchitectLastMessage: (message: string | null) => void;
  setArchitectModel: (model: string | null, provider: string | null) => void;

  // Builder
  addBuilderAction: (action: Omit<BuildAction, 'id' | 'timestamp'>) => void;
  setBuilderLastSummary: (summary: string | null) => void;
  setBuilderModel: (model: string | null, provider: string | null) => void;
  clearBuilderActions: () => void;

  // Agents
  addAgent: (agent: Omit<AgentConfig, 'id'>) => void;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => void;
  removeAgent: (id: string) => void;

  // Preview
  setPreviewCode: (code: string) => void;
  setPreviewStreaming: (streaming: boolean) => void;

  // Window positions
  setWindowPosition: (window: 'architect' | 'builder' | 'preview', position: { x: number; y: number; width: number; height: number }) => void;

  // Full reset
  resetWorkspace: () => void;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

// BroadcastChannel for cross-window communication
let broadcastChannel: BroadcastChannel | null = null;

const initBroadcastChannel = (set: any, get: any) => {
  if (typeof window === 'undefined') return;

  if (broadcastChannel) {
    broadcastChannel.close();
  }

  broadcastChannel = new BroadcastChannel('sarge-workspace');

  broadcastChannel.onmessage = (event) => {
    const { type, payload } = event.data;

    console.log('[WorkspaceStore] Received broadcast:', type);

    switch (type) {
      case 'SYNC_STATE':
        // Full state sync from another window
        set({ ...payload, hydrated: true });
        break;
      case 'PROJECT_CHANGED':
        set({
          projectPath: payload.projectPath,
          projectName: payload.projectName,
          projectFiles: payload.projectFiles || [],
        });
        break;
      case 'ARCHITECT_PLAN':
        set({ architectPlan: payload.plan });
        break;
      case 'ARCHITECT_MESSAGE':
        set({ architectLastMessage: payload.message });
        break;
      case 'BUILDER_ACTION':
        const currentActions = get().builderActions;
        set({ builderActions: [...currentActions, payload.action] });
        break;
      case 'BUILDER_SUMMARY':
        set({ builderLastSummary: payload.summary });
        break;
      case 'PREVIEW_CODE':
        set({ previewCode: payload.code, previewIsStreaming: payload.isStreaming });
        break;
      case 'AGENT_ADDED':
        const currentAgents = get().agents;
        set({ agents: [...currentAgents, payload.agent] });
        break;
      case 'AGENT_UPDATED':
        set({
          agents: get().agents.map((a: AgentConfig) =>
            a.id === payload.id ? { ...a, ...payload.updates } : a
          )
        });
        break;
      case 'AGENT_REMOVED':
        set({ agents: get().agents.filter((a: AgentConfig) => a.id !== payload.id) });
        break;
      case 'WINDOW_ACTIVE':
        const windows = get().activeWindows;
        if (payload.active && !windows.includes(payload.window)) {
          set({ activeWindows: [...windows, payload.window] });
        } else if (!payload.active) {
          set({ activeWindows: windows.filter((w: string) => w !== payload.window) });
        }
        break;
      case 'WORKSPACE_RESET':
        set(getInitialState());
        break;
    }
  };
};

// Broadcast helper
const broadcast = (type: string, payload: any) => {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, payload });
    } catch (e) {
      console.error('[WorkspaceStore] Broadcast error:', e);
    }
  }
};

// Helper to extract only serializable state (no functions)
const getSerializableState = (state: any): WorkspaceState => ({
  isWorkspaceActive: state.isWorkspaceActive,
  activeWindows: state.activeWindows,
  projectPath: state.projectPath,
  projectName: state.projectName,
  projectFiles: state.projectFiles,
  builderLogContent: state.builderLogContent,
  architectPlan: state.architectPlan,
  architectLastMessage: state.architectLastMessage,
  architectModel: state.architectModel,
  architectProvider: state.architectProvider,
  builderActions: state.builderActions,
  builderLastSummary: state.builderLastSummary,
  builderModel: state.builderModel,
  builderProvider: state.builderProvider,
  agents: state.agents,
  previewCode: state.previewCode,
  previewIsStreaming: state.previewIsStreaming,
  windowPositions: state.windowPositions,
  hydrated: state.hydrated,
});

const getInitialState = (): WorkspaceState => ({
  isWorkspaceActive: false,
  activeWindows: [],
  projectPath: null,
  projectName: null,
  projectFiles: [],
  builderLogContent: null,
  architectPlan: null,
  architectLastMessage: null,
  architectModel: null,
  architectProvider: null,
  builderActions: [],
  builderLastSummary: null,
  builderModel: null,
  builderProvider: null,
  agents: [],
  previewCode: '',
  previewIsStreaming: false,
  windowPositions: {},
  hydrated: false,
});

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => {
      // Initialize broadcast channel
      if (typeof window !== 'undefined') {
        initBroadcastChannel(set, get);
      }

      return {
        ...getInitialState(),

        hydrate: () => {
          set({ hydrated: true });
          // Re-init broadcast channel on hydrate
          initBroadcastChannel(set, get);
        },

        // Workspace lifecycle
        activateWorkspace: () => {
          set({ isWorkspaceActive: true });
          broadcast('SYNC_STATE', getSerializableState(get()));
        },

        deactivateWorkspace: () => {
          set({ isWorkspaceActive: false, activeWindows: [] });
          broadcast('WORKSPACE_RESET', {});
        },

        setActiveWindow: (window, active) => {
          const windows = get().activeWindows;
          if (active && !windows.includes(window)) {
            set({ activeWindows: [...windows, window] });
          } else if (!active) {
            set({ activeWindows: windows.filter(w => w !== window) });
          }
          broadcast('WINDOW_ACTIVE', { window, active });
        },

        // Project
        setProject: (path, name, files = []) => {
          set({ projectPath: path, projectName: name, projectFiles: files });
          broadcast('PROJECT_CHANGED', { projectPath: path, projectName: name, projectFiles: files });
        },

        setBuilderLog: (content) => {
          set({ builderLogContent: content });
        },

        // Architect
        setArchitectPlan: (plan) => {
          set({ architectPlan: plan });
          broadcast('ARCHITECT_PLAN', { plan });
        },

        setArchitectLastMessage: (message) => {
          set({ architectLastMessage: message });
          broadcast('ARCHITECT_MESSAGE', { message });
        },

        setArchitectModel: (model, provider) => {
          set({ architectModel: model, architectProvider: provider });
        },

        // Builder
        addBuilderAction: (action) => {
          const fullAction: BuildAction = {
            ...action,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
          };
          set({ builderActions: [...get().builderActions, fullAction] });
          broadcast('BUILDER_ACTION', { action: fullAction });
        },

        setBuilderLastSummary: (summary) => {
          set({ builderLastSummary: summary });
          broadcast('BUILDER_SUMMARY', { summary });
        },

        setBuilderModel: (model, provider) => {
          set({ builderModel: model, builderProvider: provider });
        },

        clearBuilderActions: () => {
          set({ builderActions: [] });
        },

        // Agents
        addAgent: (agent) => {
          const fullAgent: AgentConfig = {
            ...agent,
            id: crypto.randomUUID(),
          };
          set({ agents: [...get().agents, fullAgent] });
          broadcast('AGENT_ADDED', { agent: fullAgent });
        },

        updateAgent: (id, updates) => {
          set({
            agents: get().agents.map(a => a.id === id ? { ...a, ...updates } : a)
          });
          broadcast('AGENT_UPDATED', { id, updates });
        },

        removeAgent: (id) => {
          set({ agents: get().agents.filter(a => a.id !== id) });
          broadcast('AGENT_REMOVED', { id });
        },

        // Preview
        setPreviewCode: (code) => {
          set({ previewCode: code });
          broadcast('PREVIEW_CODE', { code, isStreaming: get().previewIsStreaming });
        },

        setPreviewStreaming: (streaming) => {
          set({ previewIsStreaming: streaming });
          broadcast('PREVIEW_CODE', { code: get().previewCode, isStreaming: streaming });
        },

        // Window positions
        setWindowPosition: (window, position) => {
          set({
            windowPositions: {
              ...get().windowPositions,
              [window]: position,
            }
          });
        },

        // Full reset
        resetWorkspace: () => {
          set(getInitialState());
          broadcast('WORKSPACE_RESET', {});
        },
      };
    },
    {
      name: 'sarge-workspace',
      version: 2,
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        // Persist window positions and project info
        windowPositions: state.windowPositions,
        projectPath: state.projectPath,
        projectName: state.projectName,
        // ALSO persist preview code so workspace windows can read it on open
        previewCode: state.previewCode,
        // Don't persist transient state like streaming, active windows
      }),
    }
  )
);

// Helper to launch workspace windows (2 windows: Studio + Preview)
export function launchWorkspace() {
  const store = useWorkspaceStore.getState();
  const positions = store.windowPositions;

  // Default positions for 2 windows
  const defaultPositions = {
    studio: { x: 0, y: 0, width: 900, height: 800 },
    preview: { x: 920, y: 0, width: 800, height: 800 },
  };

  const getWindowFeatures = (pos: { x: number; y: number; width: number; height: number }) => {
    return `left=${pos.x},top=${pos.y},width=${pos.width},height=${pos.height},menubar=no,toolbar=no,location=no,status=no`;
  };

  // Open 2 windows: Studio (Architect + Builder) and Preview
  const studioPos = positions.builder || defaultPositions.studio;
  const previewPos = positions.preview || defaultPositions.preview;

  const showToast = useUIStore.getState().showToast;

  // Open both windows immediately in the same user gesture
  // Opening them together (not with setTimeout) gives better chance of avoiding popup blocker
  const studioWin = window.open('/workspace/studio', 'sarge-studio', getWindowFeatures(studioPos));
  const previewWin = window.open('/workspace/preview', 'sarge-preview', getWindowFeatures(previewPos));

  if (!studioWin) {
    console.warn('[Workspace] Studio window blocked by popup blocker.');
    showToast({
      type: 'error',
      message: 'Popup blocked - Please allow popups for localhost:5000',
      duration: 6000,
    });
    return;
  }

  if (!previewWin || previewWin.closed) {
    console.warn('[Workspace] Preview window blocked by popup blocker. Please allow popups for this site.');
    showToast({
      type: 'warning',
      message: 'Preview window blocked - Allow popups for localhost:5000 and click "Launch Workspace" again.',
      duration: 8000,
    });
    // Still continue - Studio is open at least
  }

  // Activate workspace
  store.activateWorkspace();

  console.log('[Workspace] Launched 2 windows (Studio + Preview)');
}

// Helper to recall all workspace windows
export function recallWorkspace() {
  // Close workspace windows by name
  const studioWin = window.open('', 'sarge-studio');
  const previewWin = window.open('', 'sarge-preview');

  if (studioWin) studioWin.close();
  if (previewWin) previewWin.close();

  useWorkspaceStore.getState().deactivateWorkspace();

  console.log('[Workspace] Recalled all windows');
}
