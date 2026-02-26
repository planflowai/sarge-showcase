/**
 * useCapabilities Hook
 *
 * React hook for accessing and managing AI capabilities in components.
 * Provides a clean interface to the unified capabilities store and orchestrator.
 */

import { useMemo, useCallback } from 'react';
import {
  useUnifiedCapabilitiesStore,
  CAPABILITY_DEFINITIONS,
  WEBSITE_TEMPLATES,
  getActiveCapabilitiesSummary,
  type CapabilityId,
  type WebsiteType,
  type OrchestrationMode,
} from '../stores/unifiedCapabilitiesStore';
import {
  preprocessMessage,
  postprocessResponse,
  isCapabilityEnabled,
  getOrchestrationMode,
  buildEnhancedSystemPrompt,
} from '../capabilityOrchestrator';
import {
  useCapabilityEvent,
  useCapabilityEventValue,
  useCapabilityEmit,
} from '../capabilityEventBus';

/**
 * Main hook for capability management
 */
export function useCapabilities() {
  const store = useUnifiedCapabilitiesStore();

  // Get active capabilities as an array
  const activeCapabilities = useMemo(() => {
    return Object.entries(store.capabilities)
      .filter(([_, state]) => state.enabled)
      .map(([id]) => id as CapabilityId);
  }, [store.capabilities]);

  // Get capability definitions for active ones
  const activeDefinitions = useMemo(() => {
    return activeCapabilities.map((id) => CAPABILITY_DEFINITIONS[id]);
  }, [activeCapabilities]);

  // Get summary string
  const summary = useMemo(() => {
    return getActiveCapabilitiesSummary(store.capabilities);
  }, [store.capabilities]);

  // Get current template
  const currentTemplate = useMemo(() => {
    return WEBSITE_TEMPLATES[store.websiteType];
  }, [store.websiteType]);

  // Toggle capability with validation
  const toggleCapability = useCallback(
    (id: CapabilityId) => {
      const currentState = store.capabilities[id]?.enabled ?? false;
      store.toggleCapability(id, !currentState);
    },
    [store]
  );

  // Apply template and auto-enable suggested capabilities
  const applyTemplate = useCallback(
    (type: WebsiteType) => {
      store.applyTemplateForType(type);
    },
    [store]
  );

  return {
    // State
    websiteType: store.websiteType,
    orchestrationMode: store.orchestrationMode,
    capabilities: store.capabilities,
    activeCapabilities,
    activeDefinitions,
    summary,
    currentTemplate,

    // Actions
    setWebsiteType: store.setWebsiteType,
    setOrchestrationMode: store.setOrchestrationMode,
    toggleCapability,
    applyTemplate,
    canEnableCapability: store.canEnableCapability,

    // Presets
    savedPresets: store.savedPresets,
    saveCurrentAsPreset: store.saveCurrentAsPreset,
    loadPreset: store.loadPreset,
    deletePreset: store.deletePreset,

    // Export/Import
    exportConfig: store.exportConfig,
    importConfig: store.importConfig,
    resetToDefaults: store.resetToDefaults,
  };
}

/**
 * Hook for checking if specific capabilities are enabled
 */
export function useCapabilityCheck(...ids: CapabilityId[]): boolean[] {
  const { capabilities } = useUnifiedCapabilitiesStore();

  return useMemo(() => {
    return ids.map((id) => capabilities[id]?.enabled ?? false);
  }, [capabilities, ids]);
}

/**
 * Hook for preprocessing messages through capabilities
 */
export function useCapabilityPreprocess() {
  const emit = useCapabilityEmit();

  const preprocess = useCallback(
    async (message: string, context?: string, projectPath?: string) => {
      return preprocessMessage({
        message,
        context,
        projectPath,
      });
    },
    []
  );

  return preprocess;
}

/**
 * Hook for postprocessing responses through capabilities
 */
export function useCapabilityPostprocess() {
  const postprocess = useCallback(
    async (response: string, originalMessage: string) => {
      return postprocessResponse(response, { message: originalMessage });
    },
    []
  );

  return postprocess;
}

/**
 * Hook for getting enhanced system prompt based on capabilities
 */
export function useEnhancedSystemPrompt(basePrompt: string): string {
  const { capabilities } = useUnifiedCapabilitiesStore();

  return useMemo(() => {
    return buildEnhancedSystemPrompt(basePrompt);
  }, [basePrompt, capabilities]);
}

/**
 * Hook for listening to router decisions
 */
export function useRouterDecision() {
  const decision = useCapabilityEventValue('route:decision');
  return decision;
}

/**
 * Hook for listening to guardian health updates
 */
export function useGuardianHealth() {
  const health = useCapabilityEventValue('guardian:health_update');
  return health;
}

/**
 * Hook for capability icons display
 */
export function useCapabilityIcons(): Array<{ id: CapabilityId; icon: string; name: string }> {
  const { capabilities } = useUnifiedCapabilitiesStore();

  return useMemo(() => {
    return Object.entries(capabilities)
      .filter(([_, state]) => state.enabled)
      .map(([id]) => ({
        id: id as CapabilityId,
        icon: CAPABILITY_DEFINITIONS[id as CapabilityId].icon,
        name: CAPABILITY_DEFINITIONS[id as CapabilityId].name,
      }));
  }, [capabilities]);
}

/**
 * Hook for capability statistics
 */
export function useCapabilityStats() {
  const { capabilities, orchestrationMode } = useUnifiedCapabilitiesStore();

  return useMemo(() => {
    const enabled = Object.values(capabilities).filter((c) => c.enabled).length;
    const total = Object.keys(capabilities).length;

    const byCategory: Record<string, number> = {
      orchestration: 0,
      monitoring: 0,
      verification: 0,
      safety: 0,
      content: 0,
      assets: 0,
    };

    Object.entries(capabilities).forEach(([id, state]) => {
      if (state.enabled) {
        const def = CAPABILITY_DEFINITIONS[id as CapabilityId];
        byCategory[def.category]++;
      }
    });

    return {
      enabled,
      total,
      percentage: Math.round((enabled / total) * 100),
      byCategory,
      orchestrationMode,
    };
  }, [capabilities, orchestrationMode]);
}

export default useCapabilities;
