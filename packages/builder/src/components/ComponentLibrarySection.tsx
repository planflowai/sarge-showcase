"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Library,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  Code2,
  Star,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@sarge/core";
import {
  useComponentLibraryStore,
  COMPONENT_CATEGORIES,
  type ComponentCategory,
  type LibraryComponent,
} from "../stores/componentLibraryStore";

interface ComponentLibrarySectionProps {
  onInsertComponent: (code: string, componentId: string) => void;
  onUseAsBase: (code: string, componentId: string) => void;
  onInsertWithAI?: (code: string, componentId: string, modifications: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function ComponentLibrarySection({
  onInsertComponent,
  onUseAsBase,
  onInsertWithAI,
  collapsed = false,
  onToggleCollapse,
}: ComponentLibrarySectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Recent"])
  );
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  const components = useComponentLibraryStore((s) => s.components);
  const hydrated = useComponentLibraryStore((s) => s.hydrated);
  const hydrate = useComponentLibraryStore((s) => s.hydrate);
  const incrementUsage = useComponentLibraryStore((s) => s.incrementUsage);
  const getRecent = useComponentLibraryStore((s) => s.getRecent);
  const getFavorites = useComponentLibraryStore((s) => s.getFavorites);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Filter components by search
  const filteredComponents = useMemo(() => {
    if (!searchQuery.trim()) return components;
    const query = searchQuery.toLowerCase();
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.tags.some((t) => t.toLowerCase().includes(query))
    );
  }, [components, searchQuery]);

  // Group by category
  const componentsByCategory = useMemo(() => {
    const grouped: Record<string, LibraryComponent[]> = {};
    for (const cat of COMPONENT_CATEGORIES) {
      grouped[cat] = filteredComponents.filter((c) => c.category === cat);
    }
    return grouped;
  }, [filteredComponents]);

  // Recent and favorites
  const recentComponents = useMemo(() => getRecent(5), [getRecent, components]);
  const favoriteComponents = useMemo(() => getFavorites(), [getFavorites, components]);

  const handleInsert = (component: LibraryComponent) => {
    incrementUsage(component.id);
    onInsertComponent(component.code, component.id);
  };

  const handleUseAsBase = (component: LibraryComponent) => {
    incrementUsage(component.id);
    onUseAsBase(component.code, component.id);
  };

  const handleInsertWithAI = (component: LibraryComponent, modifications: string) => {
    incrementUsage(component.id);
    onInsertWithAI?.(component.code, component.id, modifications);
  };

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between px-2 py-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <div className="flex items-center gap-1.5">
          <Library className="h-3.5 w-3.5" />
          <span className="font-medium">Components</span>
          <span className="text-[10px] text-zinc-400">({components.length})</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700">
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <div className="flex items-center gap-1.5">
          <Library className="h-3.5 w-3.5 text-indigo-500" />
          <span className="font-medium">Components</span>
          <span className="text-[10px] text-zinc-400">({components.length})</span>
        </div>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {/* Search */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search components..."
            className="w-full h-7 pl-7 pr-2 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Component list */}
      <div className="max-h-[60vh] overflow-y-auto px-2">
        {components.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Library className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No components saved yet
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Generate code in Builder and click "Save to Library"
            </p>
          </div>
        ) : (
          <>
            {/* Recent section */}
            {recentComponents.length > 0 && !searchQuery && (
              <div className="mb-2">
                <button
                  onClick={() => toggleCategory("Recent")}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  {expandedCategories.has("Recent") ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <Clock className="h-3 w-3" />
                  Recent
                </button>
                {expandedCategories.has("Recent") && (
                  <div className="space-y-0.5 pl-2">
                    {recentComponents.map((comp) => (
                      <ComponentCard
                        key={comp.id}
                        component={comp}
                        isHovered={hoveredComponent === comp.id}
                        onHover={(h) => setHoveredComponent(h ? comp.id : null)}
                        onInsert={() => handleInsert(comp)}
                        onUseAsBase={() => handleUseAsBase(comp)}
                        onInsertWithAI={onInsertWithAI ? (mods) => handleInsertWithAI(comp, mods) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Favorites section */}
            {favoriteComponents.length > 0 && !searchQuery && (
              <div className="mb-2">
                <button
                  onClick={() => toggleCategory("Favorites")}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  {expandedCategories.has("Favorites") ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <Star className="h-3 w-3 text-amber-500" />
                  Favorites
                </button>
                {expandedCategories.has("Favorites") && (
                  <div className="space-y-0.5 pl-2">
                    {favoriteComponents.map((comp) => (
                      <ComponentCard
                        key={comp.id}
                        component={comp}
                        isHovered={hoveredComponent === comp.id}
                        onHover={(h) => setHoveredComponent(h ? comp.id : null)}
                        onInsert={() => handleInsert(comp)}
                        onUseAsBase={() => handleUseAsBase(comp)}
                        onInsertWithAI={onInsertWithAI ? (mods) => handleInsertWithAI(comp, mods) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Categories */}
            {COMPONENT_CATEGORIES.map((category) => {
              const categoryComponents = componentsByCategory[category];
              if (categoryComponents.length === 0) return null;

              return (
                <div key={category} className="mb-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {category}
                    <span className="text-zinc-400">({categoryComponents.length})</span>
                  </button>
                  {expandedCategories.has(category) && (
                    <div className="space-y-0.5 pl-2">
                      {categoryComponents.map((comp) => (
                        <ComponentCard
                          key={comp.id}
                          component={comp}
                          isHovered={hoveredComponent === comp.id}
                          onHover={(h) => setHoveredComponent(h ? comp.id : null)}
                          onInsert={() => handleInsert(comp)}
                          onUseAsBase={() => handleUseAsBase(comp)}
                          onInsertWithAI={onInsertWithAI ? (mods) => handleInsertWithAI(comp, mods) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

    </div>
  );
}

// Component card for the sidebar
function ComponentCard({
  component,
  isHovered,
  onHover,
  onInsert,
  onUseAsBase,
  onInsertWithAI,
}: {
  component: LibraryComponent;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
  onInsert: () => void;
  onUseAsBase: () => void;
  onInsertWithAI?: (modifications: string) => void;
}) {
  const [showAIInput, setShowAIInput] = useState(false);
  const [aiModifications, setAiModifications] = useState("");

  const handleAISubmit = () => {
    if (aiModifications.trim() && onInsertWithAI) {
      onInsertWithAI(aiModifications.trim());
      setAiModifications("");
      setShowAIInput(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-md transition-colors",
        isHovered || showAIInput
          ? "bg-indigo-50 dark:bg-indigo-500/10"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      )}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => {
        if (!showAIInput) onHover(false);
      }}
    >
      <div className="flex items-start gap-3 px-3 py-3 cursor-pointer">
        {/* Thumbnail or placeholder */}
        <div className="w-12 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {component.thumbnail ? (
            <img
              src={component.thumbnail}
              alt={component.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Code2 className="h-5 w-5 text-zinc-400" />
          )}
        </div>

        {/* Name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {component.name}
            </span>
            {component.isFavorite && (
              <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{component.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 font-medium">
              {component.language.toUpperCase()}
            </span>
            {component.prompt && (
              <span title="AI Generated" className="flex items-center gap-0.5 text-[10px] text-amber-500">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      {(isHovered || showAIInput) && !showAIInput && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInsert();
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            title="Insert into current artifact"
          >
            Insert
          </button>
          {onInsertWithAI && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAIInput(true);
              }}
              className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600"
              title="Insert with AI modifications"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUseAsBase();
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-600 text-white hover:bg-zinc-700"
            title="Load as base for iteration"
          >
            Base
          </button>
        </div>
      )}

      {/* AI Modification Input */}
      {showAIInput && (
        <div className="px-2 pb-2">
          <div className="flex items-center gap-1 mt-1">
            <input
              type="text"
              value={aiModifications}
              onChange={(e) => setAiModifications(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAISubmit();
                if (e.key === "Escape") {
                  setShowAIInput(false);
                  setAiModifications("");
                }
              }}
              placeholder="e.g., change color to blue..."
              className="flex-1 h-6 px-2 text-[10px] rounded border border-amber-300 dark:border-amber-500 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500"
              autoFocus
            />
            <button
              onClick={handleAISubmit}
              disabled={!aiModifications.trim()}
              className="h-6 px-2 text-[9px] font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go
            </button>
            <button
              onClick={() => {
                setShowAIInput(false);
                setAiModifications("");
              }}
              className="h-6 px-1 text-zinc-400 hover:text-zinc-600"
            >
              <Plus className="h-3 w-3 rotate-45" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
