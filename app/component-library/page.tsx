"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Library,
  Search,
  Grid,
  List,
  Star,
  Clock,
  TrendingUp,
  Download,
  Upload,
  Trash2,
  Edit3,
  Copy,
  MoreVertical,
  ChevronDown,
  Filter,
  X,
  Code2,
  Eye,
  Sparkles,
  ArrowLeft,
  FileJson,
  Check,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useComponentLibraryStore,
  COMPONENT_CATEGORIES,
  type ComponentCategory,
  type LibraryComponent,
} from "@/lib/stores/componentLibraryStore";

type SortOption = "recent" | "oldest" | "most-used" | "name" | "favorites";
type ViewMode = "grid" | "list";

export default function ComponentLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | "All">("All");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<LibraryComponent | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState("");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const components = useComponentLibraryStore((s) => s.components);
  const hydrated = useComponentLibraryStore((s) => s.hydrated);
  const hydrate = useComponentLibraryStore((s) => s.hydrate);
  const deleteComponent = useComponentLibraryStore((s) => s.deleteComponent);
  const duplicateComponent = useComponentLibraryStore((s) => s.duplicateComponent);
  const toggleFavorite = useComponentLibraryStore((s) => s.toggleFavorite);
  const updateComponent = useComponentLibraryStore((s) => s.updateComponent);
  const exportLibrary = useComponentLibraryStore((s) => s.exportLibrary);
  const exportComponent = useComponentLibraryStore((s) => s.exportComponent);
  const importLibrary = useComponentLibraryStore((s) => s.importLibrary);
  const importComponent = useComponentLibraryStore((s) => s.importComponent);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Filter and sort components
  const filteredComponents = useMemo(() => {
    let result = [...components];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query) ||
          c.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== "All") {
      result = result.filter((c) => c.category === selectedCategory);
    }

    // Sort
    switch (sortBy) {
      case "recent":
        result.sort((a, b) => b.dateModified - a.dateModified);
        break;
      case "oldest":
        result.sort((a, b) => a.dateCreated - b.dateCreated);
        break;
      case "most-used":
        result.sort((a, b) => b.timesUsed - a.timesUsed);
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "favorites":
        result.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
        break;
    }

    return result;
  }, [components, searchQuery, selectedCategory, sortBy]);

  // Update preview iframe when hovering
  useEffect(() => {
    if (hoveredComponent && previewIframeRef.current) {
      const comp = components.find((c) => c.id === hoveredComponent);
      if (comp) {
        const doc = previewIframeRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(comp.code);
          doc.close();
        }
      }
    }
  }, [hoveredComponent, components]);

  const handleExportLibrary = () => {
    const json = exportLibrary();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `component-library-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportComponent = (id: string) => {
    const json = exportComponent(id);
    if (json) {
      const comp = components.find((c) => c.id === id);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${comp?.name.replace(/\s+/g, "-").toLowerCase() || "component"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = () => {
    setImportError("");
    if (!importJson.trim()) {
      setImportError("Please paste JSON content");
      return;
    }

    try {
      const data = JSON.parse(importJson);

      if (data.components) {
        // Library import
        const result = importLibrary(importJson);
        if (result.success) {
          setShowImportModal(false);
          setImportJson("");
        } else {
          setImportError(result.errors.join(", "));
        }
      } else if (data.component) {
        // Single component import
        const result = importComponent(importJson);
        if (result.success) {
          setShowImportModal(false);
          setImportJson("");
        } else {
          setImportError(result.error || "Failed to import");
        }
      } else {
        setImportError("Invalid JSON format");
      }
    } catch {
      setImportError("Invalid JSON");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setImportJson(content);
      };
      reader.readAsText(file);
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      updateComponent(id, { name: editName.trim() });
    }
    setEditingComponent(null);
    setEditName("");
  };

  const handleDuplicate = (id: string) => {
    duplicateComponent(id);
  };

  const handleDelete = (id: string) => {
    deleteComponent(id);
    setShowDeleteConfirm(null);
    if (selectedComponent?.id === id) {
      setSelectedComponent(null);
    }
  };

  const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: "recent", label: "Most Recent", icon: <Clock className="h-3.5 w-3.5" /> },
    { value: "oldest", label: "Oldest First", icon: <Clock className="h-3.5 w-3.5" /> },
    { value: "most-used", label: "Most Used", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { value: "name", label: "Name A-Z", icon: <List className="h-3.5 w-3.5" /> },
    { value: "favorites", label: "Favorites First", icon: <Star className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/builder"
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Builder
              </Link>
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Library className="h-5 w-5 text-indigo-500" />
                <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Component Library
                </h1>
                <span className="text-sm text-zinc-400">({components.length})</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportModal(true)}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLibrary}
                disabled={components.length === 0}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Export All
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search components..."
                className="pl-9 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <Filter className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300">
                  {selectedCategory}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>
              {showCategoryDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowCategoryDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-700 z-20 py-1">
                    <button
                      onClick={() => {
                        setSelectedCategory("All");
                        setShowCategoryDropdown(false);
                      }}
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700",
                        selectedCategory === "All" && "text-indigo-600 dark:text-indigo-400"
                      )}
                    >
                      All Categories
                    </button>
                    {COMPONENT_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setShowCategoryDropdown(false);
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700",
                          selectedCategory === cat && "text-indigo-600 dark:text-indigo-400"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                {sortOptions.find((o) => o.value === sortBy)?.icon}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {sortOptions.find((o) => o.value === sortBy)?.label}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>
              {showSortDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-zinc-800 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-700 z-20 py-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700",
                          sortBy === option.value && "text-indigo-600 dark:text-indigo-400"
                        )}
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View Mode */}
            <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2",
                  viewMode === "grid"
                    ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                    : "bg-white dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700"
                )}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2",
                  viewMode === "list"
                    ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                    : "bg-white dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {components.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Library className="h-16 w-16 text-zinc-300 dark:text-zinc-600 mb-4" />
            <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              No components yet
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-6">
              Generate code in the Builder and click "Save to Library" to start building your component collection.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/builder">
                <Button className="gap-1.5">
                  <Code2 className="h-4 w-4" />
                  Open Builder
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                Import Components
              </Button>
            </div>
          </div>
        ) : filteredComponents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-4" />
            <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              No matches found
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredComponents.map((component) => (
              <ComponentGridCard
                key={component.id}
                component={component}
                isHovered={hoveredComponent === component.id}
                isEditing={editingComponent === component.id}
                editName={editName}
                showDeleteConfirm={showDeleteConfirm === component.id}
                onHover={(h) => setHoveredComponent(h ? component.id : null)}
                onSelect={() => setSelectedComponent(component)}
                onToggleFavorite={() => toggleFavorite(component.id)}
                onStartEdit={() => {
                  setEditingComponent(component.id);
                  setEditName(component.name);
                }}
                onEditName={setEditName}
                onSaveEdit={() => handleRename(component.id)}
                onCancelEdit={() => {
                  setEditingComponent(null);
                  setEditName("");
                }}
                onDuplicate={() => handleDuplicate(component.id)}
                onExport={() => handleExportComponent(component.id)}
                onShowDelete={() => setShowDeleteConfirm(component.id)}
                onConfirmDelete={() => handleDelete(component.id)}
                onCancelDelete={() => setShowDeleteConfirm(null)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredComponents.map((component) => (
              <ComponentListCard
                key={component.id}
                component={component}
                isEditing={editingComponent === component.id}
                editName={editName}
                showDeleteConfirm={showDeleteConfirm === component.id}
                onSelect={() => setSelectedComponent(component)}
                onToggleFavorite={() => toggleFavorite(component.id)}
                onStartEdit={() => {
                  setEditingComponent(component.id);
                  setEditName(component.name);
                }}
                onEditName={setEditName}
                onSaveEdit={() => handleRename(component.id)}
                onCancelEdit={() => {
                  setEditingComponent(null);
                  setEditName("");
                }}
                onDuplicate={() => handleDuplicate(component.id)}
                onExport={() => handleExportComponent(component.id)}
                onShowDelete={() => setShowDeleteConfirm(component.id)}
                onConfirmDelete={() => handleDelete(component.id)}
                onCancelDelete={() => setShowDeleteConfirm(null)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Preview Panel (hidden iframe for hover preview) */}
      <iframe
        ref={previewIframeRef}
        className="hidden"
        sandbox="allow-scripts"
        title="Preview"
      />

      {/* Component Detail Modal */}
      {selectedComponent && (
        <ComponentDetailModal
          component={selectedComponent}
          onClose={() => setSelectedComponent(null)}
          onExport={() => handleExportComponent(selectedComponent.id)}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-500" />
                <h3 className="font-semibold text-zinc-900 dark:text-white">
                  Import Components
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson("");
                  setImportError("");
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Paste JSON or upload a file
                </label>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder="Paste component JSON here..."
                  rows={8}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none font-mono"
                />
                {importError && (
                  <p className="mt-2 text-sm text-red-500">{importError}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <FileJson className="h-4 w-4" />
                  Upload JSON File
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson("");
                  setImportError("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!importJson.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Grid Card Component
function ComponentGridCard({
  component,
  isHovered,
  isEditing,
  editName,
  showDeleteConfirm,
  onHover,
  onSelect,
  onToggleFavorite,
  onStartEdit,
  onEditName,
  onSaveEdit,
  onCancelEdit,
  onDuplicate,
  onExport,
  onShowDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  component: LibraryComponent;
  isHovered: boolean;
  isEditing: boolean;
  editName: string;
  showDeleteConfirm: boolean;
  onHover: (h: boolean) => void;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onStartEdit: () => void;
  onEditName: (name: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onShowDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden transition-all",
        isHovered
          ? "border-indigo-300 dark:border-indigo-500 shadow-lg"
          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
      )}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => {
        onHover(false);
        setShowMenu(false);
      }}
    >
      {/* Thumbnail */}
      <div
        className="aspect-video bg-zinc-100 dark:bg-zinc-800 cursor-pointer relative overflow-hidden"
        onClick={onSelect}
      >
        {component.thumbnail ? (
          <img
            src={component.thumbnail}
            alt={component.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Code2 className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          </div>
        )}

        {/* Hover overlay */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="p-2 rounded-full bg-white/90 text-zinc-800 hover:bg-white"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => onEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveEdit();
                    if (e.key === "Escape") onCancelEdit();
                  }}
                  className="flex-1 px-2 py-0.5 text-sm rounded border border-indigo-500 bg-white dark:bg-zinc-800 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={onSaveEdit}
                  className="p-1 text-green-600 hover:text-green-700"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onCancelEdit}
                  className="p-1 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h3 className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                  {component.name}
                </h3>
                {component.prompt && (
                  <span title="AI Generated">
                    <Sparkles className="h-3 w-3 text-amber-500 flex-shrink-0" />
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                {component.language.toUpperCase()}
              </span>
              <span className="text-[10px] text-zinc-400">
                {component.category}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleFavorite}
              className={cn(
                "p-1 rounded",
                component.isFavorite
                  ? "text-amber-500"
                  : "text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
              )}
            >
              <Star
                className="h-4 w-4"
                fill={component.isFavorite ? "currentColor" : "none"}
              />
            </button>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute top-full right-0 mt-1 w-36 bg-white dark:bg-zinc-800 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-700 z-20 py-1">
                    <button
                      onClick={() => {
                        onStartEdit();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        onDuplicate();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicate
                    </button>
                    <button
                      onClick={() => {
                        onExport();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </button>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                    <button
                      onClick={() => {
                        onShowDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400">
          <span>Used {component.timesUsed}x</span>
          <span>
            {new Date(component.dateModified).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 flex flex-col items-center justify-center p-4">
          <Trash2 className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300 text-center mb-3">
            Delete "{component.name}"?
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onCancelDelete}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// List Card Component
function ComponentListCard({
  component,
  isEditing,
  editName,
  showDeleteConfirm,
  onSelect,
  onToggleFavorite,
  onStartEdit,
  onEditName,
  onSaveEdit,
  onCancelEdit,
  onDuplicate,
  onExport,
  onShowDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  component: LibraryComponent;
  isEditing: boolean;
  editName: string;
  showDeleteConfirm: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onStartEdit: () => void;
  onEditName: (name: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onShowDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className="relative flex items-center gap-4 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600">
      {/* Thumbnail */}
      <div
        className="w-20 h-14 rounded bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 cursor-pointer overflow-hidden"
        onClick={onSelect}
      >
        {component.thumbnail ? (
          <img
            src={component.thumbnail}
            alt={component.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Code2 className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="flex-1 max-w-xs px-2 py-0.5 text-sm rounded border border-indigo-500 bg-white dark:bg-zinc-800 focus:outline-none"
              autoFocus
            />
            <button
              onClick={onSaveEdit}
              className="p-1 text-green-600 hover:text-green-700"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3
              className="font-medium text-sm text-zinc-900 dark:text-white truncate cursor-pointer hover:text-indigo-600"
              onClick={onSelect}
            >
              {component.name}
            </h3>
            {component.prompt && (
              <span title="AI Generated">
                <Sparkles className="h-3 w-3 text-amber-500" />
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
            {component.language.toUpperCase()}
          </span>
          <span className="text-[10px] text-zinc-400">{component.category}</span>
          <span className="text-[10px] text-zinc-400">
            Used {component.timesUsed}x
          </span>
          <span className="text-[10px] text-zinc-400">
            {new Date(component.dateModified).toLocaleDateString()}
          </span>
        </div>
        {component.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
            {component.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleFavorite}
          className={cn(
            "p-1.5 rounded",
            component.isFavorite
              ? "text-amber-500"
              : "text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
          )}
        >
          <Star
            className="h-4 w-4"
            fill={component.isFavorite ? "currentColor" : "none"}
          />
        </button>
        <button
          onClick={onStartEdit}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <Edit3 className="h-4 w-4" />
        </button>
        <button
          onClick={onDuplicate}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={onExport}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={onShowDelete}
          className="p-1.5 rounded text-zinc-400 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 rounded-lg flex items-center justify-center gap-4 px-4">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Delete "{component.name}"?
          </span>
          <Button size="sm" variant="ghost" onClick={onCancelDelete}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirmDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

// Component Detail Modal
function ComponentDetailModal({
  component,
  onClose,
  onExport,
}: {
  component: LibraryComponent;
  onClose: () => void;
  onExport: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (previewRef.current) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(component.code);
        doc.close();
      }
    }
  }, [component.code]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                {component.name}
              </h3>
              {component.prompt && (
                <span title="AI Generated">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </span>
              )}
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              {component.language.toUpperCase()}
            </span>
            <span className="text-xs text-zinc-400">{component.category}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setActiveTab("preview")}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "preview"
                ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <Eye className="h-4 w-4 inline mr-1.5" />
            Preview
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "code"
                ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <Code2 className="h-4 w-4 inline mr-1.5" />
            Code
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "preview" ? (
            <iframe
              ref={previewRef}
              className="w-full h-full bg-white"
              sandbox="allow-scripts"
              title="Component Preview"
            />
          ) : (
            <pre className="h-full overflow-auto p-4 text-sm font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800">
              {component.code}
            </pre>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-4">
              {component.description && <span>{component.description}</span>}
              {component.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  {component.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span>Used {component.timesUsed}x</span>
              <span>
                Created {new Date(component.dateCreated).toLocaleDateString()}
              </span>
            </div>
          </div>
          {component.prompt && (
            <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 uppercase">
                  Generated with prompt
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {component.prompt}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
