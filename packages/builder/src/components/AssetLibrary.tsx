"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  X, Search, Upload, Loader2, Trash2, FolderPlus, Image, FileText,
  Type, File, Package,
} from "lucide-react";
import { useAssetLibraryStore, type AssetItem, type AssetFilterType } from "../stores/assetLibraryStore";
import { useBuilderStore } from "../stores/builderStore";
import { cn, useUIStore } from "@sarge/core";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FILTER_TABS: { id: AssetFilterType; label: string; icon: typeof Image }[] = [
  { id: "all", label: "All", icon: Package },
  { id: "images", label: "Images", icon: Image },
  { id: "documents", label: "Docs", icon: FileText },
  { id: "fonts", label: "Fonts", icon: Type },
  { id: "other", label: "Other", icon: File },
];

function getTypeIcon(assetType: string) {
  switch (assetType) {
    case "image": return "🖼️";
    case "document": return "📄";
    case "font": return "🔤";
    default: return "📦";
  }
}

// ─── Asset Card ──────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  projectPath,
}: {
  asset: AssetItem;
  projectPath: string | null;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const { deleteAsset, copyToProject } = useAssetLibraryStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const ok = await deleteAsset(asset.relativePath);
    if (ok) {
      showToast({ message: `Deleted "${asset.name}"`, type: "success" });
    } else {
      showToast({ message: "Failed to delete", type: "error" });
    }
    setIsDeleting(false);
  };

  const handleCopy = async () => {
    if (!projectPath) {
      showToast({ message: "Open a project first", type: "warning" });
      return;
    }
    setIsCopying(true);
    const result = await copyToProject(asset.relativePath, projectPath);
    if (result.success) {
      showToast({ message: `Added to ${result.destRelative}`, type: "success" });
    } else {
      showToast({ message: result.error || "Copy failed", type: "error" });
    }
    setIsCopying(false);
  };

  return (
    <div className="group rounded-xl border border-zinc-700/80 bg-zinc-800/60 hover:border-zinc-600 hover:bg-zinc-800/90 transition-all p-3 flex flex-col gap-2">
      {/* Thumbnail / Icon */}
      <div className="w-full aspect-square rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden">
        {asset.isImage && asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-3xl">{getTypeIcon(asset.assetType)}</span>
        )}
      </div>

      {/* Name + size */}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zinc-200 truncate" title={asset.name}>{asset.name}</p>
        <p className="text-[10px] text-zinc-500">{formatSize(asset.size)}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-auto">
        <button
          onClick={handleCopy}
          disabled={isCopying || !projectPath}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
            projectPath
              ? "bg-indigo-600/80 hover:bg-indigo-500 text-white"
              : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
          )}
          title={projectPath ? "Copy to project's assets/ folder" : "Open a project first"}
        >
          {isCopying ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderPlus className="h-3 w-3" />}
          Add
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
          title="Delete asset"
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AssetLibrary() {
  const showToast = useUIStore((s) => s.showToast);
  const {
    isOpen, assets, isLoading, isUploading,
    searchQuery, filterType, totalSize,
    close, loadAssets, uploadFiles,
    setSearchQuery, setFilterType,
  } = useAssetLibraryStore();

  const projectPath = useBuilderStore((s) => s.projectPath);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // ─── Filtered assets ────────────────────────────────────────────────────
  const filteredAssets = useMemo(() => {
    let list = assets;
    if (filterType !== "all") {
      const typeMap: Record<string, string> = {
        images: "image", documents: "document", fonts: "font", other: "other",
      };
      list = list.filter((a) => a.assetType === typeMap[filterType]);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [assets, filterType, searchQuery]);

  // ─── Upload handlers ────────────────────────────────────────────────────
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (!files || (files instanceof FileList && files.length === 0)) return;
    const count = await uploadFiles(files);
    if (count > 0) {
      showToast({ message: `Uploaded ${count} file${count > 1 ? "s" : ""}`, type: "success" });
    }
  }, [uploadFiles, showToast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Try FileSystem Access API for folder support
    const items = e.dataTransfer.items;
    const files: File[] = [];

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = (item as any).webkitGetAsEntry?.();
        if (entry) {
          if (entry.isFile) {
            const file = item.getAsFile();
            if (file) files.push(file);
          } else if (entry.isDirectory) {
            // Read files recursively from dropped folder
            const dirFiles = await readDirectoryRecursive(entry);
            files.push(...dirFiles);
          }
        } else {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
    } else if (e.dataTransfer.files.length > 0) {
      files.push(...Array.from(e.dataTransfer.files));
    }

    if (files.length > 0) {
      await handleUpload(files);
    }
  }, [handleUpload]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 w-[720px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">

        {/* ═══ Header ═══ */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xl">📂</span>
            <div>
              <h2 className="text-lg font-bold text-white">Assets Library</h2>
              <p className="text-[10px] text-zinc-500">
                {assets.length} files · {formatSize(totalSize)}
              </p>
            </div>
          </div>

          <div className="relative w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={close}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ═══ Filter tabs ═══ */}
        <div className="px-6 pt-3 flex items-center gap-1.5 flex-shrink-0 border-b border-zinc-800 pb-0">
          {FILTER_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilterType(id)}
              className={cn(
                "px-3 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 -mb-px flex items-center gap-1.5",
                filterType === id
                  ? "border-indigo-500 text-indigo-300 bg-indigo-500/10"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ═══ Content ═══ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
              isDragging
                ? "border-indigo-400 bg-indigo-500/10"
                : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/30"
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
                <p className="text-xs text-zinc-400">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className={cn("h-6 w-6", isDragging ? "text-indigo-400" : "text-zinc-500")} />
                <p className="text-xs text-zinc-400">
                  {isDragging ? "Drop files here" : "Drag files here or click to upload"}
                </p>
                <p className="text-[10px] text-zinc-600">Images, PDFs, fonts, documents — up to 50 MB each</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = ""; }}
            />
          </div>

          {/* Asset grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-sm text-zinc-500">Loading assets...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-zinc-700 mb-4" />
              {searchQuery || filterType !== "all" ? (
                <>
                  <p className="text-zinc-400 font-semibold">No matching assets</p>
                  <button
                    onClick={() => { setSearchQuery(""); setFilterType("all"); }}
                    className="mt-3 text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-zinc-400 font-semibold">No assets yet</p>
                  <p className="text-sm text-zinc-600 mt-1">Upload files to build your shared asset library</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredAssets.map((asset) => (
                <AssetCard key={asset.relativePath} asset={asset} projectPath={projectPath} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Utility: read directory entries recursively ─────────────────────────────

function readDirectoryRecursive(dirEntry: any): Promise<File[]> {
  return new Promise((resolve) => {
    const reader = dirEntry.createReader();
    const files: File[] = [];

    function readEntries() {
      reader.readEntries(async (entries: any[]) => {
        if (entries.length === 0) {
          resolve(files);
          return;
        }
        for (const entry of entries) {
          if (entry.isFile) {
            const file = await new Promise<File>((res) => entry.file(res));
            files.push(file);
          } else if (entry.isDirectory) {
            const subFiles = await readDirectoryRecursive(entry);
            files.push(...subFiles);
          }
        }
        readEntries(); // Continue reading (readEntries returns max 100 at a time)
      });
    }
    readEntries();
  });
}
