"use client";

/**
 * Template Picker Panel
 *
 * User-facing template selector - compact 2x2 grid layout.
 * No nested scrollbars.
 *
 * When user clicks "Use [Template]":
 * 1. Opens NewProjectModal to get project name
 * 2. Checks for folder conflicts
 * 3. Creates folder with starter files
 * 4. Applies template capabilities
 */

import { useState, useEffect } from "react";
import {
  Rocket,
  Check,
  ChevronRight,
  Play,
  Gamepad2,
  Globe,
} from "lucide-react";
import { cn } from "@sarge/core";
import {
  useSaaSStore,
  type SaaSTemplate,
} from "@sarge/core";
import {
  useUnifiedCapabilitiesStore,
  CAPABILITY_DEFINITIONS,
  type CapabilityId,
} from "@sarge/core";
import NewProjectModal from "./NewProjectModal";

interface TemplatePickerPanelProps {
  className?: string;
  onDeploy?: (template: SaaSTemplate) => void;
  onProjectCreated?: (projectPath: string, projectName: string) => void;
}

export default function TemplatePickerPanel({
  className,
  onDeploy,
  onProjectCreated,
}: TemplatePickerPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'websites' | 'games'>('websites');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const {
    selectTemplate,
    getAvailableTemplates,
    setShowDeployModal,
    hydrated,
    hydrate,
  } = useSaaSStore();

  const {
    setOrchestrationMode,
    toggleCapability,
    capabilities,
  } = useUnifiedCapabilitiesStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const rawTemplates = getAvailableTemplates();
  const allTemplates = Array.isArray(rawTemplates) ? rawTemplates : [];

  // Separate website and game templates with bulletproof safety checks
  const websiteTemplates = allTemplates.filter(t => {
    if (!t || typeof t !== 'object') return false;
    if (!t.id || typeof t.id !== 'string') return false;
    return !String(t.id).includes('game');
  });
  const gameTemplates = allTemplates.filter(t => {
    if (!t || typeof t !== 'object') return false;
    if (!t.id || typeof t.id !== 'string') return false;
    return String(t.id).includes('game');
  });

  const templates = activeTab === 'websites' ? websiteTemplates : gameTemplates;
  const selectedTemplate = selectedId ? allTemplates.find((t) => t.id === selectedId) : null;

  const handleSelectTemplate = (template: SaaSTemplate) => {
    if (!template?.id) {
      console.warn('[TemplatePickerPanel] Invalid template - no ID');
      return;
    }

    console.log('[TemplatePickerPanel] Selecting template:', template.id, template.name);
    console.log('[TemplatePickerPanel] Template capabilities:', template.enabledCapabilities);

    setSelectedId(template.id);
    selectTemplate(template.id);

    if (template.orchestrationMode) {
      setOrchestrationMode(template.orchestrationMode);
    }

    // SAFE: Disable all capabilities first (with null checks)
    const currentCaps = capabilities || {};
    Object.keys(currentCaps).forEach((capId) => {
      const id = capId as CapabilityId;
      // Only disable if it's actually enabled and is a valid capability
      if (currentCaps[id]?.enabled && CAPABILITY_DEFINITIONS[id]) {
        try {
          toggleCapability(id, false);
        } catch (err) {
          console.warn('[TemplatePickerPanel] Error disabling capability:', id, err);
        }
      }
    });

    // SAFE: Enable template capabilities with validation
    if (template.enabledCapabilities && Array.isArray(template.enabledCapabilities)) {
      template.enabledCapabilities.forEach((capId) => {
        const typedCapId = capId as CapabilityId;
        // Only enable if it's a known capability
        if (CAPABILITY_DEFINITIONS[typedCapId]) {
          try {
            toggleCapability(typedCapId, true);
          } catch (err) {
            console.warn('[TemplatePickerPanel] Error enabling capability:', capId, err);
          }
        } else {
          console.warn('[TemplatePickerPanel] Unknown capability in template:', capId);
        }
      });
    }

    console.log('[TemplatePickerPanel] Template applied successfully');
  };

  const handleDeploy = () => {
    if (selectedTemplate) {
      // Open the new project modal instead of just setting a flag
      setShowNewProjectModal(true);
    }
  };

  const handleProjectCreated = (projectPath: string, projectName: string) => {
    console.log('[TemplatePickerPanel] Project created:', projectPath, projectName);
    // Notify parent components
    onDeploy?.(selectedTemplate!);
    onProjectCreated?.(projectPath, projectName);
    // Close modal is handled inside NewProjectModal
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tab Switcher - compact */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab('websites')}
          className={cn(
            "flex-1 flex items-center justify-center gap-0.5 px-1 py-1 text-[9px] font-medium transition-colors",
            activeTab === 'websites'
              ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 -mb-px"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          <Globe className="h-2.5 w-2.5" />
          Web
        </button>
        <button
          onClick={() => setActiveTab('games')}
          className={cn(
            "flex-1 flex items-center justify-center gap-0.5 px-1 py-1 text-[9px] font-medium transition-colors",
            activeTab === 'games'
              ? "text-pink-600 dark:text-pink-400 border-b-2 border-pink-500 -mb-px"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          <Gamepad2 className="h-2.5 w-2.5" />
          Games
        </button>
      </div>

      {/* Template Grid - 2x2 */}
      <div className="p-1.5 grid grid-cols-2 gap-1">
        {templates.slice(0, 4).map((template) => {
          const isSelected = selectedId === template.id;

          return (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className={cn(
                "flex flex-col items-center justify-center p-1.5 rounded border transition-all text-center",
                isSelected
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10 ring-1 ring-purple-500"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-500/50 bg-white dark:bg-zinc-800/50"
              )}
            >
              {/* Icon */}
              <span className="text-xl">{template.icon}</span>

              {/* Name - truncated */}
              <span className={cn(
                "text-[9px] font-medium leading-tight truncate w-full",
                isSelected
                  ? "text-purple-700 dark:text-purple-300"
                  : "text-zinc-700 dark:text-zinc-300"
              )}>
                {template.name.split(' ')[0]}
              </span>

              {/* Check mark if selected */}
              {isSelected && (
                <Check className="h-2 w-2 text-purple-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Template Action */}
      {selectedTemplate && (
        <div className="px-1.5 pb-1.5">
          <button
            onClick={handleDeploy}
            className="w-full flex items-center justify-center gap-1 py-1 px-2 text-[9px] font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded hover:from-purple-700 hover:to-indigo-700 transition-all"
          >
            <Play className="h-2.5 w-2.5" />
            Use {selectedTemplate.name.split(' ')[0]}
          </button>
        </div>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        template={selectedTemplate ?? null}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}

/**
 * Mini version for embedding in sidebar
 */
export function TemplatePickerMini({ className }: { className?: string }) {
  const { getSelectedTemplate } = useSaaSStore();
  const template = getSelectedTemplate();

  if (!template) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-zinc-500", className)}>
        <Rocket className="h-3 w-3" />
        <span>No template selected</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm">{template.icon}</span>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
        {template.name}
      </span>
    </div>
  );
}
