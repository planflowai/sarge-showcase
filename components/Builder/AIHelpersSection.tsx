"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Plus, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilderHelpersStore } from "@/lib/stores/builderHelpersStore";
import HelperCard from "./HelperCard";
import AddHelperModal from "./AddHelperModal";

interface AIHelpersSectionProps {
  className?: string;
}

export default function AIHelpersSection({ className }: AIHelpersSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Store
  const {
    helpers,
    activeHelperId,
    hydrated,
    hydrate,
    toggleHelperPause,
    removeHelper,
  } = useBuilderHelpersStore();

  // Hydrate on mount
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return (
    <div className={cn("border-b border-zinc-300 dark:border-zinc-800", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            AI Helpers
          </span>
          {helpers.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              {helpers.length}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-zinc-500 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          {/* Helper Cards */}
          {helpers.length > 0 ? (
            <div className="space-y-2">
              {helpers.map((helper) => (
                <HelperCard
                  key={helper.id}
                  helper={helper}
                  isRunning={activeHelperId === helper.id}
                  onPause={() => toggleHelperPause(helper.id)}
                  onRemove={() => removeHelper(helper.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-zinc-500 dark:text-zinc-400">
              <Bot className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p>No helpers added yet</p>
              <p className="text-[10px] mt-1">
                Add reviewers, judges, or designers
              </p>
            </div>
          )}

          {/* Add Helper Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              "border border-dashed border-zinc-300 dark:border-zinc-700",
              "text-zinc-600 dark:text-zinc-400",
              "hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400",
              "hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Helper
          </button>
        </div>
      )}

      {/* Add Helper Modal */}
      <AddHelperModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
