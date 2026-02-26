/**
 * Builder Store - Project and File State Management
 *
 * Manages:
 * - Open project path
 * - File tree structure
 * - Current file being edited
 * - Expanded folder state
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@sarge/core";

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

interface BuilderState {
  // Project state
  projectPath: string | null;
  projectName: string | null;
  fileTree: FileNode[];

  // Current file state
  currentFilePath: string | null;
  currentFileContent: string;
  currentFileLanguage: string;
  isDirty: boolean;  // Has unsaved changes

  // UI state
  expandedFolders: string[];
  autoApply: boolean;  // Auto-apply file changes without user confirmation

  // Hydration
  hydrated: boolean;

  // Actions
  hydrate: () => void;
  setAutoApply: (enabled: boolean) => void;
  toggleAutoApply: () => void;
  setProject: (path: string, name: string, tree: FileNode[]) => void;
  clearProject: () => void;
  setFileTree: (tree: FileNode[]) => void;
  setCurrentFile: (path: string, content: string, language: string) => void;
  updateCurrentContent: (content: string) => void;
  clearCurrentFile: () => void;
  toggleFolder: (path: string) => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  markClean: () => void;
}

// File extension to language mapping
export const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'sass',
  'less': 'less',
  'js': 'javascript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'json': 'json',
  'md': 'markdown',
  'mdx': 'markdown',
  'yaml': 'yaml',
  'yml': 'yaml',
  'xml': 'xml',
  'svg': 'xml',
  'txt': 'plaintext',
  // Images & media
  'png': 'plaintext',
  'jpg': 'plaintext',
  'jpeg': 'plaintext',
  'gif': 'plaintext',
  'webp': 'plaintext',
  'ico': 'plaintext',
  'bmp': 'plaintext',
  'avif': 'plaintext',
  // Fonts
  'woff': 'plaintext',
  'woff2': 'plaintext',
  'ttf': 'plaintext',
  'otf': 'plaintext',
  'eot': 'plaintext',
};

// Supported file extensions for the file explorer
export const SUPPORTED_EXTENSIONS = new Set(Object.keys(EXTENSION_LANGUAGE_MAP));

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext';
}

export function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'html':
    case 'htm':
      return '🌐';
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return '🎨';
    case 'js':
    case 'mjs':
    case 'cjs':
      return '📜';
    case 'jsx':
      return '⚛️';
    case 'ts':
      return '📘';
    case 'tsx':
      return '⚛️';
    case 'json':
      return '📋';
    case 'md':
    case 'mdx':
      return '📝';
    case 'yaml':
    case 'yml':
      return '⚙️';
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
    case 'bmp':
    case 'avif':
      return '🖼️';
    case 'woff':
    case 'woff2':
    case 'ttf':
    case 'otf':
    case 'eot':
      return '🔤';
    default:
      return '📄';
  }
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      projectPath: null,
      projectName: null,
      fileTree: [],
      currentFilePath: null,
      currentFileContent: '',
      currentFileLanguage: 'plaintext',
      isDirty: false,
      expandedFolders: [],
      autoApply: true,  // Default to auto-apply (files write to disk automatically)
      hydrated: false,

      hydrate: () => {
        set({ hydrated: true });
      },

      setProject: (path, name, tree) => {
        set({
          projectPath: path,
          projectName: name,
          fileTree: tree,
          currentFilePath: null,
          currentFileContent: '',
          currentFileLanguage: 'plaintext',
          isDirty: false,
          expandedFolders: [],
        });
      },

      clearProject: () => {
        set({
          projectPath: null,
          projectName: null,
          fileTree: [],
          currentFilePath: null,
          currentFileContent: '',
          currentFileLanguage: 'plaintext',
          isDirty: false,
          expandedFolders: [],
        });
      },

      setFileTree: (tree) => {
        set({ fileTree: tree });
      },

      setCurrentFile: (path, content, language) => {
        set({
          currentFilePath: path,
          currentFileContent: content,
          currentFileLanguage: language,
          isDirty: false,
        });
      },

      updateCurrentContent: (content) => {
        set({
          currentFileContent: content,
          isDirty: true,
        });
      },

      clearCurrentFile: () => {
        set({
          currentFilePath: null,
          currentFileContent: '',
          currentFileLanguage: 'plaintext',
          isDirty: false,
        });
      },

      toggleFolder: (path) => {
        const expanded = get().expandedFolders;
        if (expanded.includes(path)) {
          set({ expandedFolders: expanded.filter((p) => p !== path) });
        } else {
          set({ expandedFolders: [...expanded, path] });
        }
      },

      expandFolder: (path) => {
        const expanded = get().expandedFolders;
        if (!expanded.includes(path)) {
          set({ expandedFolders: [...expanded, path] });
        }
      },

      collapseFolder: (path) => {
        set({ expandedFolders: get().expandedFolders.filter((p) => p !== path) });
      },

      setAutoApply: (enabled) => {
        set({ autoApply: enabled });
      },

      toggleAutoApply: () => {
        set({ autoApply: !get().autoApply });
      },

      markClean: () => {
        set({ isDirty: false });
      },
    }),
    {
      name: 'builder-project-state',
      version: 2,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          // v1 may have stored expandedFolders as a Set-like object or missing; reset to array
          persisted.expandedFolders = [];
        }
        return persisted;
      },
      partialize: (state) => ({
        projectPath: state.projectPath,
        projectName: state.projectName,
        expandedFolders: state.expandedFolders,
        autoApply: state.autoApply,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          return parsed;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
