/**
 * SaaS Platform Store
 *
 * Multi-tenant architecture for AI Builder SaaS.
 *
 * TIERS:
 * - Free: 4 pre-built templates, user role only
 * - Pro: Custom templates, user role
 * - Enterprise: Admin dashboard, company templates, analytics
 *
 * This is the $10K/mo recurring revenue engine.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";
import type { CapabilityId, OrchestrationMode } from './unifiedCapabilitiesStore';

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = 'user' | 'admin' | 'super_admin';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface SaaSUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  tier: SubscriptionTier;
  createdAt: number;
}

export interface SaaSCompany {
  id: string;
  name: string;
  tier: SubscriptionTier;
  adminIds: string[];
  customTemplates: SaaSTemplate[];
  createdAt: number;
}

export interface SaaSTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'chatbot' | 'healthcare' | 'legal' | 'financial' | 'general';

  // Pre-configured capabilities
  orchestrationMode: OrchestrationMode;
  enabledCapabilities: CapabilityId[];
  capabilityConfigs: Partial<Record<CapabilityId, Record<string, unknown>>>;

  // Template metadata
  isBuiltIn: boolean;          // True for the 4 core templates
  isCompanyTemplate: boolean;  // True for enterprise company templates
  companyId?: string;          // Which company owns this (enterprise only)
  createdBy?: string;          // Admin who created it
  createdAt: number;
  updatedAt: number;

  // Usage stats (for analytics)
  deployCount: number;
  lastDeployedAt?: number;
}

export interface Deployment {
  id: string;
  templateId: string;
  userId: string;
  companyId?: string;
  name: string;
  status: 'draft' | 'deployed' | 'paused' | 'archived';
  url?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// BUILT-IN TEMPLATES (FREE TIER)
// ============================================================================

export const BUILT_IN_TEMPLATES: SaaSTemplate[] = [
  {
    id: 'tpl_chatbot',
    name: 'AI Chatbot',
    description: 'Conversational assistant with fact-tracking and fallback protection',
    icon: '💬',
    category: 'chatbot',
    orchestrationMode: 'single',
    enabledCapabilities: ['thread_guardian', 'fallback_chain', 'auto_router'],
    capabilityConfigs: {},
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  {
    id: 'tpl_mental_health',
    name: 'Mental Health Assistant',
    description: 'Therapy-ready with crisis detection, forensic logging, and rollback safety',
    icon: '🧠',
    category: 'healthcare',
    orchestrationMode: 'single',
    enabledCapabilities: ['thread_guardian', 'forensic_log', 'rollback', 'fallback_chain'],
    capabilityConfigs: {
      forensic_log: { retentionYears: 7 },
    },
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  {
    id: 'tpl_accountant',
    name: 'Financial Advisor',
    description: 'Multi-pass verification, audit trail, and consensus locking for accuracy',
    icon: '💰',
    category: 'financial',
    orchestrationMode: 'parallel_judge',
    enabledCapabilities: ['consensus_lock', 'forensic_log', 'orchestration', 'fallback_chain'],
    capabilityConfigs: {
      consensus_lock: { minPasses: 2 },
    },
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  {
    id: 'tpl_website_builder',
    name: 'Website Builder',
    description: 'Fast iteration with smart routing, rollback, and live preview',
    icon: '🔨',
    category: 'general',
    orchestrationMode: 'single',
    enabledCapabilities: ['auto_router', 'rollback', 'fallback_chain'],
    capabilityConfigs: {},
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  // ============================================================================
  // GAME TEMPLATES (FREE TIER)
  // ============================================================================
  {
    id: 'tpl_game_platformer',
    name: 'Platformer Game',
    description: 'Side-scrolling action with sprites, levels, and physics',
    icon: '🎮',
    category: 'general',
    orchestrationMode: 'single',
    enabledCapabilities: ['auto_router', 'rollback', 'document_gen', 'asset_generator', 'style_guide'],
    capabilityConfigs: {
      asset_generator: { defaultType: 'sprites' },
    },
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  {
    id: 'tpl_game_rpg',
    name: 'RPG Game',
    description: 'Role-playing with lore, characters, quests, and world-building',
    icon: '⚔️',
    category: 'general',
    orchestrationMode: 'parallel_judge',
    enabledCapabilities: ['document_gen', 'orchestration', 'debate_mode', 'asset_generator', 'style_guide', 'knowledge_vault'],
    capabilityConfigs: {
      document_gen: { templates: ['lore', 'characters', 'quests'] },
    },
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  {
    id: 'tpl_game_puzzle',
    name: 'Puzzle Game',
    description: 'Logic puzzles with procedural level generation',
    icon: '🧩',
    category: 'general',
    orchestrationMode: 'single',
    enabledCapabilities: ['auto_router', 'rollback', 'asset_generator'],
    capabilityConfigs: {},
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  {
    id: 'tpl_game_visual_novel',
    name: 'Visual Novel',
    description: 'Story-driven game with branching narratives and character art',
    icon: '📖',
    category: 'general',
    orchestrationMode: 'sequential',
    enabledCapabilities: ['document_gen', 'asset_generator', 'style_guide', 'knowledge_vault'],
    capabilityConfigs: {
      document_gen: { templates: ['dialogue', 'branches', 'characters'] },
      style_guide: { artStyle: 'anime' },
    },
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  {
    id: 'tpl_game_card',
    name: 'Card Game',
    description: 'Trading card game like Magic: The Gathering with card art generation',
    icon: '🃏',
    category: 'general',
    orchestrationMode: 'parallel_judge',
    enabledCapabilities: ['document_gen', 'asset_generator', 'style_guide', 'orchestration', 'consensus_lock'],
    capabilityConfigs: {
      asset_generator: { defaultType: 'cards' },
      consensus_lock: { minPasses: 2 },  // Balance checking
    },
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
  {
    id: 'tpl_game_custom',
    name: 'Custom Game',
    description: 'Build any browser game with full AI toolkit',
    icon: '🕹️',
    category: 'general',
    orchestrationMode: 'single',
    enabledCapabilities: ['auto_router', 'rollback', 'asset_generator', 'fallback_chain'],
    capabilityConfigs: {},
    isBuiltIn: true,
    isCompanyTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deployCount: 0,
  },
];

// ============================================================================
// STORE
// ============================================================================

interface SaaSState {
  // Current user
  currentUser: SaaSUser | null;
  currentCompany: SaaSCompany | null;

  // Templates
  availableTemplates: SaaSTemplate[];
  selectedTemplateId: string | null;

  // Deployments
  deployments: Deployment[];

  // UI state
  showDeployModal: boolean;
  showAdminPanel: boolean;

  // Hydration
  hydrated: boolean;
}

interface SaaSActions {
  // Hydration
  hydrate: () => void;

  // User management
  setCurrentUser: (user: SaaSUser | null) => void;
  setCurrentCompany: (company: SaaSCompany | null) => void;

  // Template selection
  selectTemplate: (templateId: string) => void;
  getSelectedTemplate: () => SaaSTemplate | null;
  getAvailableTemplates: () => SaaSTemplate[];

  // Template management (admin only)
  createTemplate: (template: Omit<SaaSTemplate, 'id' | 'createdAt' | 'updatedAt' | 'deployCount'>) => string;
  updateTemplate: (templateId: string, updates: Partial<SaaSTemplate>) => void;
  deleteTemplate: (templateId: string) => void;

  // Deployments
  createDeployment: (templateId: string, name: string) => string;
  updateDeployment: (deploymentId: string, updates: Partial<Deployment>) => void;
  getDeployments: () => Deployment[];

  // UI
  setShowDeployModal: (show: boolean) => void;
  setShowAdminPanel: (show: boolean) => void;

  // Permission checks
  canAccessAdmin: () => boolean;
  canCreateTemplates: () => boolean;
  canDeployTemplates: () => boolean;
}

type SaaSStore = SaaSState & SaaSActions;

export const useSaaSStore = create<SaaSStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentUser: null,
      currentCompany: null,
      availableTemplates: [...BUILT_IN_TEMPLATES],
      selectedTemplateId: null,
      deployments: [],
      showDeployModal: false,
      showAdminPanel: false,
      hydrated: false,

      // Hydration
      hydrate: () => set({ hydrated: true }),

      // User management
      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentCompany: (company) => {
        set({ currentCompany: company });

        // Add company templates to available templates
        if (company) {
          const builtIn = BUILT_IN_TEMPLATES;
          const companyTemplates = company.customTemplates || [];
          set({ availableTemplates: [...builtIn, ...companyTemplates] });
        } else {
          set({ availableTemplates: [...BUILT_IN_TEMPLATES] });
        }
      },

      // Template selection - with detailed logging for debugging
      selectTemplate: (templateId) => {
        const state = get();
        const template = state.availableTemplates.find(t => t.id === templateId);

        console.log('[SaaS] Selecting template:', templateId);
        if (template) {
          console.log('[SaaS] Template found:', {
            id: template.id,
            name: template.name,
            orchestrationMode: template.orchestrationMode,
            enabledCapabilities: template.enabledCapabilities,
            capabilityCount: template.enabledCapabilities?.length || 0,
          });
        } else {
          console.warn('[SaaS] Template NOT found:', templateId);
          console.log('[SaaS] Available templates:', state.availableTemplates.map(t => t.id));
        }

        set({ selectedTemplateId: templateId });
      },

      getSelectedTemplate: () => {
        const state = get();
        if (!state.selectedTemplateId) return null;
        return state.availableTemplates.find((t) => t.id === state.selectedTemplateId) || null;
      },

      getAvailableTemplates: () => {
        const state = get();
        const user = state.currentUser;

        // No user = show built-in only
        if (!user) {
          return BUILT_IN_TEMPLATES.filter(t => t && typeof t === 'object' && typeof t.id === 'string');
        }

        // Filter based on tier and company (with safety checks)
        return (state.availableTemplates || []).filter((t) => {
          // Safety check - ensure template is valid
          if (!t || typeof t !== 'object' || typeof t.id !== 'string') return false;

          // Built-in templates available to all
          if (t.isBuiltIn) return true;

          // Company templates only for enterprise users in that company
          if (t.isCompanyTemplate) {
            return user.tier === 'enterprise' && user.companyId === t.companyId;
          }

          // Custom templates for pro/enterprise
          return user.tier !== 'free';
        });
      },

      // Template management (admin only)
      createTemplate: (template) => {
        const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();

        const newTemplate: SaaSTemplate = {
          ...template,
          id,
          createdAt: now,
          updatedAt: now,
          deployCount: 0,
        };

        set((state) => ({
          availableTemplates: [...state.availableTemplates, newTemplate],
        }));

        console.log('[SaaS] Created template:', id);
        return id;
      },

      updateTemplate: (templateId, updates) => {
        set((state) => ({
          availableTemplates: state.availableTemplates.map((t) =>
            t.id === templateId ? { ...t, ...updates, updatedAt: Date.now() } : t
          ),
        }));
      },

      deleteTemplate: (templateId) => {
        set((state) => ({
          availableTemplates: state.availableTemplates.filter((t) => t.id !== templateId),
        }));
      },

      // Deployments
      createDeployment: (templateId, name) => {
        const state = get();
        const id = `dep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();

        const deployment: Deployment = {
          id,
          templateId,
          userId: state.currentUser?.id || 'anonymous',
          companyId: state.currentUser?.companyId,
          name,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          deployments: [...state.deployments, deployment],
        }));

        // Update template deploy count
        const template = state.availableTemplates.find((t) => t.id === templateId);
        if (template) {
          get().updateTemplate(templateId, {
            deployCount: template.deployCount + 1,
            lastDeployedAt: now,
          });
        }

        console.log('[SaaS] Created deployment:', id);
        return id;
      },

      updateDeployment: (deploymentId, updates) => {
        set((state) => ({
          deployments: state.deployments.map((d) =>
            d.id === deploymentId ? { ...d, ...updates, updatedAt: Date.now() } : d
          ),
        }));
      },

      getDeployments: () => {
        const state = get();
        const user = state.currentUser;

        if (!user) return [];

        // Users see their own deployments
        // Admins see company deployments
        return state.deployments.filter((d) => {
          if (user.role === 'admin' || user.role === 'super_admin') {
            return d.companyId === user.companyId || d.userId === user.id;
          }
          return d.userId === user.id;
        });
      },

      // UI
      setShowDeployModal: (show) => set({ showDeployModal: show }),
      setShowAdminPanel: (show) => set({ showAdminPanel: show }),

      // Permission checks
      canAccessAdmin: () => {
        const user = get().currentUser;
        return user?.role === 'admin' || user?.role === 'super_admin';
      },

      canCreateTemplates: () => {
        const user = get().currentUser;
        if (!user) return false;
        // Pro can create personal templates
        // Enterprise admins can create company templates
        return user.tier !== 'free' && (user.role === 'admin' || user.tier === 'pro');
      },

      canDeployTemplates: () => {
        const user = get().currentUser;
        // All tiers can deploy (free has limited templates)
        return user !== null;
      },
    }),
    {
      name: 'saas-store',
      version: 1,
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        currentUser: state.currentUser,
        selectedTemplateId: state.selectedTemplateId,
        deployments: state.deployments,
      }),
    }
  )
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get tier display info
 */
export function getTierInfo(tier: SubscriptionTier): {
  name: string;
  color: string;
  price: string;
  features: string[];
} {
  switch (tier) {
    case 'free':
      return {
        name: 'Free',
        color: 'text-zinc-500',
        price: '$0/mo',
        features: ['4 built-in templates', 'Basic deployment', 'Community support'],
      };
    case 'pro':
      return {
        name: 'Pro',
        color: 'text-blue-500',
        price: '$49/mo',
        features: ['All Free features', 'Custom templates', 'Priority support', 'Analytics'],
      };
    case 'enterprise':
      return {
        name: 'Enterprise',
        color: 'text-purple-500',
        price: 'Custom',
        features: ['All Pro features', 'Admin dashboard', 'Company templates', 'SSO', 'Dedicated support'],
      };
  }
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: SaaSTemplate['category']): {
  label: string;
  color: string;
} {
  switch (category) {
    case 'chatbot':
      return { label: 'Chatbot', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' };
    case 'healthcare':
      return { label: 'Healthcare', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' };
    case 'legal':
      return { label: 'Legal', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' };
    case 'financial':
      return { label: 'Financial', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' };
    case 'general':
      return { label: 'General', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-400' };
  }
}
