/**
 * Unified AI Capabilities Store
 *
 * Orchestrates all 11 AI systems as composable capability toggles.
 * Makes AI orchestration as easy as "changing colors" - the user's vision.
 *
 * Systems unified:
 * 1. AI Mode Store (Multi-Agent Orchestration)
 * 2. Thread Guardian (Conversation Monitoring)
 * 3. Consensus Handler (Fact Verification)
 * 4. Builder Auto-Router (Smart Model Selection)
 * 5. Fallback System (Reliability)
 * 6. Forensic Log (Audit Trail)
 * 7. Knowledge Vault (RAG Context)
 * 8. Web Search Tool (External Data)
 * 9. Debate Orchestration (Adversarial AI)
 * 10. Air-Gap Security
 * 11. Builder Helpers (Reviewers/Judges)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "../lib/utils/debouncedStorage";

// ============================================================================
// TYPES
// ============================================================================

export type WebsiteType =
  | 'chatbot'
  | 'mental_health'
  | 'medical'
  | 'legal'
  | 'financial'
  | 'ecommerce'
  | 'landing_page'
  | 'website_builder'
  | 'custom'
  // Game types
  | 'game_platformer'
  | 'game_rpg'
  | 'game_puzzle'
  | 'game_visual_novel'
  | 'game_card'
  | 'game_custom';

export type OrchestrationMode =
  | 'single'           // One model
  | 'sequential'       // Pipeline (generate → review → synthesize)
  | 'parallel'         // Multiple models, user picks
  | 'parallel_judge';  // Multiple models + judge synthesizes

export type CapabilityId =
  | 'orchestration'      // Which multi-agent mode
  | 'thread_guardian'    // Conversation monitoring
  | 'consensus_lock'     // Fact verification with truth anchors
  | 'auto_router'        // Smart model selection
  | 'fallback_chain'     // Retry on failure
  | 'forensic_log'       // Audit trail
  | 'knowledge_vault'    // RAG context
  | 'web_search'         // External data lookup
  | 'debate_mode'        // Adversarial AI
  | 'air_gap'            // No cloud calls
  | 'rollback'           // Undo bad generations
  // New bricks for games/content
  | 'document_gen'       // Generate docs, lore, narrative content
  | 'asset_generator'    // Generate sprites, backgrounds, UI elements
  | 'style_guide';       // Maintain art style consistency

export interface CapabilityDefinition {
  id: CapabilityId;
  name: string;
  description: string;
  icon: string;
  category: 'orchestration' | 'monitoring' | 'verification' | 'safety' | 'content' | 'assets';
  requires: CapabilityId[];        // Must be enabled first
  conflicts: CapabilityId[];       // Cannot be enabled together
  suggestedFor: WebsiteType[];     // Auto-suggest for these types
  criticalFor: WebsiteType[];      // Strongly recommended
  minAgents?: number;              // Minimum AI agents required (for judge, crosscheck, debate)
  outputs?: string[];              // What this brick produces (for asset generator)
  cost?: 'low' | 'medium' | 'high'; // Resource cost indicator
}

export interface CapabilityState {
  enabled: boolean;
  config?: Record<string, unknown>;  // Capability-specific settings
}

export interface WebsiteTemplate {
  type: WebsiteType;
  name: string;
  description: string;
  icon: string;
  suggestedCapabilities: CapabilityId[];
  criticalCapabilities: CapabilityId[];
}

// ============================================================================
// CAPABILITY DEFINITIONS
// ============================================================================

export const CAPABILITY_DEFINITIONS: Record<CapabilityId, CapabilityDefinition> = {
  orchestration: {
    id: 'orchestration',
    name: 'Multi-Agent Mode',
    description: 'How AI agents work together (single, debate, trio + judge)',
    icon: '🎭',
    category: 'orchestration',
    requires: [],
    conflicts: [],
    suggestedFor: ['chatbot', 'mental_health', 'medical', 'legal', 'financial'],
    criticalFor: ['medical', 'legal'],
  },
  thread_guardian: {
    id: 'thread_guardian',
    name: 'Thread Guardian',
    description: 'Monitors conversations, tracks facts, detects contradictions',
    icon: '🛡️',
    category: 'monitoring',
    requires: [],
    conflicts: ['debate_mode'],  // Excluded from Debate mode per architecture doc
    suggestedFor: ['chatbot', 'mental_health', 'medical', 'legal'],
    criticalFor: ['mental_health', 'chatbot'],
  },
  consensus_lock: {
    id: 'consensus_lock',
    name: 'Consensus Lock',
    description: 'Multi-pass fact verification with truth anchor locking',
    icon: '🔒',
    category: 'verification',
    requires: ['orchestration'],  // Needs judge model
    conflicts: [],
    suggestedFor: ['medical', 'legal', 'financial'],
    criticalFor: ['medical', 'legal'],
    minAgents: 2,  // Need 2+ models to reach consensus
  },
  auto_router: {
    id: 'auto_router',
    name: 'Smart Router',
    description: 'Automatically selects best model tier for each task',
    icon: '🎯',
    category: 'verification',
    requires: [],
    conflicts: ['air_gap'],  // Can't route to cloud in air-gap
    suggestedFor: ['website_builder', 'landing_page', 'ecommerce'],
    criticalFor: [],
  },
  fallback_chain: {
    id: 'fallback_chain',
    name: 'Fallback Chain',
    description: 'Automatic retry with backup models on failure',
    icon: '🔄',
    category: 'safety',
    requires: [],
    conflicts: [],
    suggestedFor: ['chatbot', 'ecommerce', 'financial'],
    criticalFor: [],
  },
  forensic_log: {
    id: 'forensic_log',
    name: 'Forensic Logging',
    description: 'Cryptographic audit trail with 7-year retention',
    icon: '📋',
    category: 'monitoring',
    requires: [],
    conflicts: [],
    suggestedFor: ['medical', 'legal', 'financial', 'mental_health'],
    criticalFor: ['medical', 'legal', 'financial'],
  },
  knowledge_vault: {
    id: 'knowledge_vault',
    name: 'Knowledge Vault',
    description: 'Store documents for AI context (RAG)',
    icon: '📚',
    category: 'verification',
    requires: [],
    conflicts: [],
    suggestedFor: ['legal', 'medical', 'financial'],
    criticalFor: [],
  },
  web_search: {
    id: 'web_search',
    name: 'Web Search',
    description: 'Real-time web search for verification',
    icon: '🔍',
    category: 'verification',
    requires: [],
    conflicts: ['air_gap'],  // No external calls in air-gap
    suggestedFor: ['chatbot', 'ecommerce'],
    criticalFor: [],
  },
  debate_mode: {
    id: 'debate_mode',
    name: 'Debate Mode',
    description: '3-phase adversarial debate with unbiased summary',
    icon: '⚔️',
    category: 'orchestration',
    requires: ['orchestration'],
    conflicts: ['thread_guardian'],
    suggestedFor: ['legal', 'financial'],
    criticalFor: [],
    minAgents: 3,  // Need 3+ models for proper debate
  },
  air_gap: {
    id: 'air_gap',
    name: 'Air-Gap Mode',
    description: 'Block all cloud API calls, local-only operation',
    icon: '🔐',
    category: 'safety',
    requires: [],
    conflicts: ['auto_router', 'web_search'],  // No cloud routing or web calls
    suggestedFor: [],
    criticalFor: [],
  },
  rollback: {
    id: 'rollback',
    name: 'Rollback',
    description: 'Undo bad AI generations',
    icon: '⏪',
    category: 'safety',
    requires: ['forensic_log'],  // Need log to rollback
    conflicts: [],
    suggestedFor: ['website_builder', 'medical', 'legal'],
    criticalFor: ['medical'],
  },
  // ============================================================================
  // NEW BRICKS FOR GAMES & CONTENT GENERATION
  // ============================================================================
  document_gen: {
    id: 'document_gen',
    name: 'Document Generator',
    description: 'Generate lore, narratives, documentation, and structured content',
    icon: '📝',
    category: 'content',
    requires: [],
    conflicts: [],
    suggestedFor: ['game_rpg', 'game_visual_novel', 'legal', 'medical'],
    criticalFor: ['game_rpg', 'game_visual_novel'],
    cost: 'medium',
  },
  asset_generator: {
    id: 'asset_generator',
    name: 'Asset Generator',
    description: 'Generate sprites, backgrounds, UI elements, tilesets, icons',
    icon: '🎨',
    category: 'assets',
    requires: ['document_gen'],  // Needs doc gen for prompts
    conflicts: ['air_gap'],      // Needs external API (HuggingFace)
    suggestedFor: ['game_platformer', 'game_rpg', 'game_puzzle', 'game_visual_novel', 'game_card'],
    criticalFor: ['game_platformer', 'game_rpg', 'game_card'],
    outputs: ['sprites', 'backgrounds', 'uiElements', 'tilesets', 'icons'],
    cost: 'high',
  },
  style_guide: {
    id: 'style_guide',
    name: 'Style Guide',
    description: 'Maintain consistent art style, color palette, and visual theme',
    icon: '🎭',
    category: 'assets',
    requires: ['orchestration'],  // Needs judge to evaluate consistency
    conflicts: [],
    suggestedFor: ['game_platformer', 'game_rpg', 'game_visual_novel', 'game_card'],
    criticalFor: [],
    minAgents: 2,  // Needs at least 2 agents to compare styles
    cost: 'medium',
  },
};

// ============================================================================
// WEBSITE TEMPLATES
// ============================================================================

export const WEBSITE_TEMPLATES: Record<WebsiteType, WebsiteTemplate> = {
  chatbot: {
    type: 'chatbot',
    name: 'Chatbot',
    description: 'Conversational AI assistant',
    icon: '💬',
    suggestedCapabilities: ['thread_guardian', 'fallback_chain', 'forensic_log'],
    criticalCapabilities: ['thread_guardian'],
  },
  mental_health: {
    type: 'mental_health',
    name: 'Mental Health',
    description: 'Therapy, counseling, wellness applications',
    icon: '🧠',
    suggestedCapabilities: ['thread_guardian', 'forensic_log', 'rollback', 'consensus_lock'],
    criticalCapabilities: ['thread_guardian', 'forensic_log'],
  },
  medical: {
    type: 'medical',
    name: 'Medical / Healthcare',
    description: 'Doctor offices, clinics, health information',
    icon: '🏥',
    suggestedCapabilities: ['consensus_lock', 'forensic_log', 'rollback', 'orchestration'],
    criticalCapabilities: ['consensus_lock', 'forensic_log', 'rollback'],
  },
  legal: {
    type: 'legal',
    name: 'Legal',
    description: 'Law firms, legal advice, document review',
    icon: '⚖️',
    suggestedCapabilities: ['consensus_lock', 'forensic_log', 'knowledge_vault', 'orchestration'],
    criticalCapabilities: ['consensus_lock', 'forensic_log'],
  },
  financial: {
    type: 'financial',
    name: 'Financial',
    description: 'Accountants, advisors, financial planning',
    icon: '💰',
    suggestedCapabilities: ['forensic_log', 'consensus_lock', 'fallback_chain'],
    criticalCapabilities: ['forensic_log'],
  },
  ecommerce: {
    type: 'ecommerce',
    name: 'E-Commerce',
    description: 'Online stores, product catalogs',
    icon: '🛒',
    suggestedCapabilities: ['auto_router', 'fallback_chain', 'web_search'],
    criticalCapabilities: [],
  },
  landing_page: {
    type: 'landing_page',
    name: 'Landing Page',
    description: 'Simple marketing pages, fast builds',
    icon: '🚀',
    suggestedCapabilities: ['auto_router'],
    criticalCapabilities: [],
  },
  website_builder: {
    type: 'website_builder',
    name: 'Website Builder',
    description: 'General web development',
    icon: '🔨',
    suggestedCapabilities: ['auto_router', 'rollback'],
    criticalCapabilities: [],
  },
  custom: {
    type: 'custom',
    name: 'Custom',
    description: 'Mix and match your own capabilities',
    icon: '✨',
    suggestedCapabilities: [],
    criticalCapabilities: [],
  },
  // ============================================================================
  // GAME TEMPLATES
  // ============================================================================
  game_platformer: {
    type: 'game_platformer',
    name: 'Platformer Game',
    description: 'Side-scrolling action games with levels and obstacles',
    icon: '🎮',
    suggestedCapabilities: ['auto_router', 'rollback', 'asset_generator', 'style_guide', 'document_gen'],
    criticalCapabilities: ['asset_generator', 'style_guide'],
  },
  game_rpg: {
    type: 'game_rpg',
    name: 'RPG Game',
    description: 'Role-playing games with lore, characters, and quests',
    icon: '⚔️',
    suggestedCapabilities: ['document_gen', 'orchestration', 'debate_mode', 'asset_generator', 'style_guide', 'knowledge_vault'],
    criticalCapabilities: ['document_gen', 'asset_generator'],
  },
  game_puzzle: {
    type: 'game_puzzle',
    name: 'Puzzle Game',
    description: 'Logic and puzzle games with levels',
    icon: '🧩',
    suggestedCapabilities: ['auto_router', 'rollback', 'asset_generator'],
    criticalCapabilities: ['asset_generator'],
  },
  game_visual_novel: {
    type: 'game_visual_novel',
    name: 'Visual Novel',
    description: 'Story-driven games with branching narratives',
    icon: '📖',
    suggestedCapabilities: ['document_gen', 'asset_generator', 'style_guide', 'knowledge_vault'],
    criticalCapabilities: ['document_gen', 'asset_generator', 'style_guide'],
  },
  game_card: {
    type: 'game_card',
    name: 'Card Game',
    description: 'Trading card games like Magic: The Gathering',
    icon: '🃏',
    suggestedCapabilities: ['document_gen', 'asset_generator', 'style_guide', 'orchestration', 'consensus_lock'],
    criticalCapabilities: ['asset_generator', 'style_guide', 'document_gen'],
  },
  game_custom: {
    type: 'game_custom',
    name: 'Custom Game',
    description: 'Build any type of browser game',
    icon: '🕹️',
    suggestedCapabilities: ['auto_router', 'rollback', 'asset_generator'],
    criticalCapabilities: [],
  },
};

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface UnifiedCapabilitiesState {
  // Current website type being built
  websiteType: WebsiteType;

  // Orchestration mode (separate from toggles since it's a radio)
  orchestrationMode: OrchestrationMode;

  // Capability states (enabled/disabled + config)
  capabilities: Record<CapabilityId, CapabilityState>;

  // Panel UI state
  isPanelExpanded: boolean;
  showDependencyGraph: boolean;

  // Custom presets
  savedPresets: Array<{
    id: string;
    name: string;
    websiteType: WebsiteType;
    orchestrationMode: OrchestrationMode;
    capabilities: Record<CapabilityId, CapabilityState>;
  }>;

  // Hydration
  hydrated: boolean;
}

interface UnifiedCapabilitiesActions {
  // Hydration
  hydrate: () => void;

  // Website type selection
  setWebsiteType: (type: WebsiteType) => void;
  applyTemplateForType: (type: WebsiteType) => void;

  // Orchestration mode
  setOrchestrationMode: (mode: OrchestrationMode) => void;

  // Capability toggles
  toggleCapability: (id: CapabilityId, enabled: boolean) => void;
  setCapabilityConfig: (id: CapabilityId, config: Record<string, unknown>) => void;

  // Validation
  canEnableCapability: (id: CapabilityId) => { allowed: boolean; reason?: string };
  getConflicts: (id: CapabilityId) => CapabilityId[];
  getMissingDependencies: (id: CapabilityId) => CapabilityId[];

  // UI state
  setPanelExpanded: (expanded: boolean) => void;
  setShowDependencyGraph: (show: boolean) => void;

  // Presets
  saveCurrentAsPreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;

  // Export
  exportConfig: () => string;
  importConfig: (json: string) => boolean;

  // Reset
  resetToDefaults: () => void;
}

type UnifiedCapabilitiesStore = UnifiedCapabilitiesState & UnifiedCapabilitiesActions;

// ============================================================================
// DEFAULT STATE
// ============================================================================

const getDefaultCapabilities = (): Record<CapabilityId, CapabilityState> => ({
  orchestration: { enabled: true, config: { mode: 'single' } },
  thread_guardian: { enabled: false },
  consensus_lock: { enabled: false },
  auto_router: { enabled: true },  // On by default for convenience
  fallback_chain: { enabled: true },  // On by default for reliability
  forensic_log: { enabled: false },
  knowledge_vault: { enabled: false },
  web_search: { enabled: false },
  debate_mode: { enabled: false },
  air_gap: { enabled: false },
  rollback: { enabled: false },
  // New bricks for games/content
  document_gen: { enabled: false },
  asset_generator: { enabled: false },
  style_guide: { enabled: false },
});

// ============================================================================
// STORE
// ============================================================================

export const useUnifiedCapabilitiesStore = create<UnifiedCapabilitiesStore>()(
  persist(
    (set, get) => ({
      // Initial state
      websiteType: 'website_builder',
      orchestrationMode: 'single',
      capabilities: getDefaultCapabilities(),
      isPanelExpanded: true,
      showDependencyGraph: false,
      savedPresets: [],
      hydrated: false,

      // Hydration - also ensures all capabilities are initialized
      hydrate: () => {
        const state = get();
        const defaultCaps = getDefaultCapabilities();
        const mergedCaps = { ...defaultCaps };

        // Merge existing state with defaults (preserves user settings)
        for (const [capId, capState] of Object.entries(state.capabilities || {})) {
          if (capId in defaultCaps) {
            mergedCaps[capId as CapabilityId] = capState as CapabilityState;
          }
        }

        // Ensure ALL defined capabilities exist in state
        for (const capId of Object.keys(CAPABILITY_DEFINITIONS) as CapabilityId[]) {
          if (!mergedCaps[capId]) {
            mergedCaps[capId] = { enabled: false };
            console.log('[UnifiedCapabilities] Initialized missing capability:', capId);
          }
        }

        set({ capabilities: mergedCaps, hydrated: true });
        console.log('[UnifiedCapabilities] Hydrated with', Object.keys(mergedCaps).length, 'capabilities');
      },

      // Website type selection
      setWebsiteType: (type) => {
        set({ websiteType: type });
        console.log('[UnifiedCapabilities] Website type set:', type);
      },

      applyTemplateForType: (type) => {
        const template = WEBSITE_TEMPLATES[type];
        if (!template) return;

        const newCapabilities = getDefaultCapabilities();

        // Enable suggested capabilities
        for (const capId of template.suggestedCapabilities) {
          newCapabilities[capId] = { enabled: true };
        }

        // Enable critical capabilities (always on for this type)
        for (const capId of template.criticalCapabilities) {
          newCapabilities[capId] = { enabled: true };
        }

        set({
          websiteType: type,
          capabilities: newCapabilities,
        });

        console.log('[UnifiedCapabilities] Applied template for:', type);
      },

      // Orchestration mode
      setOrchestrationMode: (mode) => {
        set({ orchestrationMode: mode });
        console.log('[UnifiedCapabilities] Orchestration mode:', mode);
      },

      // Capability toggles - SAFE: handles missing capability IDs gracefully
      toggleCapability: (id, enabled) => {
        const state = get();

        // SAFETY CHECK: Validate capability ID exists in definitions
        if (!CAPABILITY_DEFINITIONS[id]) {
          console.warn('[UnifiedCapabilities] Unknown capability ID:', id, '- skipping toggle');
          return;
        }

        // SAFETY CHECK: Ensure capability exists in state, initialize if missing
        const currentCapState = state.capabilities[id] || { enabled: false };

        if (enabled) {
          // Check if we can enable
          const check = state.canEnableCapability(id);
          if (!check.allowed) {
            console.warn('[UnifiedCapabilities] Cannot enable:', id, check.reason);
            return;
          }
        }

        // If disabling, also disable capabilities that depend on this one
        if (!enabled) {
          const newCapabilities = { ...state.capabilities };
          // Use safe access with fallback
          newCapabilities[id] = { ...currentCapState, enabled: false };

          // Find and disable dependents
          for (const [capId, def] of Object.entries(CAPABILITY_DEFINITIONS)) {
            const capIdTyped = capId as CapabilityId;
            const capState = newCapabilities[capIdTyped] || { enabled: false };
            if (def.requires.includes(id) && capState.enabled) {
              newCapabilities[capIdTyped] = {
                ...capState,
                enabled: false
              };
              console.log('[UnifiedCapabilities] Auto-disabled dependent:', capId);
            }
          }

          set({ capabilities: newCapabilities });
        } else {
          set({
            capabilities: {
              ...state.capabilities,
              [id]: { ...currentCapState, enabled },
            },
          });
        }

        console.log('[UnifiedCapabilities] Toggled:', id, '→', enabled);
      },

      setCapabilityConfig: (id, config) => {
        set((state) => ({
          capabilities: {
            ...state.capabilities,
            [id]: { ...state.capabilities[id], config },
          },
        }));
      },

      // Validation - SAFE: handles unknown capability IDs
      canEnableCapability: (id) => {
        const state = get();
        const def = CAPABILITY_DEFINITIONS[id];

        // SAFETY CHECK: Unknown capability
        if (!def) {
          console.warn('[UnifiedCapabilities] canEnableCapability: Unknown capability:', id);
          return { allowed: false, reason: `Unknown capability: ${id}` };
        }

        // Check dependencies (with safe access)
        for (const reqId of def.requires || []) {
          const reqDef = CAPABILITY_DEFINITIONS[reqId];
          const reqState = state.capabilities[reqId];
          if (!reqState?.enabled) {
            return {
              allowed: false,
              reason: `Requires "${reqDef?.name || reqId}" to be enabled first`,
            };
          }
        }

        // Check conflicts (with safe access)
        for (const conflictId of def.conflicts || []) {
          const conflictDef = CAPABILITY_DEFINITIONS[conflictId];
          const conflictState = state.capabilities[conflictId];
          if (conflictState?.enabled) {
            return {
              allowed: false,
              reason: `Conflicts with "${conflictDef?.name || conflictId}"`,
            };
          }
        }

        // Check minAgents requirement
        if (def.minAgents && def.minAgents > 1) {
          // Count active orchestration agents based on mode
          const mode = state.orchestrationMode;
          let activeAgents = 1;  // Default single mode
          if (mode === 'sequential') activeAgents = 2;
          if (mode === 'parallel') activeAgents = 2;
          if (mode === 'parallel_judge') activeAgents = 3;

          if (activeAgents < def.minAgents) {
            return {
              allowed: false,
              reason: `Requires ${def.minAgents}+ AI agents. Current mode has ${activeAgents}. Switch to ${def.minAgents >= 3 ? 'Trio + Judge' : 'Pipeline/Debate'} mode.`,
            };
          }
        }

        return { allowed: true };
      },

      getConflicts: (id) => {
        const state = get();
        const def = CAPABILITY_DEFINITIONS[id];
        return def.conflicts.filter((cId) => state.capabilities[cId]?.enabled);
      },

      getMissingDependencies: (id) => {
        const state = get();
        const def = CAPABILITY_DEFINITIONS[id];
        return def.requires.filter((rId) => !state.capabilities[rId]?.enabled);
      },

      // UI state
      setPanelExpanded: (expanded) => set({ isPanelExpanded: expanded }),
      setShowDependencyGraph: (show) => set({ showDependencyGraph: show }),

      // Presets
      saveCurrentAsPreset: (name) => {
        const state = get();
        const newPreset = {
          id: crypto.randomUUID(),
          name,
          websiteType: state.websiteType,
          orchestrationMode: state.orchestrationMode,
          capabilities: { ...state.capabilities },
        };
        set({ savedPresets: [...state.savedPresets, newPreset] });
        console.log('[UnifiedCapabilities] Saved preset:', name);
      },

      loadPreset: (presetId) => {
        const preset = get().savedPresets.find((p) => p.id === presetId);
        if (preset) {
          set({
            websiteType: preset.websiteType,
            orchestrationMode: preset.orchestrationMode,
            capabilities: { ...preset.capabilities },
          });
          console.log('[UnifiedCapabilities] Loaded preset:', preset.name);
        }
      },

      deletePreset: (presetId) => {
        set((state) => ({
          savedPresets: state.savedPresets.filter((p) => p.id !== presetId),
        }));
      },

      // Export
      exportConfig: () => {
        const state = get();
        return JSON.stringify({
          websiteType: state.websiteType,
          orchestrationMode: state.orchestrationMode,
          capabilities: state.capabilities,
        }, null, 2);
      },

      importConfig: (json) => {
        try {
          const config = JSON.parse(json);
          if (config.websiteType && config.capabilities) {
            set({
              websiteType: config.websiteType,
              orchestrationMode: config.orchestrationMode || 'single',
              capabilities: config.capabilities,
            });
            console.log('[UnifiedCapabilities] Imported config');
            return true;
          }
          return false;
        } catch {
          console.error('[UnifiedCapabilities] Failed to import config');
          return false;
        }
      },

      // Reset
      resetToDefaults: () => {
        set({
          websiteType: 'website_builder',
          orchestrationMode: 'single',
          capabilities: getDefaultCapabilities(),
        });
        console.log('[UnifiedCapabilities] Reset to defaults');
      },
    }),
    {
      name: 'unified-capabilities',
      version: 1,
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        websiteType: state.websiteType,
        orchestrationMode: state.orchestrationMode,
        capabilities: state.capabilities,
        savedPresets: state.savedPresets,
        isPanelExpanded: state.isPanelExpanded,
      }),
    }
  )
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all capabilities grouped by category
 */
export function getCapabilitiesByCategory(): Record<string, CapabilityDefinition[]> {
  const grouped: Record<string, CapabilityDefinition[]> = {
    orchestration: [],
    monitoring: [],
    verification: [],
    safety: [],
    content: [],   // NEW: for document_gen
    assets: [],    // NEW: for asset_generator, style_guide
  };

  for (const def of Object.values(CAPABILITY_DEFINITIONS)) {
    // Safety check: ensure category exists in grouped object
    if (grouped[def.category]) {
      grouped[def.category].push(def);
    } else {
      console.warn(`[UnifiedCapabilities] Unknown category: ${def.category} for capability ${def.id}`);
    }
  }

  return grouped;
}

/**
 * Get human-readable summary of active capabilities
 */
export function getActiveCapabilitiesSummary(
  capabilities: Record<CapabilityId, CapabilityState>
): string {
  const active = Object.entries(capabilities)
    .filter(([_, state]) => state.enabled)
    .map(([id]) => CAPABILITY_DEFINITIONS[id as CapabilityId].name);

  if (active.length === 0) return 'No capabilities enabled';
  if (active.length <= 3) return active.join(', ');
  return `${active.slice(0, 2).join(', ')} +${active.length - 2} more`;
}
