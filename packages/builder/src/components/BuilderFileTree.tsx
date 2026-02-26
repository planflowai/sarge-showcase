"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileImage,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  FolderPlus,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBuilderDocumentStore,
  type FileEntry,
} from "@/lib/stores/builderDocumentStore";

// ─── File Icon Detection ─────────────────────────────────────────────────────

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";

  // Code files
  if (["html", "htm", "jsx", "tsx", "vue", "svelte"].includes(ext)) {
    return <FileCode className="w-4 h-4 text-orange-400" />;
  }
  if (["js", "mjs", "cjs", "ts"].includes(ext)) {
    return <FileCode className="w-4 h-4 text-yellow-400" />;
  }
  if (["css", "scss", "sass", "less"].includes(ext)) {
    return <FileCode className="w-4 h-4 text-blue-400" />;
  }
  if (["json", "yaml", "yml", "xml", "toml"].includes(ext)) {
    return <FileCode className="w-4 h-4 text-green-400" />;
  }
  if (["py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp"].includes(ext)) {
    return <FileCode className="w-4 h-4 text-purple-400" />;
  }

  // Image files
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"].includes(ext)) {
    return <FileImage className="w-4 h-4 text-pink-400" />;
  }

  // Text/doc files
  if (["md", "mdx", "txt", "rtf", "doc", "docx"].includes(ext)) {
    return <FileText className="w-4 h-4 text-zinc-400" />;
  }

  return <File className="w-4 h-4 text-zinc-400" />;
}

// ─── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  isDirectory: boolean;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ContextMenu({
  x,
  y,
  isDirectory,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onClose,
}: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px] text-sm"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {isDirectory && (
        <>
          <button
            onClick={onNewFile}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-700 flex items-center gap-2 text-zinc-300"
          >
            <Plus className="w-3.5 h-3.5" /> New File
          </button>
          <button
            onClick={onNewFolder}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-700 flex items-center gap-2 text-zinc-300"
          >
            <FolderPlus className="w-3.5 h-3.5" /> New Folder
          </button>
          <div className="border-t border-zinc-700 my-1" />
        </>
      )}
      <button
        onClick={onRename}
        className="w-full px-3 py-1.5 text-left hover:bg-zinc-700 flex items-center gap-2 text-zinc-300"
      >
        <Edit2 className="w-3.5 h-3.5" /> Rename
      </button>
      <button
        onClick={onDelete}
        className="w-full px-3 py-1.5 text-left hover:bg-red-500/10 flex items-center gap-2 text-red-400"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </button>
    </div>
  );
}

// ─── File Tree Item ──────────────────────────────────────────────────────────

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  activeFilePath: string | null;
  dirtyFiles: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (path: string) => void;
}

function FileTreeItem({
  entry,
  depth,
  onSelect,
  onContextMenu,
  activeFilePath,
  dirtyFiles,
  expanded,
  onToggleExpand,
}: FileTreeItemProps) {
  const isExpanded = expanded.has(entry.path);
  const isActive = entry.path === activeFilePath;
  const isDirty = dirtyFiles.has(entry.path);

  const handleClick = () => {
    if (entry.type === "directory") {
      onToggleExpand(entry.path);
    } else {
      onSelect(entry.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded text-sm",
          "hover:bg-zinc-800 transition-colors",
          isActive && "bg-emerald-500/10 text-emerald-400"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {/* Expand/collapse for directories */}
        {entry.type === "directory" ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5" /> {/* Spacer for alignment */}
            {getFileIcon(entry.name)}
          </>
        )}

        <span className="flex-1 truncate">{entry.name}</span>

        {/* Dirty indicator */}
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
        )}
      </div>

      {/* Children */}
      {entry.type === "directory" && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              activeFilePath={activeFilePath}
              dirtyFiles={dirtyFiles}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Item Dialog ─────────────────────────────────────────────────────────

interface NewItemDialogProps {
  type: "file" | "directory";
  parentPath: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

function NewItemDialog({ type, parentPath, onSubmit, onCancel }: NewItemDialogProps) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-lg p-4 w-80">
        <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
          {type === "file" ? <Plus className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
          New {type === "file" ? "File" : "Folder"}
        </h3>
        <p className="text-xs text-zinc-500 mb-2">
          In: {parentPath || "project root"}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "file" ? "filename.html" : "folder-name"}
            className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:border-emerald-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Dialog ──────────────────────────────────────────────

interface DeleteDialogProps {
  path: string;
  isDirectory: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteDialog({ path, isDirectory, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-lg p-4 w-80">
        <h3 className="font-medium mb-3 flex items-center gap-2 text-sm text-red-400">
          <Trash2 className="w-4 h-4" />
          Delete {isDirectory ? "Folder" : "File"}
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          Are you sure you want to delete <span className="text-white">{path}</span>?
          {isDirectory && " This will delete all contents."}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 rounded"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface BuilderFileTreeProps {
  onFileSelect?: (path: string, content: string) => void;
  className?: string;
}

export function BuilderFileTree({ onFileSelect, className }: BuilderFileTreeProps) {
  const {
    currentProject,
    projectList,
    openFiles,
    activeFilePath,
    fileTreeExpanded,
    isLoading,
    error,
    hydrated,
    hydrate,
    loadProjectList,
    createProject,
    openProject,
    closeProject,
    refreshProject,
    deleteProject,
    openFile,
    createFile,
    createDirectory,
    deleteFile,
    renameFile,
    toggleDirectory,
    setActiveFile,
    clearError,
  } = useBuilderDocumentStore();

  // Local state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const [newItemDialog, setNewItemDialog] = useState<{
    type: "file" | "directory";
    parentPath: string;
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    path: string;
    isDirectory: boolean;
  } | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Hydrate on mount
  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrated, hydrate]);

  // Build set of dirty files for quick lookup
  const dirtyFiles = new Set(openFiles.filter((f) => f.isDirty).map((f) => f.path));

  // Convert fileTreeExpanded Set to a Set (in case it was deserialized as array)
  const expandedSet =
    fileTreeExpanded instanceof Set
      ? fileTreeExpanded
      : new Set(Array.isArray(fileTreeExpanded) ? fileTreeExpanded : []);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (path: string) => {
      await openFile(path);
      const file = useBuilderDocumentStore.getState().openFiles.find((f) => f.path === path);
      if (file && onFileSelect) {
        onFileSelect(path, file.content);
      }
    },
    [openFile, onFileSelect]
  );

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleNewFile = () => {
    if (!contextMenu) return;
    const parentPath = contextMenu.entry.type === "directory"
      ? contextMenu.entry.path
      : contextMenu.entry.path.split("/").slice(0, -1).join("/");
    setNewItemDialog({ type: "file", parentPath });
    setContextMenu(null);
  };

  const handleNewFolder = () => {
    if (!contextMenu) return;
    const parentPath = contextMenu.entry.type === "directory"
      ? contextMenu.entry.path
      : contextMenu.entry.path.split("/").slice(0, -1).join("/");
    setNewItemDialog({ type: "directory", parentPath });
    setContextMenu(null);
  };

  const handleRename = () => {
    // TODO: Implement rename dialog
    setContextMenu(null);
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    setDeleteDialog({
      path: contextMenu.entry.path,
      isDirectory: contextMenu.entry.type === "directory",
    });
    setContextMenu(null);
  };

  const handleCreateItem = async (name: string) => {
    if (!newItemDialog || !currentProject) return;

    const relativePath = newItemDialog.parentPath
      ? `${newItemDialog.parentPath.replace(currentProject.path + "/", "")}/${name}`
      : name;

    if (newItemDialog.type === "file") {
      await createFile(relativePath, "");
    } else {
      await createDirectory(relativePath);
    }

    setNewItemDialog(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog || !currentProject) return;

    const relativePath = deleteDialog.path.replace(currentProject.path + "/", "");
    await deleteFile(relativePath);
    setDeleteDialog(null);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    setNewProjectName("");
    setShowNewProject(false);
  };

  // Render project selector if no project is open
  if (!currentProject) {
    return (
      <div className={cn("flex flex-col bg-zinc-900 border-r border-zinc-800", className)}>
        <div className="p-3 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-400">Projects</h3>
            <button
              onClick={() => setShowNewProject(true)}
              className="p-1 hover:bg-zinc-700 rounded"
              title="New Project"
            >
              <Plus className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
            </div>
          )}

          {!isLoading && projectList.length === 0 && (
            <div className="text-center py-4 text-xs text-zinc-500">
              No projects yet.
              <br />
              Click + to create one.
            </div>
          )}

          {projectList.map((project) => (
            <button
              key={project.path}
              onClick={() => openProject(project.name)}
              className="w-full text-left px-3 py-2 rounded hover:bg-zinc-800 text-sm flex items-center gap-2"
            >
              <Folder className="w-4 h-4 text-amber-400" />
              {project.name}
            </button>
          ))}
        </div>

        {/* New Project Dialog */}
        {showNewProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-800 rounded-lg p-4 w-80">
              <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <FolderPlus className="w-4 h-4" /> New Project
              </h3>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="project-name"
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:border-emerald-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProject();
                  if (e.key === "Escape") setShowNewProject(false);
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-2 bg-red-500/10 border-t border-red-500/20 text-xs text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Render file tree for current project
  return (
    <div className={cn("flex flex-col bg-zinc-900 border-r border-zinc-800", className)}>
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium truncate">{currentProject.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refreshProject()}
              className="p-1 hover:bg-zinc-700 rounded"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-400", isLoading && "animate-spin")} />
            </button>
            <button
              onClick={closeProject}
              className="p-1 hover:bg-zinc-700 rounded"
              title="Close Project"
            >
              <X className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {(currentProject.files || []).map((entry) => (
          <FileTreeItem
            key={entry.path}
            entry={entry}
            depth={0}
            onSelect={handleFileSelect}
            onContextMenu={handleContextMenu}
            activeFilePath={activeFilePath}
            dirtyFiles={dirtyFiles}
            expanded={expandedSet}
            onToggleExpand={toggleDirectory}
          />
        ))}

        {(!currentProject.files || currentProject.files.length === 0) && (
          <div className="text-center py-4 text-xs text-zinc-500">
            Empty project.
            <br />
            Right-click to add files.
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isDirectory={contextMenu.entry.type === "directory"}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onRename={handleRename}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* New Item Dialog */}
      {newItemDialog && (
        <NewItemDialog
          type={newItemDialog.type}
          parentPath={newItemDialog.parentPath}
          onSubmit={handleCreateItem}
          onCancel={() => setNewItemDialog(null)}
        />
      )}

      {/* Delete Dialog */}
      {deleteDialog && (
        <DeleteDialog
          path={deleteDialog.path}
          isDirectory={deleteDialog.isDirectory}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteDialog(null)}
        />
      )}

      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-500/10 border-t border-red-500/20 text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default BuilderFileTree;
