/**
 * Artifact Store - Builder Preview State Persistence
 *
 * Persists:
 * - Generated artifact code (HTML, etc.)
 * - Artifact file path (if editing a file)
 * - Active tab (code/preview/diff)
 * - Version history for undo
 *
 * This ensures the preview survives navigation away from Builder.
 * Also syncs to workspaceStore so Launch Workspace preview shows the same content.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";
import { useWorkspaceStore } from './workspaceStore';
import { ARTIFACT_MAX_VERSIONS } from '@/lib/constants';

interface ArtifactVersion {
  code: string;
  timestamp: number;
  description?: string;
}

interface ArtifactState {
  // Current artifact
  code: string;
  path: string | null;
  title: string | null;
  language: string;

  // UI state
  activeTab: 'code' | 'preview' | 'diff' | 'deploy';

  // Version history (for diff/undo)
  versions: ArtifactVersion[];
  currentVersionIndex: number;

  // Streaming state
  isStreaming: boolean;
  streamingCode: string;

  // Hydration
  hydrated: boolean;

  // Actions
  hydrate: () => void;
  setCode: (code: string, path?: string | null, title?: string | null) => void;
  setStreamingCode: (code: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  finalizeStreaming: () => void;
  setActiveTab: (tab: 'code' | 'preview' | 'diff' | 'deploy') => void;
  setLanguage: (language: string) => void;
  clear: () => void;

  // Version management
  addVersion: (code: string, description?: string) => void;
  goToVersion: (index: number) => void;
  getPreviousVersion: () => ArtifactVersion | null;
}

export const useArtifactStore = create<ArtifactState>()(
  persist(
    (set, get) => ({
      // Initial state
      code: '',
      path: null,
      title: null,
      language: 'html',
      activeTab: 'preview',
      versions: [],
      currentVersionIndex: -1,
      isStreaming: false,
      streamingCode: '',
      hydrated: false,

      hydrate: () => {
        set({ hydrated: true });
      },

      setCode: (code, path = null, title = null) => {
        const state = get();
        // Add current code to versions if it's different and not empty
        if (state.code && state.code !== code) {
          const newVersions = [
            ...state.versions,
            { code: state.code, timestamp: Date.now() }
          ].slice(-ARTIFACT_MAX_VERSIONS);
          set({
            code,
            path,
            title,
            versions: newVersions,
            currentVersionIndex: newVersions.length,
          });
        } else {
          set({ code, path, title });
        }
        // Sync to workspace store for Launch Workspace preview
        useWorkspaceStore.getState().setPreviewCode(code);
      },

      setStreamingCode: (streamingCode) => {
        console.log('[ArtifactStore] setStreamingCode:', { length: streamingCode?.length || 0 });
        set({ streamingCode });
        // Sync streaming code to workspace store for Launch Workspace preview
        useWorkspaceStore.getState().setPreviewCode(streamingCode);
      },

      setIsStreaming: (isStreaming) => {
        console.log('[ArtifactStore] setIsStreaming:', isStreaming);
        // NOTE: Don't clear streamingCode here - it may have already been set
        // The streamingCode will be cleared when finalizeStreaming is called
        set({ isStreaming });
        // Sync streaming state to workspace store
        useWorkspaceStore.getState().setPreviewStreaming(isStreaming);
      },

      finalizeStreaming: () => {
        const state = get();
        if (state.streamingCode) {
          // Move streaming code to main code
          const newVersions = state.code
            ? [...state.versions, { code: state.code, timestamp: Date.now() }].slice(-ARTIFACT_MAX_VERSIONS)
            : state.versions;

          set({
            code: state.streamingCode,
            streamingCode: '',
            isStreaming: false,
            versions: newVersions,
            currentVersionIndex: newVersions.length,
          });
          // Sync final code to workspace store
          useWorkspaceStore.getState().setPreviewCode(state.streamingCode);
          useWorkspaceStore.getState().setPreviewStreaming(false);
        } else {
          set({ isStreaming: false });
          useWorkspaceStore.getState().setPreviewStreaming(false);
        }
      },

      setActiveTab: (activeTab) => {
        set({ activeTab });
      },

      setLanguage: (language) => {
        set({ language });
      },

      clear: () => {
        console.log('[ArtifactStore] Clearing artifact state');
        set({
          code: '',
          path: null,
          title: null,
          streamingCode: '',
          isStreaming: false,
          versions: [],
          currentVersionIndex: -1,
          // Keep activeTab as user preference
        });
        // Sync cleared state to workspace store (for Launch Workspace preview)
        useWorkspaceStore.getState().setPreviewCode('');
        useWorkspaceStore.getState().setPreviewStreaming(false);
        // Also force clear localStorage to ensure persistence is updated
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem('builder-artifact-state');
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed.state = {
                ...parsed.state,
                code: '',
                path: null,
                title: null,
                streamingCode: '',
                isStreaming: false,
                versions: [],
                currentVersionIndex: -1,
              };
              localStorage.setItem('builder-artifact-state', JSON.stringify(parsed));
              console.log('[ArtifactStore] localStorage cleared');
            }
          } catch (e) {
            console.error('[ArtifactStore] Failed to clear localStorage:', e);
          }
        }
      },

      addVersion: (code, description) => {
        const state = get();
        const newVersions = [
          ...state.versions,
          { code, timestamp: Date.now(), description }
        ].slice(-ARTIFACT_MAX_VERSIONS);
        set({
          versions: newVersions,
          currentVersionIndex: newVersions.length,
        });
      },

      goToVersion: (index) => {
        const state = get();
        if (index >= 0 && index < state.versions.length) {
          set({
            code: state.versions[index].code,
            currentVersionIndex: index,
          });
        }
      },

      getPreviousVersion: () => {
        const state = get();
        if (state.versions.length > 0) {
          return state.versions[state.versions.length - 1];
        }
        return null;
      },
    }),
    {
      name: 'builder-artifact-state',
      version: 1,
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        code: state.code,
        path: state.path,
        title: state.title,
        language: state.language,
        activeTab: state.activeTab,
        versions: state.versions,
        currentVersionIndex: state.currentVersionIndex,
        // Don't persist streaming state - it's transient
      }),
    }
  )
);
