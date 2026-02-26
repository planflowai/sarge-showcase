"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";

/**
 * Component Library Store
 *
 * Stores reusable UI components built in the Builder.
 * Each component includes code, metadata, thumbnail, and the prompt that generated it.
 */

export type ComponentCategory =
  | "Navigation"
  | "Cards"
  | "Forms"
  | "Heroes"
  | "Footers"
  | "Modals"
  | "Tables"
  | "Charts"
  | "Buttons"
  | "Layouts"
  | "Custom";

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  "Navigation",
  "Cards",
  "Forms",
  "Heroes",
  "Footers",
  "Modals",
  "Tables",
  "Charts",
  "Buttons",
  "Layouts",
  "Custom",
];

export interface LibraryComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  tags: string[];
  description: string;
  code: string; // Full HTML/React code
  language: "html" | "react" | "vue" | "svelte" | "other";
  prompt: string; // The prompt that generated it
  thumbnail: string | null; // Base64 screenshot or null
  dateCreated: number;
  dateModified: number;
  timesUsed: number;
  isFavorite: boolean;
}

interface ComponentLibraryState {
  components: LibraryComponent[];
  hydrated: boolean;

  // CRUD operations
  addComponent: (component: Omit<LibraryComponent, "id" | "dateCreated" | "dateModified" | "timesUsed" | "isFavorite">) => string;
  updateComponent: (id: string, updates: Partial<Omit<LibraryComponent, "id" | "dateCreated">>) => void;
  deleteComponent: (id: string) => void;
  duplicateComponent: (id: string) => string | null;

  // Usage tracking
  incrementUsage: (id: string) => void;
  toggleFavorite: (id: string) => void;

  // Queries
  getComponent: (id: string) => LibraryComponent | undefined;
  getComponentsByCategory: (category: ComponentCategory) => LibraryComponent[];
  searchComponents: (query: string) => LibraryComponent[];
  getFavorites: () => LibraryComponent[];
  getMostUsed: (limit?: number) => LibraryComponent[];
  getRecent: (limit?: number) => LibraryComponent[];

  // Import/Export
  exportLibrary: () => string;
  exportComponent: (id: string) => string | null;
  importLibrary: (json: string) => { success: boolean; imported: number; errors: string[] };
  importComponent: (json: string) => { success: boolean; id?: string; error?: string };

  // Hydration
  hydrate: () => void;
}

export const useComponentLibraryStore = create<ComponentLibraryState>()(
  persist(
    (set, get) => ({
      components: [],
      hydrated: false,

      hydrate: () => {
        set({ hydrated: true });
      },

      addComponent: (componentData) => {
        const id = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();

        const newComponent: LibraryComponent = {
          ...componentData,
          id,
          dateCreated: now,
          dateModified: now,
          timesUsed: 0,
          isFavorite: false,
        };

        set({ components: [...get().components, newComponent] });
        return id;
      },

      updateComponent: (id, updates) => {
        set({
          components: get().components.map((c) =>
            c.id === id
              ? { ...c, ...updates, dateModified: Date.now() }
              : c
          ),
        });
      },

      deleteComponent: (id) => {
        set({ components: get().components.filter((c) => c.id !== id) });
      },

      duplicateComponent: (id) => {
        const original = get().components.find((c) => c.id === id);
        if (!original) return null;

        const newId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();

        const duplicate: LibraryComponent = {
          ...original,
          id: newId,
          name: `${original.name} (Copy)`,
          dateCreated: now,
          dateModified: now,
          timesUsed: 0,
          isFavorite: false,
        };

        set({ components: [...get().components, duplicate] });
        return newId;
      },

      incrementUsage: (id) => {
        set({
          components: get().components.map((c) =>
            c.id === id
              ? { ...c, timesUsed: c.timesUsed + 1, dateModified: Date.now() }
              : c
          ),
        });
      },

      toggleFavorite: (id) => {
        set({
          components: get().components.map((c) =>
            c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
          ),
        });
      },

      getComponent: (id) => {
        return get().components.find((c) => c.id === id);
      },

      getComponentsByCategory: (category) => {
        return get().components.filter((c) => c.category === category);
      },

      searchComponents: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().components.filter(
          (c) =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.description.toLowerCase().includes(lowerQuery) ||
            c.tags.some((t) => t.toLowerCase().includes(lowerQuery)) ||
            c.category.toLowerCase().includes(lowerQuery)
        );
      },

      getFavorites: () => {
        return get().components.filter((c) => c.isFavorite);
      },

      getMostUsed: (limit = 10) => {
        return [...get().components]
          .sort((a, b) => b.timesUsed - a.timesUsed)
          .slice(0, limit);
      },

      getRecent: (limit = 10) => {
        return [...get().components]
          .sort((a, b) => b.dateModified - a.dateModified)
          .slice(0, limit);
      },

      exportLibrary: () => {
        const components = get().components;
        return JSON.stringify(
          {
            version: 1,
            exportDate: new Date().toISOString(),
            componentCount: components.length,
            components,
          },
          null,
          2
        );
      },

      exportComponent: (id) => {
        const component = get().components.find((c) => c.id === id);
        if (!component) return null;

        return JSON.stringify(
          {
            version: 1,
            exportDate: new Date().toISOString(),
            component,
          },
          null,
          2
        );
      },

      importLibrary: (json) => {
        const errors: string[] = [];
        let imported = 0;

        try {
          const data = JSON.parse(json);

          if (!data.components || !Array.isArray(data.components)) {
            return { success: false, imported: 0, errors: ["Invalid library format"] };
          }

          const newComponents: LibraryComponent[] = [];
          const existingIds = new Set(get().components.map((c) => c.id));

          for (const comp of data.components) {
            if (!comp.id || !comp.name || !comp.code) {
              errors.push(`Skipped invalid component: ${comp.name || "unnamed"}`);
              continue;
            }

            // Generate new ID if it already exists
            let newId = comp.id;
            if (existingIds.has(newId)) {
              newId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            }

            newComponents.push({
              ...comp,
              id: newId,
              dateModified: Date.now(),
            });
            imported++;
          }

          set({ components: [...get().components, ...newComponents] });
          return { success: true, imported, errors };
        } catch (e) {
          return { success: false, imported: 0, errors: ["Failed to parse JSON"] };
        }
      },

      importComponent: (json) => {
        try {
          const data = JSON.parse(json);
          const comp = data.component;

          if (!comp || !comp.name || !comp.code) {
            return { success: false, error: "Invalid component format" };
          }

          // Generate new ID
          const newId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const newComponent: LibraryComponent = {
            ...comp,
            id: newId,
            dateCreated: Date.now(),
            dateModified: Date.now(),
            timesUsed: 0,
            isFavorite: false,
          };

          set({ components: [...get().components, newComponent] });
          return { success: true, id: newId };
        } catch (e) {
          return { success: false, error: "Failed to parse JSON" };
        }
      },
    }),
    {
      name: "component-library",
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        components: state.components,
      }),
    }
  )
);

// Helper to capture thumbnail from iframe
export async function captureIframeThumbnail(
  iframe: HTMLIFrameElement,
  maxWidth = 300,
  maxHeight = 200
): Promise<string | null> {
  try {
    // Use html2canvas if available, otherwise return null
    // This is a placeholder - actual implementation would need html2canvas
    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    // For now, create a simple gradient placeholder
    // In production, you'd use html2canvas or similar
    const gradient = ctx.createLinearGradient(0, 0, maxWidth, maxHeight);
    gradient.addColorStop(0, "#6366f1");
    gradient.addColorStop(1, "#8b5cf6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, maxWidth, maxHeight);

    return canvas.toDataURL("image/png", 0.8);
  } catch (e) {
    console.error("Failed to capture thumbnail:", e);
    return null;
  }
}

// Helper to detect language from code
export function detectCodeLanguage(code: string): LibraryComponent["language"] {
  const trimmed = code.trim();

  // Check for React patterns
  if (
    trimmed.includes("import React") ||
    trimmed.includes("from 'react'") ||
    trimmed.includes('from "react"') ||
    trimmed.includes("useState") ||
    trimmed.includes("useEffect") ||
    /export\s+(default\s+)?function\s+\w+/.test(trimmed) ||
    /const\s+\w+\s*=\s*\(\)\s*=>\s*\{/.test(trimmed)
  ) {
    return "react";
  }

  // Check for Vue patterns
  if (
    trimmed.includes("<template>") ||
    trimmed.includes("<script setup>") ||
    trimmed.includes("defineComponent")
  ) {
    return "vue";
  }

  // Check for Svelte patterns
  if (
    trimmed.includes("<script>") &&
    (trimmed.includes("$:") || trimmed.includes("on:click"))
  ) {
    return "svelte";
  }

  // Check for HTML
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    (trimmed.includes("<body") && trimmed.includes("</body>")) ||
    (trimmed.includes("<div") && !trimmed.includes("import"))
  ) {
    return "html";
  }

  return "other";
}
