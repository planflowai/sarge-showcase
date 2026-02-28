/**
 * Asset Library Store
 *
 * State for the Master Assets Library overlay.
 * Not persisted — transient UI state.
 */

import { create } from "zustand";

export type AssetFilterType = "all" | "images" | "documents" | "fonts" | "other";

export interface AssetItem {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  mimeType: string;
  assetType: "image" | "document" | "font" | "other";
  isImage: boolean;
  lastModified: string;
  thumbnailUrl: string | null;
}

interface AssetLibraryState {
  isOpen: boolean;
  assets: AssetItem[];
  isLoading: boolean;
  isUploading: boolean;
  searchQuery: string;
  filterType: AssetFilterType;
  assetsDir: string;
  totalSize: number;

  // Actions
  open: () => void;
  close: () => void;
  loadAssets: () => Promise<void>;
  uploadFiles: (files: FileList | File[]) => Promise<number>;
  deleteAsset: (relativePath: string) => Promise<boolean>;
  copyToProject: (relativePath: string, projectPath: string, destFolder?: string) => Promise<{ success: boolean; destRelative?: string; error?: string }>;
  setSearchQuery: (q: string) => void;
  setFilterType: (t: AssetFilterType) => void;
}

export const useAssetLibraryStore = create<AssetLibraryState>((set, get) => ({
  isOpen: false,
  assets: [],
  isLoading: false,
  isUploading: false,
  searchQuery: "",
  filterType: "all",
  assetsDir: "",
  totalSize: 0,

  open: () => {
    set({ isOpen: true, searchQuery: "", filterType: "all" });
    get().loadAssets();
  },

  close: () => set({ isOpen: false }),

  loadAssets: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/builder/assets");
      const data = await res.json();
      if (data.success) {
        set({ assets: data.assets, assetsDir: data.assetsDir, totalSize: data.totalSize });
      }
    } catch {
      // silent
    } finally {
      set({ isLoading: false });
    }
  },

  uploadFiles: async (files) => {
    set({ isUploading: true });
    try {
      const formData = new FormData();
      const fileArr = Array.from(files);
      for (const file of fileArr) {
        formData.append("files", file);
      }

      const res = await fetch("/api/builder/assets", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        // Reload full list
        await get().loadAssets();
        return data.count || 0;
      }
      return 0;
    } catch {
      return 0;
    } finally {
      set({ isUploading: false });
    }
  },

  deleteAsset: async (relativePath) => {
    try {
      const res = await fetch("/api/builder/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relativePath }),
      });
      const data = await res.json();
      if (data.success) {
        set((s) => ({
          assets: s.assets.filter((a) => a.relativePath !== relativePath),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  copyToProject: async (relativePath, projectPath, destFolder) => {
    try {
      const res = await fetch("/api/builder/assets/copy-to-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetRelativePath: relativePath, projectPath, destFolder }),
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, destRelative: data.destRelative };
      }
      return { success: false, error: data.error || "Copy failed" };
    } catch {
      return { success: false, error: "Copy failed" };
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilterType: (t) => set({ filterType: t }),
}));
