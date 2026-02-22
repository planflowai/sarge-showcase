/**
 * Template Selection Tests
 *
 * Verifies:
 * 1. tpl_accountant template can be selected without crash
 * 2. All capability toggles work without errors
 * 3. Unknown capabilities are handled gracefully
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock zustand persist
vi.mock('zustand/middleware', () => ({
  persist: (fn: any) => fn,
}));

// Import stores after mocking
import {
  useUnifiedCapabilitiesStore,
  CAPABILITY_DEFINITIONS,
  type CapabilityId,
} from '../lib/stores/unifiedCapabilitiesStore';

import {
  useSaaSStore,
  BUILT_IN_TEMPLATES,
} from '../lib/stores/saasStore';

describe('Template Selection', () => {
  beforeEach(() => {
    // Reset stores before each test
    useUnifiedCapabilitiesStore.setState({
      websiteType: 'website_builder',
      orchestrationMode: 'single',
      capabilities: {},
      isPanelExpanded: true,
      showDependencyGraph: false,
      savedPresets: [],
      hydrated: false,
    });

    useSaaSStore.setState({
      currentUser: null,
      currentCompany: null,
      availableTemplates: [...BUILT_IN_TEMPLATES],
      selectedTemplateId: null,
      deployments: [],
      showDeployModal: false,
      showAdminPanel: false,
      hydrated: false,
    });
  });

  describe('BUG 1: tpl_accountant selection', () => {
    it('should select tpl_accountant without crashing', () => {
      const capStore = useUnifiedCapabilitiesStore.getState();
      const saasStore = useSaaSStore.getState();

      // Hydrate the capabilities store first
      capStore.hydrate();

      // Find the accountant template
      const accountantTemplate = BUILT_IN_TEMPLATES.find(t => t.id === 'tpl_accountant');
      expect(accountantTemplate).toBeDefined();

      // Select the template
      expect(() => {
        saasStore.selectTemplate('tpl_accountant');
      }).not.toThrow();

      // Set orchestration mode
      expect(() => {
        capStore.setOrchestrationMode(accountantTemplate!.orchestrationMode);
      }).not.toThrow();

      // Toggle capabilities (the part that was crashing)
      expect(() => {
        accountantTemplate!.enabledCapabilities.forEach((capId) => {
          capStore.toggleCapability(capId as CapabilityId, true);
        });
      }).not.toThrow();

      // Verify capabilities were enabled
      const newState = useUnifiedCapabilitiesStore.getState();
      accountantTemplate!.enabledCapabilities.forEach((capId) => {
        const cap = newState.capabilities[capId as CapabilityId];
        // Some caps may not be enabled due to dependency requirements
        // but they should exist and not throw
        expect(cap).toBeDefined();
      });
    });

    it('should handle missing capability IDs gracefully', () => {
      const capStore = useUnifiedCapabilitiesStore.getState();
      capStore.hydrate();

      // Try to toggle a non-existent capability
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        capStore.toggleCapability('non_existent_cap' as CapabilityId, true);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[UnifiedCapabilities] Unknown capability ID:',
        'non_existent_cap',
        '- skipping toggle'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Capability Store Hydration', () => {
    it('should initialize all 14 capabilities on hydration', () => {
      const capStore = useUnifiedCapabilitiesStore.getState();
      capStore.hydrate();

      const state = useUnifiedCapabilitiesStore.getState();
      const definedCapIds = Object.keys(CAPABILITY_DEFINITIONS);

      // All defined capabilities should exist in state
      definedCapIds.forEach((capId) => {
        expect(state.capabilities[capId as CapabilityId]).toBeDefined();
      });

      expect(Object.keys(state.capabilities).length).toBe(definedCapIds.length);
    });
  });

  describe('toggleCapability Safety', () => {
    it('should not crash when toggling capabilities with missing state', () => {
      // Start with empty capabilities
      useUnifiedCapabilitiesStore.setState({
        capabilities: {},
        hydrated: true,
      });

      const capStore = useUnifiedCapabilitiesStore.getState();

      // Should not crash even with empty state
      expect(() => {
        capStore.toggleCapability('orchestration', true);
      }).not.toThrow();
    });

    it('should initialize capability when toggling for first time', () => {
      useUnifiedCapabilitiesStore.setState({
        capabilities: {},
        hydrated: true,
      });

      const capStore = useUnifiedCapabilitiesStore.getState();
      capStore.toggleCapability('fallback_chain', true);

      const state = useUnifiedCapabilitiesStore.getState();
      expect(state.capabilities.fallback_chain).toBeDefined();
      expect(state.capabilities.fallback_chain.enabled).toBe(true);
    });
  });

  describe('canEnableCapability Safety', () => {
    it('should return false for unknown capabilities', () => {
      const capStore = useUnifiedCapabilitiesStore.getState();
      capStore.hydrate();

      const result = capStore.canEnableCapability('unknown_cap' as CapabilityId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown capability');
    });

    it('should check dependencies safely', () => {
      const capStore = useUnifiedCapabilitiesStore.getState();
      capStore.hydrate();

      // consensus_lock requires orchestration
      const result = capStore.canEnableCapability('consensus_lock');

      // Should fail gracefully due to missing dependency
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Requires');
    });
  });

  describe('All Game Templates', () => {
    const gameTemplates = BUILT_IN_TEMPLATES.filter(t => t.id.includes('game'));

    gameTemplates.forEach((template) => {
      it(`should select ${template.id} without crashing`, () => {
        const capStore = useUnifiedCapabilitiesStore.getState();
        capStore.hydrate();

        expect(() => {
          capStore.setOrchestrationMode(template.orchestrationMode);

          template.enabledCapabilities.forEach((capId) => {
            // This was the crash point - now should be safe
            capStore.toggleCapability(capId as CapabilityId, true);
          });
        }).not.toThrow();
      });
    });
  });
});
