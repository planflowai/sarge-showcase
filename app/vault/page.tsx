"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Upload,
  Search,
  Grid3X3,
  List,
  Trash2,
  Download,
  X,
  ChevronLeft,
  Tag,
  FileText,
  Image,
  Table,
  FileCode,
  Archive,
  File,
  Plus,
  Filter,
  ArrowUpDown,
  Eye,
  Edit3,
  Save,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useVaultStore,
  formatFileSize,
  type VaultItem,
  type FileCategory,
} from "@/lib/stores/vaultStore";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";

type ViewMode = "grid" | "list";

const CATEGORY_CONFIG: Record<FileCategory | 'all', { label: string; icon: typeof FileText; color: string }> = {
  all: { label: "All Files", icon: FolderOpen, color: "text-gray-500 dark:text-zinc-400" },
  image: { label: "Images", icon: Image, color: "text-blue-500 dark:text-blue-400" },
  document: { label: "Documents", icon: FileText, color: "text-orange-500 dark:text-orange-400" },
  spreadsheet: { label: "Spreadsheets", icon: Table, color: "text-green-500 dark:text-green-400" },
  text: { label: "Text", icon: FileText, color: "text-purple-500 dark:text-purple-400" },
  code: { label: "Code", icon: FileCode, color: "text-cyan-500 dark:text-cyan-400" },
  archive: { label: "Archives", icon: Archive, color: "text-amber-500 dark:text-amber-400" },
  other: { label: "Other", icon: File, color: "text-gray-500 dark:text-zinc-400" },
};

function getCategoryIcon(category: FileCategory) {
  const config = CATEGORY_CONFIG[category];
  return config?.icon || File;
}

function getCategoryColor(category: FileCategory) {
  const config = CATEGORY_CONFIG[category];
  return config?.color || "text-gray-500 dark:text-zinc-400";
}

export default function VaultPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isDragging, setIsDragging] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<VaultItem | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Store state
  const items = useVaultStore((s) => s.items);
  const searchQuery = useVaultStore((s) => s.searchQuery);
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery);
  const filterCategory = useVaultStore((s) => s.filterCategory);
  const setFilterCategory = useVaultStore((s) => s.setFilterCategory);
  const sortBy = useVaultStore((s) => s.sortBy);
  const setSortBy = useVaultStore((s) => s.setSortBy);
  const sortOrder = useVaultStore((s) => s.sortOrder);
  const setSortOrder = useVaultStore((s) => s.setSortOrder);
  const isUploading = useVaultStore((s) => s.isUploading);
  const addItem = useVaultStore((s) => s.addItem);
  const removeItem = useVaultStore((s) => s.removeItem);
  const updateItem = useVaultStore((s) => s.updateItem);
  const getFilteredItems = useVaultStore((s) => s.getFilteredItems);
  const getItemContent = useVaultStore((s) => s.getItemContent);
  const clearVault = useVaultStore((s) => s.clearVault);

  const filteredItems = useMemo(() => getFilteredItems(), [items, searchQuery, filterCategory, sortBy, sortOrder, getFilteredItems]);

  // Calculate storage usage
  const totalSize = useMemo(() => items.reduce((acc, item) => acc + item.size, 0), [items]);
  const maxSize = 50 * 1024 * 1024; // 50MB

  // File upload handlers
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      await addItem(file);
    }
  }, [addItem]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  }, [handleFiles]);

  const handleDownload = useCallback((item: VaultItem) => {
    const content = getItemContent(item.id);
    if (!content) return;

    const link = document.createElement('a');
    if (item.isBase64) {
      link.href = content;
    } else {
      const blob = new Blob([content], { type: item.mimeType });
      link.href = URL.createObjectURL(blob);
    }
    link.download = item.originalName;
    link.click();
  }, [getItemContent]);

  const handleSaveEdit = useCallback(() => {
    if (!editingItem) return;
    updateItem(editingItem.id, {
      name: editingItem.name,
      tags: editingItem.tags,
      notes: editingItem.notes,
    });
    setEditingItem(null);
  }, [editingItem, updateItem]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <ErrorBoundary fallbackTitle="Vault Error">
    <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Knowledge Vault</h1>
              <p className="text-sm text-gray-500 dark:text-zinc-500">
                {items.length} files | {formatFileSize(totalSize)} / {formatFileSize(maxSize)} used
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearAllConfirm(true)}
              disabled={items.length === 0}
              className="text-gray-500 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Clear All
            </Button>
            <label>
              <input
                type="file"
                multiple
                onChange={handleFileInput}
                className="hidden"
                accept="image/*,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,.json,.xml,.md"
              />
              <Button
                asChild
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                <span>
                  <Plus className="h-4 w-4" />
                  Upload Files
                </span>
              </Button>
            </label>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-zinc-800 bg-gray-100/50 dark:bg-zinc-900/30 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search files, tags, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-md bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-sm text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-gray-400 dark:text-zinc-500 mr-1" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as FileCategory | 'all')}
              className="px-3 py-2 rounded-md bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-sm text-gray-900 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label} {categoryCounts[key] ? `(${categoryCounts[key]})` : '(0)'}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            <ArrowUpDown className="h-4 w-4 text-gray-400 dark:text-zinc-500 mr-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size' | 'type')}
              className="px-3 py-2 rounded-md bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-sm text-gray-900 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="h-9 w-9 p-0"
            >
              <ArrowUpDown className={cn("h-4 w-4", sortOrder === 'desc' && "rotate-180")} />
            </Button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border border-gray-300 dark:border-zinc-700 overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"
                  : "bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 transition-colors border-l border-gray-300 dark:border-zinc-700",
                viewMode === "list"
                  ? "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"
                  : "bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "min-h-full transition-colors rounded-lg",
            isDragging && "bg-indigo-500/10 ring-2 ring-indigo-500/50 ring-dashed"
          )}
        >
          {/* Empty State */}
          {filteredItems.length === 0 && !isUploading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Upload className="h-10 w-10 text-gray-400 dark:text-zinc-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-zinc-300 mb-2">
                {searchQuery || filterCategory !== 'all' ? "No files match your filter" : "Drop files here to upload"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4 text-center max-w-md">
                Supports images (JPEG, PNG, GIF), documents (PDF, Word, Excel), text files, code, and more.
                <br />
                Max 10MB per file, 50MB total storage.
              </p>
              <label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
                <Button asChild variant="outline" className="cursor-pointer">
                  <span>
                    <Upload className="h-4 w-4 mr-1.5" />
                    Browse Files
                  </span>
                </Button>
              </label>
            </div>
          )}

          {/* Uploading State */}
          {isUploading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm">
                <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-700 dark:text-zinc-300">Uploading...</span>
              </div>
            </div>
          )}

          {/* Grid View */}
          {viewMode === "grid" && filteredItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredItems.map((item) => {
                const Icon = getCategoryIcon(item.category);
                const iconColor = getCategoryColor(item.category);
                const isImage = item.category === 'image';
                const previewUrl = isImage ? getItemContent(item.id) : null;

                return (
                  <div
                    key={item.id}
                    className="group relative rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors overflow-hidden shadow-sm"
                  >
                    {/* Preview/Icon Area */}
                    <div
                      className="aspect-square flex items-center justify-center bg-gray-100 dark:bg-zinc-800/50 cursor-pointer"
                      onClick={() => setPreviewItem(item)}
                    >
                      {isImage && previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Icon className={cn("h-12 w-12", iconColor)} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-zinc-200 truncate" title={item.originalName}>
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                        {formatFileSize(item.size)}
                      </p>
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-[10px] text-gray-600 dark:text-zinc-400">
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 2 && (
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500">+{item.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions Overlay */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="p-1.5 rounded bg-white/90 dark:bg-zinc-900/90 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 shadow-sm"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingItem({ ...item })}
                        className="p-1.5 rounded bg-white/90 dark:bg-zinc-900/90 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 shadow-sm"
                        title="Edit"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownload(item)}
                        className="p-1.5 rounded bg-white/90 dark:bg-zinc-900/90 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 shadow-sm"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 rounded bg-white/90 dark:bg-zinc-900/90 text-gray-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 shadow-sm"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && filteredItems.length > 0 && (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const Icon = getCategoryIcon(item.category);
                const iconColor = getCategoryColor(item.category);

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
                  >
                    <div className={cn("flex-shrink-0 p-2 rounded-md bg-gray-100 dark:bg-zinc-800", iconColor)}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-zinc-200 truncate">
                        {item.originalName}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                        {formatFileSize(item.size)} | {new Date(item.createdAt).toLocaleDateString()}
                        {item.notes && ` | ${item.notes.slice(0, 50)}${item.notes.length > 50 ? '...' : ''}`}
                      </p>
                    </div>

                    {item.tags.length > 0 && (
                      <div className="flex-shrink-0 flex gap-1">
                        {item.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-xs text-gray-600 dark:text-zinc-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex-shrink-0 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewItem(item)}
                        className="h-8 w-8 p-0 text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingItem({ ...item })}
                        className="h-8 w-8 p-0 text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(item)}
                        className="h-8 w-8 p-0 text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setItemToDelete(item)}
                        className="h-8 w-8 p-0 text-gray-400 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Edit File Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditingItem(null)} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">
                  <Tag className="h-3.5 w-3.5 inline mr-1" />
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editingItem.tags.join(", ")}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean)
                  })}
                  className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                  placeholder="research, important, 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Notes</label>
                <textarea
                  value={editingItem.notes}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Add notes about this file..."
                />
              </div>

              <div className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800/50 rounded p-3">
                <p><strong>Original:</strong> {editingItem.originalName}</p>
                <p><strong>Type:</strong> {editingItem.mimeType}</p>
                <p><strong>Size:</strong> {formatFileSize(editingItem.size)}</p>
                <p><strong>Added:</strong> {new Date(editingItem.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-zinc-700 px-5 py-4">
              <Button variant="ghost" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 px-5 py-4 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{previewItem.name}</h2>
                <p className="text-sm text-gray-500 dark:text-zinc-500">{previewItem.originalName} | {formatFileSize(previewItem.size)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(previewItem)}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewItem(null)} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <FilePreview item={previewItem} getContent={getItemContent} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Item Confirmation */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            removeItem(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        title="Delete File"
        description={`Are you sure you want to delete "${itemToDelete?.name || itemToDelete?.originalName}"? This action cannot be undone.`}
        variant="destructive"
        confirmText="Delete"
      />

      {/* Clear All Confirmation */}
      <ConfirmDialog
        isOpen={showClearAllConfirm}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={() => {
          clearVault();
          setShowClearAllConfirm(false);
        }}
        title="Clear All Files"
        description={`Are you sure you want to delete all ${items.length} files from the vault? This action cannot be undone.`}
        variant="destructive"
        confirmText="Clear All"
      />
    </div>
    </ErrorBoundary>
  );
}

// File Preview Component
function FilePreview({
  item,
  getContent,
}: {
  item: VaultItem;
  getContent: (id: string) => string | null;
}) {
  const content = getContent(item.id);

  if (!content) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-zinc-500">
        Unable to load preview
      </div>
    );
  }

  // Image preview
  if (item.category === 'image') {
    return (
      <div className="flex items-center justify-center">
        <img
          src={content}
          alt={item.name}
          className="max-w-full max-h-[70vh] object-contain rounded-lg"
        />
      </div>
    );
  }

  // Text/Code preview
  if (item.category === 'text' || item.category === 'code') {
    return (
      <pre className="p-4 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-300 text-sm overflow-auto max-h-[70vh] whitespace-pre-wrap font-mono">
        {content}
      </pre>
    );
  }

  // PDF - show as embedded object or link
  if (item.mimeType === 'application/pdf') {
    return (
      <div className="space-y-4">
        <iframe
          src={content}
          className="w-full h-[70vh] rounded-lg border border-gray-200 dark:border-zinc-700"
          title={item.name}
        />
      </div>
    );
  }

  // Spreadsheet / Documents - show download prompt
  if (item.category === 'document' || item.category === 'spreadsheet') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-zinc-500">
        <FileText className="h-16 w-16 mb-4 text-gray-400 dark:text-zinc-600" />
        <p className="text-lg font-medium text-gray-700 dark:text-zinc-300 mb-2">Preview not available</p>
        <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
          Download this file to view its contents in the appropriate application.
        </p>
        <p className="text-xs text-gray-400 dark:text-zinc-600">
          {item.mimeType}
        </p>
      </div>
    );
  }

  // Default
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-zinc-500">
      <File className="h-16 w-16 mb-4 text-gray-400 dark:text-zinc-600" />
      <p>Preview not available for this file type</p>
    </div>
  );
}
