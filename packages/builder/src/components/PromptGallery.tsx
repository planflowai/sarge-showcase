"use client";

import { useState, useCallback, useMemo } from "react";
import { X, Search, Sparkles, Clock, Zap, Layers, Grid3X3 } from "lucide-react";
import { cn } from "@sarge/core";
import { Button } from "@/components/ui/button";
import {
  usePromptLibraryStore,
  PROMPT_CATEGORIES,
  PREBUILT_PROMPTS,
  type LibraryPrompt as Prompt,
  type PromptCategory,
  getComplexityColor,
  getOutputTypeLabel,
} from "@sarge/core";

interface PromptGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

// Output type icons
const outputTypeIcons: Record<string, React.ReactNode> = {
  'landing-page': <Layers className="w-3.5 h-3.5" />,
  'form': <Grid3X3 className="w-3.5 h-3.5" />,
  'dashboard': <Zap className="w-3.5 h-3.5" />,
  'component': <Sparkles className="w-3.5 h-3.5" />,
  'layout': <Layers className="w-3.5 h-3.5" />,
  'navigation': <Grid3X3 className="w-3.5 h-3.5" />,
  'page': <Layers className="w-3.5 h-3.5" />,
};

// Complexity labels
const complexityLabels = {
  simple: 'Simple',
  medium: 'Medium',
  complex: 'Complex',
};

function PromptCard({
  prompt,
  category,
  onClick,
}: {
  prompt: Prompt;
  category: PromptCategory;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col p-4 rounded-xl border text-left transition-all duration-300",
        "bg-zinc-900/50 border-zinc-700/50 hover:border-transparent",
        "hover:shadow-xl hover:-translate-y-1"
      )}
      style={{
        background: `linear-gradient(135deg, rgba(24,24,27,0.9) 0%, rgba(24,24,27,0.95) 100%)`,
      }}
    >
      {/* Gradient border effect on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
        style={{
          background: `linear-gradient(135deg, ${category.color}40, ${category.color}10)`,
          padding: '1px',
        }}
      />
      <div
        className="absolute inset-[1px] rounded-[11px] bg-zinc-900/95 -z-10 opacity-0 group-hover:opacity-100 transition-opacity"
      />

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Category icon with color */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${category.color}20` }}
        >
          {category.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
            {prompt.title}
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
            {prompt.description || prompt.prompt.slice(0, 60) + '...'}
          </p>
        </div>
      </div>

      {/* Preview hint */}
      {prompt.previewHint && (
        <div className="mb-3 px-2.5 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            {prompt.previewHint}
          </p>
        </div>
      )}

      {/* Footer with metadata */}
      <div className="flex items-center gap-2 mt-auto pt-3 border-t border-zinc-800/50">
        {/* Output type */}
        {prompt.outputType && (
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            {outputTypeIcons[prompt.outputType]}
            <span>{getOutputTypeLabel(prompt.outputType)}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Complexity badge */}
        {prompt.complexity && (
          <span
            className={cn(
              "px-2 py-0.5 text-[9px] font-medium rounded-full",
              getComplexityColor(prompt.complexity)
            )}
          >
            {complexityLabels[prompt.complexity]}
          </span>
        )}

        {/* Tech stack */}
        {prompt.techStack && prompt.techStack.length > 0 && (
          <div className="flex gap-1">
            {prompt.techStack.slice(0, 2).map((tech) => (
              <span
                key={tech}
                className="px-1.5 py-0.5 text-[8px] font-medium rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover glow effect */}
      <div
        className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-30 transition-opacity blur-xl -z-20"
        style={{ backgroundColor: category.color }}
      />
    </button>
  );
}

export default function PromptGallery({ isOpen, onClose, onSelectPrompt }: PromptGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { customPrompts, getAllPrompts } = usePromptLibraryStore();

  // Filter prompts based on search and category
  const filteredPrompts = useMemo(() => {
    let prompts = getAllPrompts();

    // Filter by category
    if (activeCategory) {
      prompts = prompts.filter(p => p.category === activeCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      prompts = prompts.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.prompt.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    return prompts;
  }, [activeCategory, searchQuery, getAllPrompts]);

  // Group prompts by category for display
  const groupedPrompts = useMemo(() => {
    if (activeCategory) {
      return { [activeCategory]: filteredPrompts };
    }

    const groups: Record<string, Prompt[]> = {};
    filteredPrompts.forEach(prompt => {
      if (!groups[prompt.category]) {
        groups[prompt.category] = [];
      }
      groups[prompt.category].push(prompt);
    });
    return groups;
  }, [filteredPrompts, activeCategory]);

  const handleSelectPrompt = useCallback((prompt: Prompt) => {
    onSelectPrompt(prompt.prompt);
    onClose();
  }, [onSelectPrompt, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* Modal container */}
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Prompt Gallery</h2>
              <p className="text-xs text-zinc-500">{filteredPrompts.length} prompts available</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search and filters */}
        <div className="px-6 py-4 border-b border-zinc-800/50 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                activeCategory === null
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
              )}
            >
              All Prompts
            </button>
            {PROMPT_CATEGORIES.filter(c => c.id !== 'custom' || customPrompts.length > 0).map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2",
                  activeCategory === category.id
                    ? "text-white shadow-lg"
                    : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                )}
                style={activeCategory === category.id ? { backgroundColor: category.color } : {}}
              >
                <span>{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {Object.keys(groupedPrompts).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">No prompts found</p>
              <p className="text-xs mt-1">Try a different search or category</p>
            </div>
          ) : (
            <div className="space-y-8">
              {PROMPT_CATEGORIES.filter(c => groupedPrompts[c.id]?.length > 0).map((category) => (
                <div key={category.id}>
                  {/* Category header (only show if not filtering by category) */}
                  {!activeCategory && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">{category.icon}</span>
                      <h3 className="text-sm font-semibold text-zinc-300">{category.name}</h3>
                      <span className="text-xs text-zinc-600">({groupedPrompts[category.id].length})</span>
                      <div className="flex-1 h-px bg-gradient-to-r from-zinc-800 to-transparent ml-4" />
                    </div>
                  )}

                  {/* Prompts grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedPrompts[category.id]?.map((prompt) => (
                      <PromptCard
                        key={prompt.id}
                        prompt={prompt}
                        category={category}
                        onClick={() => handleSelectPrompt(prompt)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-zinc-800/50 bg-zinc-900/50">
          <p className="text-[10px] text-zinc-600 text-center">
            Click a prompt to load it into the chat. Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">Esc</kbd> to close.
          </p>
        </div>
      </div>
    </div>
  );
}
