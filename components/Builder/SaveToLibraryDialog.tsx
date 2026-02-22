"use client";

import { useState, useCallback } from "react";
import { X, Save, Tag, Folder, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useComponentLibraryStore,
  COMPONENT_CATEGORIES,
  type ComponentCategory,
  detectCodeLanguage,
} from "@/lib/stores/componentLibraryStore";
import { useUIStore } from "@/lib/stores/uiStore";

interface SaveToLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  prompt?: string;
  thumbnail?: string | null;
}

export default function SaveToLibraryDialog({
  isOpen,
  onClose,
  code,
  prompt = "",
  thumbnail = null,
}: SaveToLibraryDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ComponentCategory>("Custom");
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const addComponent = useComponentLibraryStore((s) => s.addComponent);
  const showToast = useUIStore((s) => s.showToast);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !code.trim()) return;

    setSaving(true);
    try {
      const language = detectCodeLanguage(code);
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const id = addComponent({
        name: name.trim(),
        category,
        tags: tagList,
        description: description.trim(),
        code,
        language,
        prompt,
        thumbnail,
      });

      showToast({
        message: `Saved "${name}" to library`,
        type: "success",
      });

      // Reset form
      setName("");
      setCategory("Custom");
      setTags("");
      setDescription("");
      onClose();
    } catch (error) {
      console.error("Failed to save component:", error);
      showToast({
        message: "Failed to save component",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [name, code, category, tags, description, prompt, thumbnail, addComponent, showToast, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Save className="h-5 w-5 text-indigo-500" />
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Save to Library
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Component Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Hero Section, Login Form, Nav Bar"
              className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5" />
              Category
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {COMPONENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-2 py-1.5 text-xs rounded-md transition-colors",
                    category === cat
                      ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/50"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Tags (comma-separated)
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., dark, responsive, animated"
              className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this component does..."
              rows={2}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Prompt info (if available) */}
          {prompt && (
            <div className="rounded-md bg-zinc-100 dark:bg-zinc-800 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                  Generated with prompt
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                {prompt}
              </p>
            </div>
          )}

          {/* Code preview */}
          <div className="rounded-md bg-zinc-900 p-3 max-h-24 overflow-hidden">
            <pre className="text-[10px] text-zinc-400 font-mono whitespace-pre-wrap line-clamp-4">
              {code.slice(0, 500)}
              {code.length > 500 && "..."}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || !code.trim() || saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Component
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
