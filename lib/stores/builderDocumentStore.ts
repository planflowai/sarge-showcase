/**
 * Builder Document Store
 *
 * Manages project files and state for the Builder:
 * - Current project selection
 * - File tree structure
 * - Open files and unsaved changes
 * - File operations (create, read, write, delete)
 */

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;  // Relative path from project root
  type: 'file' | 'directory';
  size: number;
  modified?: string;
  children?: FileEntry[];
}

export interface OpenFile {
  path: string;
  content: string;
  originalContent: string;  // Content when last saved
  isDirty: boolean;
  language: string;
}

export interface Project {
  name: string;
  path: string;  // Relative path from BUILDER_PROJECTS_DIR
  files: FileEntry[];
  lastOpened?: string;
}

interface BuilderDocumentState {
  // Current project
  currentProject: Project | null;
  projectList: { name: string; path: string }[];

  // Open files
  openFiles: OpenFile[];
  activeFilePath: string | null;

  // UI state
  fileTreeExpanded: Set<string>;  // Paths of expanded directories
  isLoading: boolean;
  error: string | null;

  // Hydration
  hydrated: boolean;
}

interface BuilderDocumentActions {
  // Hydration
  hydrate: () => void;

  // Project management
  loadProjectList: () => Promise<void>;
  createProject: (name: string) => Promise<Project | null>;
  openProject: (name: string) => Promise<Project | null>;
  closeProject: () => void;
  refreshProject: () => Promise<void>;
  deleteProject: (name: string) => Promise<boolean>;

  // File operations
  readFile: (relativePath: string) => Promise<string | null>;
  saveFile: (relativePath: string, content: string) => Promise<boolean>;
  createFile: (relativePath: string, content?: string) => Promise<boolean>;
  createDirectory: (relativePath: string) => Promise<boolean>;
  deleteFile: (relativePath: string) => Promise<boolean>;
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>;

  // Open file management
  openFile: (relativePath: string) => Promise<void>;
  closeFile: (relativePath: string) => void;
  setActiveFile: (relativePath: string | null) => void;
  updateFileContent: (relativePath: string, content: string) => void;
  markFileSaved: (relativePath: string, content: string) => void;
  hasUnsavedChanges: () => boolean;
  getUnsavedFiles: () => string[];

  // File tree
  toggleDirectory: (path: string) => void;
  expandDirectory: (path: string) => void;
  collapseDirectory: (path: string) => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
}

type BuilderDocumentStore = BuilderDocumentState & BuilderDocumentActions;

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: any
): Promise<{ data?: T; error?: string }> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || `API error: ${response.status}` };
    }

    return { data };
  } catch (err: any) {
    return { error: err.message || 'Network error' };
  }
}

// ─── Language Detection ──────────────────────────────────────────────────────

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    svg: 'xml',
    txt: 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useBuilderDocumentStore = create<BuilderDocumentStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentProject: null,
      projectList: [],
      openFiles: [],
      activeFilePath: null,
      fileTreeExpanded: new Set<string>(),
      isLoading: false,
      error: null,
      hydrated: false,

      // Hydration
      hydrate: () => {
        set({ hydrated: true });
        // Load project list on hydration
        get().loadProjectList();

        // If we have a currentProject but no files (restored from localStorage),
        // reload the project files
        const currentProject = get().currentProject;
        if (currentProject && (!currentProject.files || currentProject.files.length === 0)) {
          get().openProject(currentProject.name);
        }
      },

      // ─── Project Management ─────────────────────────────────────────────────

      loadProjectList: async () => {
        set({ isLoading: true, error: null });

        const { data, error } = await apiCall<{ files: FileEntry[] }>(
          '/api/builder/files?path=&recursive=false'
        );

        if (error) {
          set({ isLoading: false, error });
          return;
        }

        const projects = (data?.files || [])
          .filter(f => f.type === 'directory')
          .map(f => ({ name: f.name, path: f.path }));

        set({ projectList: projects, isLoading: false });
      },

      createProject: async (name: string) => {
        set({ isLoading: true, error: null });

        // Sanitize project name
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');

        const { data, error } = await apiCall<{ success: boolean }>(
          '/api/builder/files',
          'POST',
          { path: safeName, type: 'directory' }
        );

        if (error) {
          set({ isLoading: false, error });
          return null;
        }

        // Create default index.html
        await apiCall('/api/builder/files', 'POST', {
          path: `${safeName}/index.html`,
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>Welcome to ${name}</h1>
  <script src="script.js"></script>
</body>
</html>`,
        });

        // Create default styles.css
        await apiCall('/api/builder/files', 'POST', {
          path: `${safeName}/styles.css`,
          content: `/* ${name} Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  color: #333;
}

h1 {
  padding: 2rem;
  text-align: center;
}
`,
        });

        // Create default script.js
        await apiCall('/api/builder/files', 'POST', {
          path: `${safeName}/script.js`,
          content: `// ${name} JavaScript
console.log('${name} loaded');
`,
        });

        // Refresh project list and open the new project
        await get().loadProjectList();
        const project = await get().openProject(safeName);

        set({ isLoading: false });
        return project;
      },

      openProject: async (name: string) => {
        set({ isLoading: true, error: null, openFiles: [], activeFilePath: null });

        const { data, error } = await apiCall<{ files: FileEntry[] }>(
          `/api/builder/files?path=${encodeURIComponent(name)}&recursive=true`
        );

        if (error) {
          set({ isLoading: false, error });
          return null;
        }

        const project: Project = {
          name,
          path: name,
          files: data?.files || [],
          lastOpened: new Date().toISOString(),
        };

        set({
          currentProject: project,
          isLoading: false,
          fileTreeExpanded: new Set([name]),
        });

        return project;
      },

      closeProject: () => {
        set({
          currentProject: null,
          openFiles: [],
          activeFilePath: null,
          fileTreeExpanded: new Set(),
        });
      },

      refreshProject: async () => {
        const current = get().currentProject;
        if (!current) return;
        await get().openProject(current.name);
      },

      deleteProject: async (name: string) => {
        set({ isLoading: true, error: null });

        const { error } = await apiCall('/api/builder/files', 'DELETE', { path: name });

        if (error) {
          set({ isLoading: false, error });
          return false;
        }

        // If this was the current project, close it
        if (get().currentProject?.name === name) {
          get().closeProject();
        }

        // Refresh project list
        await get().loadProjectList();
        set({ isLoading: false });
        return true;
      },

      // ─── File Operations ────────────────────────────────────────────────────

      readFile: async (relativePath: string) => {
        const project = get().currentProject;
        if (!project) return null;

        const fullPath = `${project.path}/${relativePath}`;
        const { data, error } = await apiCall<{ content: string }>(
          `/api/builder/files?path=${encodeURIComponent(fullPath)}`
        );

        if (error) {
          set({ error });
          return null;
        }

        return data?.content || null;
      },

      saveFile: async (relativePath: string, content: string) => {
        const project = get().currentProject;
        if (!project) return false;

        const fullPath = `${project.path}/${relativePath}`;
        const { error } = await apiCall('/api/builder/files', 'POST', {
          path: fullPath,
          content,
        });

        if (error) {
          set({ error });
          return false;
        }

        // Mark the file as saved
        get().markFileSaved(relativePath, content);
        return true;
      },

      createFile: async (relativePath: string, content: string = '') => {
        const project = get().currentProject;
        if (!project) return false;

        const fullPath = `${project.path}/${relativePath}`;
        const { error } = await apiCall('/api/builder/files', 'POST', {
          path: fullPath,
          content,
        });

        if (error) {
          set({ error });
          return false;
        }

        // Refresh project to show new file
        await get().refreshProject();
        return true;
      },

      createDirectory: async (relativePath: string) => {
        const project = get().currentProject;
        if (!project) return false;

        const fullPath = `${project.path}/${relativePath}`;
        const { error } = await apiCall('/api/builder/files', 'POST', {
          path: fullPath,
          type: 'directory',
        });

        if (error) {
          set({ error });
          return false;
        }

        await get().refreshProject();
        return true;
      },

      deleteFile: async (relativePath: string) => {
        const project = get().currentProject;
        if (!project) return false;

        const fullPath = `${project.path}/${relativePath}`;
        const { error } = await apiCall('/api/builder/files', 'DELETE', {
          path: fullPath,
        });

        if (error) {
          set({ error });
          return false;
        }

        // Close the file if it was open
        get().closeFile(relativePath);

        await get().refreshProject();
        return true;
      },

      renameFile: async (oldPath: string, newPath: string) => {
        const project = get().currentProject;
        if (!project) return false;

        // Read old file
        const content = await get().readFile(oldPath);
        if (content === null) return false;

        // Create new file
        const created = await get().createFile(newPath, content);
        if (!created) return false;

        // Delete old file
        const deleted = await get().deleteFile(oldPath);
        if (!deleted) {
          // Rollback: delete the new file
          await get().deleteFile(newPath);
          return false;
        }

        return true;
      },

      // ─── Open File Management ───────────────────────────────────────────────

      openFile: async (relativePath: string) => {
        // Check if already open
        const existing = get().openFiles.find(f => f.path === relativePath);
        if (existing) {
          set({ activeFilePath: relativePath });
          return;
        }

        // Read the file content
        const content = await get().readFile(relativePath);
        if (content === null) return;

        const openFile: OpenFile = {
          path: relativePath,
          content,
          originalContent: content,
          isDirty: false,
          language: detectLanguage(relativePath),
        };

        set(state => ({
          openFiles: [...state.openFiles, openFile],
          activeFilePath: relativePath,
        }));
      },

      closeFile: (relativePath: string) => {
        set(state => {
          const newOpenFiles = state.openFiles.filter(f => f.path !== relativePath);
          let newActiveFile = state.activeFilePath;

          // If closing the active file, activate another
          if (state.activeFilePath === relativePath) {
            newActiveFile = newOpenFiles.length > 0 ? newOpenFiles[0].path : null;
          }

          return {
            openFiles: newOpenFiles,
            activeFilePath: newActiveFile,
          };
        });
      },

      setActiveFile: (relativePath: string | null) => {
        set({ activeFilePath: relativePath });
      },

      updateFileContent: (relativePath: string, content: string) => {
        set(state => ({
          openFiles: state.openFiles.map(f => {
            if (f.path === relativePath) {
              return {
                ...f,
                content,
                isDirty: content !== f.originalContent,
              };
            }
            return f;
          }),
        }));
      },

      markFileSaved: (relativePath: string, content: string) => {
        set(state => ({
          openFiles: state.openFiles.map(f => {
            if (f.path === relativePath) {
              return {
                ...f,
                content,
                originalContent: content,
                isDirty: false,
              };
            }
            return f;
          }),
        }));
      },

      hasUnsavedChanges: () => {
        return get().openFiles.some(f => f.isDirty);
      },

      getUnsavedFiles: () => {
        return get().openFiles.filter(f => f.isDirty).map(f => f.path);
      },

      // ─── File Tree ──────────────────────────────────────────────────────────

      toggleDirectory: (path: string) => {
        set(state => {
          const expanded = new Set(state.fileTreeExpanded);
          if (expanded.has(path)) {
            expanded.delete(path);
          } else {
            expanded.add(path);
          }
          return { fileTreeExpanded: expanded };
        });
      },

      expandDirectory: (path: string) => {
        set(state => {
          const expanded = new Set(state.fileTreeExpanded);
          expanded.add(path);
          return { fileTreeExpanded: expanded };
        });
      },

      collapseDirectory: (path: string) => {
        set(state => {
          const expanded = new Set(state.fileTreeExpanded);
          expanded.delete(path);
          return { fileTreeExpanded: expanded };
        });
      },

      // ─── Error Handling ─────────────────────────────────────────────────────

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'builder-documents',
      version: 1,
      partialize: (state) => ({
        // Only persist project info, not file contents
        currentProject: state.currentProject ? {
          name: state.currentProject.name,
          path: state.currentProject.path,
        } : null,
        projectList: state.projectList,
      }),
      // Custom serialization to handle Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str);
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
