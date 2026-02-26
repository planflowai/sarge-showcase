"use client";

/**
 * AI Capabilities Panel
 *
 * The user's vision: "I add agentic AI like I'm changing colors"
 *
 * This panel supports two modes:
 * - USER MODE: Template picker (TemplatePickerPanel)
 * - ADMIN MODE: Full brick editor (this component)
 *
 * SaaS Tiers:
 * - Free: Template picker only
 * - Pro: Template picker + custom templates
 * - Enterprise: Full admin access to brick editor
 */

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Download,
  Upload,
  RotateCcw,
  Save,
  AlertCircle,
  CheckCircle2,
  Info,
  Settings,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useUnifiedCapabilitiesStore,
  CAPABILITY_DEFINITIONS,
  WEBSITE_TEMPLATES,
  getCapabilitiesByCategory,
  getActiveCapabilitiesSummary,
  type CapabilityId,
  type WebsiteType,
} from "@/lib/stores/unifiedCapabilitiesStore";
import { useSaaSStore } from "@/lib/stores/saasStore";
import TemplatePickerPanel, { TemplatePickerMini } from "./TemplatePickerPanel";

type PanelMode = 'user' | 'admin';

interface AICapabilitiesPanelProps {
  className?: string;
  forceMode?: PanelMode;  // Override auto-detection for testing
}

export default function AICapabilitiesPanel({ className, forceMode }: AICapabilitiesPanelProps) {
  const [expanded, setExpanded] = useState(true); // Expanded to show template buttons
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showAdminMode, setShowAdminMode] = useState(false);

  // Get user role from SaaS store
  const { currentUser, canAccessAdmin, hydrated: saasHydrated, hydrate: hydrateSaaS } = useSaaSStore();

  // Determine panel mode
  const isAdmin = forceMode === 'admin' || (forceMode !== 'user' && canAccessAdmin());
  const showTemplatePicker = !isAdmin || !showAdminMode;

  const {
    websiteType,
    orchestrationMode,
    capabilities,
    isPanelExpanded,
    savedPresets,
    hydrated,
    hydrate,
    setWebsiteType,
    applyTemplateForType,
    setOrchestrationMode,
    toggleCapability,
    canEnableCapability,
    saveCurrentAsPreset,
    loadPreset,
    deletePreset,
    exportConfig,
    resetToDefaults,
  } = useUnifiedCapabilitiesStore();

  // Hydrate on mount
  useEffect(() => {
    if (!hydrated) hydrate();
    if (!saasHydrated) hydrateSaaS();
  }, [hydrated, hydrate, saasHydrated, hydrateSaaS]);

  // Category labels for user-friendly display
  const categoryLabels: Record<string, { label: string; description: string }> = {
    orchestration: {
      label: "🎭 AI Modes",
      description: "How models work together",
    },
    monitoring: {
      label: "🛡️ Monitoring",
      description: "Track and log activity",
    },
    verification: {
      label: "✅ Verification",
      description: "Fact-check and validate",
    },
    safety: {
      label: "🔒 Safety",
      description: "Protection and rollback",
    },
    content: {
      label: "📝 Content",
      description: "Generate docs and lore",
    },
    assets: {
      label: "🎨 Assets",
      description: "Create sprites and art",
    },
  };

  const groupedCapabilities = getCapabilitiesByCategory();
  const template = WEBSITE_TEMPLATES[websiteType];
  const activeSummary = getActiveCapabilitiesSummary(capabilities);

  // Count active capabilities
  const activeCount = Object.values(capabilities).filter((c) => c.enabled).length;

  const handleSavePreset = () => {
    if (presetName.trim()) {
      saveCurrentAsPreset(presetName.trim());
      setPresetName("");
      setShowSavePreset(false);
    }
  };

  const handleExport = () => {
    const config = exportConfig();
    const blob = new Blob([config], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-capabilities-${websiteType}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // For non-admin users, show the template picker
  if (showTemplatePicker) {
    return (
      <div className={cn("border-b border-zinc-300 dark:border-zinc-800 relative", className)}>
        {/* Header - compact */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors bg-zinc-100 dark:bg-zinc-900"
        >
          <div className="flex items-center gap-1.5">
            <Rocket className="h-3 w-3 text-purple-500" />
            <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
              AI Templates
            </span>
            {activeCount > 0 && (
              <span className="text-[8px] px-1 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-medium">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {/* Admin toggle (only visible to admins) */}
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdminMode(true);
                }}
                className="p-0.5 text-zinc-400 hover:text-purple-500 transition-colors"
                title="Switch to Admin Mode"
              >
                <Settings className="h-2.5 w-2.5" />
              </button>
            )}
            {expanded ? (
              <ChevronUp className="h-3 w-3 text-zinc-500" />
            ) : (
              <ChevronDown className="h-3 w-3 text-zinc-500" />
            )}
          </div>
        </button>

        {/* Template Picker Content */}
        {expanded && (
          <TemplatePickerPanel
            onDeploy={(template) => {
              console.log('[AICapabilitiesPanel] Deploying template:', template.name);
            }}
          />
        )}
      </div>
    );
  }

  // ADMIN MODE: Full capability brick editor
  return (
    <div className={cn("border-b border-zinc-300 dark:border-zinc-800 relative", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors bg-zinc-100 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            AI Capabilities
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500 text-white font-semibold">
            ADMIN
          </span>
          {activeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-medium">
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Back to template picker */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAdminMode(false);
            }}
            className="p-1 text-zinc-400 hover:text-purple-500 transition-colors"
            title="Back to Template Picker"
          >
            <Rocket className="h-3.5 w-3.5" />
          </button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Website Type Selector */}
          <div className="space-y-2 pb-3 border-b border-zinc-200 dark:border-zinc-700">
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
              What are you building?
            </label>
            <select
              value={websiteType}
              onChange={(e) => {
                const type = e.target.value as WebsiteType;
                setWebsiteType(type);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {Object.values(WEBSITE_TEMPLATES).map((t) => (
                <option key={t.type} value={t.type}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>

            {/* Apply Template Button */}
            {websiteType !== "custom" && (
              <button
                onClick={() => applyTemplateForType(websiteType)}
                className="w-full mt-2 px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors border border-purple-200 dark:border-purple-500/30"
              >
                Apply recommended settings
              </button>
            )}
          </div>

          {/* Orchestration Mode (Radio) */}
          <div className="space-y-2 pb-3 border-b border-zinc-200 dark:border-zinc-700">
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
              AI Mode
            </label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { mode: "single", label: "Single", desc: "One AI" },
                { mode: "sequential", label: "Pipeline", desc: "Chain" },
                { mode: "parallel", label: "Debate", desc: "2+ AIs" },
                { mode: "parallel_judge", label: "Trio", desc: "+ Judge" },
              ].map(({ mode, label, desc }) => (
                <label
                  key={mode}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                    orchestrationMode === mode
                      ? "bg-purple-100 dark:bg-purple-500/20 border-2 border-purple-400 dark:border-purple-500"
                      : "bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                  )}
                >
                  <input
                    type="radio"
                    name="orchestrationMode"
                    value={mode}
                    checked={orchestrationMode === mode}
                    onChange={() => setOrchestrationMode(mode as typeof orchestrationMode)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {label}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Capability Categories */}
          {Object.entries(groupedCapabilities).map(([category, caps]) => {
            // Skip orchestration category since we handle it above
            if (category === "orchestration") return null;
            // Skip empty categories
            if (caps.length === 0) return null;

            const catInfo = categoryLabels[category];
            if (!catInfo) return null;

            return (
              <div key={category} className="space-y-2">
                {/* Category Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    {catInfo.label}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {catInfo.description}
                  </span>
                </div>

                {/* Capability Items */}
                <div className="space-y-1.5">
                  {caps
                    .filter((cap) => cap.id !== "orchestration") // Already handled
                    .map((cap) => {
                      const state = capabilities[cap.id];
                      const validation = canEnableCapability(cap.id);
                      const isCritical = template.criticalCapabilities.includes(cap.id);
                      const isSuggested = template.suggestedCapabilities.includes(cap.id);

                      return (
                        <CapabilityToggle
                          key={cap.id}
                          id={cap.id}
                          name={cap.name}
                          description={cap.description}
                          icon={cap.icon}
                          enabled={state.enabled}
                          canEnable={validation.allowed}
                          disabledReason={validation.reason}
                          isCritical={isCritical}
                          isSuggested={isSuggested}
                          onToggle={(enabled) => toggleCapability(cap.id, enabled)}
                        />
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* Saved Presets */}
          {savedPresets.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                Saved Presets
              </label>
              <div className="space-y-1.5">
                {savedPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
                    <button
                      onClick={() => loadPreset(preset.id)}
                      className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 font-medium"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="text-zinc-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Preset Input */}
          {showSavePreset && (
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
              />
              <button
                onClick={handleSavePreset}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex gap-2">
              <button
                onClick={() => setShowSavePreset(!showSavePreset)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors"
                title="Save as preset"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save</span>
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors"
                title="Export config"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </button>
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
                title="Reset to defaults"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Active Summary */}
          <div className="text-center py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg">
            {activeSummary}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CAPABILITY TOGGLE COMPONENT
// ============================================================================

interface CapabilityToggleProps {
  id: CapabilityId;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  canEnable: boolean;
  disabledReason?: string;
  isCritical: boolean;
  isSuggested: boolean;
  onToggle: (enabled: boolean) => void;
}

function CapabilityToggle({
  id,
  name,
  description,
  icon,
  enabled,
  canEnable,
  disabledReason,
  isCritical,
  isSuggested,
  onToggle,
}: CapabilityToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const isDisabled = !canEnable && !enabled;

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all border",
        enabled
          ? "bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/40"
          : isDisabled
          ? "bg-zinc-100 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700 opacity-50"
          : "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-500/50"
      )}
    >
      {/* Icon */}
      <span className="text-base flex-shrink-0">{icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              enabled
                ? "text-purple-700 dark:text-purple-300"
                : "text-zinc-700 dark:text-zinc-300"
            )}
          >
            {name}
          </span>

          {/* Badges */}
          {isCritical && (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full">
              Required
            </span>
          )}
          {isSuggested && !isCritical && (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
              Suggested
            </span>
          )}
        </div>
      </div>

      {/* Info icon with tooltip */}
      <div
        className="relative flex-shrink-0"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="h-4 w-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-help transition-colors" />
        {showTooltip && (
          <div className="absolute right-0 bottom-full mb-2 w-52 p-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-lg shadow-xl z-50 leading-relaxed">
            {description}
            {disabledReason && (
              <div className="mt-2 pt-2 border-t border-zinc-700 dark:border-zinc-300 text-yellow-400 dark:text-yellow-600 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{disabledReason}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toggle Switch */}
      <button
        onClick={() => !isDisabled && onToggle(!enabled)}
        disabled={isDisabled}
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
          enabled
            ? "bg-purple-500"
            : isDisabled
            ? "bg-zinc-300 dark:bg-zinc-600 cursor-not-allowed"
            : "bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200",
            enabled ? "left-5" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}
