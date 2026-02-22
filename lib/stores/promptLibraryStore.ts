/**
 * Prompt Library Store - Pre-built and custom prompts for Builder
 * Enhanced with rich metadata for premium UI
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";

export type OutputType = 'landing-page' | 'form' | 'dashboard' | 'component' | 'layout' | 'navigation' | 'page';
export type Complexity = 'simple' | 'medium' | 'complex';

export interface Prompt {
  id: string;
  title: string;
  prompt: string;
  category: string;
  isCustom: boolean;
  // Enhanced metadata
  outputType?: OutputType;
  complexity?: Complexity;
  techStack?: string[];
  description?: string;
  previewHint?: string; // Brief description of expected visual output
}

export interface PromptCategory {
  id: string;
  name: string;
  icon: string;
  color: string; // For gradient effects
}

// Pre-built prompt categories with colors
export const PROMPT_CATEGORIES: PromptCategory[] = [
  { id: 'layout', name: 'Layouts', icon: '📐', color: '#6366f1' },
  { id: 'components', name: 'Components', icon: '🧩', color: '#8b5cf6' },
  { id: 'forms', name: 'Forms', icon: '📝', color: '#ec4899' },
  { id: 'navigation', name: 'Navigation', icon: '🧭', color: '#14b8a6' },
  { id: 'pages', name: 'Full Pages', icon: '📄', color: '#f59e0b' },
  { id: 'custom', name: 'My Prompts', icon: '⭐', color: '#eab308' },
];

// Pre-built prompts with enhanced metadata
export const PREBUILT_PROMPTS: Prompt[] = [
  // Layouts
  {
    id: 'layout-landing',
    title: 'Landing Page',
    prompt: 'Create a modern landing page with a navigation bar, hero section with a headline and CTA button, features grid, and a footer. Use a clean design with good spacing.',
    category: 'layout',
    isCustom: false,
    outputType: 'landing-page',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind'],
    description: 'Modern landing page with hero, features, and footer',
    previewHint: 'Hero section with gradient background, 3-column features grid',
  },
  {
    id: 'layout-two-column',
    title: 'Two-Column Layout',
    prompt: 'Create a responsive two-column layout with a sidebar on the left (250px) and main content area on the right. The sidebar should be collapsible on mobile.',
    category: 'layout',
    isCustom: false,
    outputType: 'layout',
    complexity: 'simple',
    techStack: ['HTML', 'CSS'],
    description: 'Responsive sidebar + main content layout',
    previewHint: 'Fixed sidebar with scrollable main area',
  },
  {
    id: 'layout-grid',
    title: 'Responsive Grid',
    prompt: 'Create a responsive grid layout that shows 4 columns on desktop, 2 on tablet, and 1 on mobile. Include 8 placeholder cards with images and text.',
    category: 'layout',
    isCustom: false,
    outputType: 'layout',
    complexity: 'simple',
    techStack: ['HTML', 'Tailwind'],
    description: 'Auto-responsive card grid',
    previewHint: 'Grid of cards that reflows based on screen size',
  },
  {
    id: 'layout-hero-split',
    title: 'Split Hero',
    prompt: 'Create a split-screen hero section with text content on the left and an image/illustration on the right. Include animated entrance effects.',
    category: 'layout',
    isCustom: false,
    outputType: 'layout',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'CSS'],
    description: '50/50 split hero with animations',
    previewHint: 'Left: headline + CTA, Right: hero image',
  },

  // Components
  {
    id: 'comp-card-grid',
    title: 'Card Grid',
    prompt: 'Create a responsive card grid component. Each card should have an image, title, description, and action button. Include hover effects and smooth transitions.',
    category: 'components',
    isCustom: false,
    outputType: 'component',
    complexity: 'simple',
    techStack: ['HTML', 'Tailwind'],
    description: 'Interactive card grid with hover effects',
    previewHint: 'Cards lift on hover with shadow effect',
  },
  {
    id: 'comp-pricing',
    title: 'Pricing Table',
    prompt: 'Create a pricing table with 3 tiers (Basic, Pro, Enterprise). Each tier shows price, feature list with checkmarks, and a CTA button. Highlight the middle tier as "Most Popular".',
    category: 'components',
    isCustom: false,
    outputType: 'component',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind'],
    description: '3-tier pricing comparison table',
    previewHint: 'Middle tier highlighted with accent color',
  },
  {
    id: 'comp-testimonials',
    title: 'Testimonials',
    prompt: 'Create a testimonials section with a carousel/slider showing customer quotes, names, titles, and avatar images. Include navigation arrows and dots.',
    category: 'components',
    isCustom: false,
    outputType: 'component',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Testimonial carousel with navigation',
    previewHint: 'Quote cards with avatars and navigation dots',
  },
  {
    id: 'comp-modal',
    title: 'Modal Dialog',
    prompt: 'Create a reusable modal dialog component with a dark overlay, centered content box, close button, title, body content, and action buttons. Include open/close animations.',
    category: 'components',
    isCustom: false,
    outputType: 'component',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Animated modal with backdrop',
    previewHint: 'Centered dialog over dark overlay',
  },
  {
    id: 'comp-accordion',
    title: 'Accordion',
    prompt: 'Create an accordion/collapsible section component with smooth expand/collapse animations. Include icons that rotate when expanded.',
    category: 'components',
    isCustom: false,
    outputType: 'component',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Expandable content sections',
    previewHint: 'FAQ-style collapsible panels',
  },
  {
    id: 'comp-stats',
    title: 'Stats Counter',
    prompt: 'Create a stats section with 4 animated number counters showing key metrics. Include icons and labels for each stat.',
    category: 'components',
    isCustom: false,
    outputType: 'component',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Animated statistics display',
    previewHint: 'Large numbers with count-up animation',
  },

  // Forms
  {
    id: 'form-contact',
    title: 'Contact Form',
    prompt: 'Create a contact form with name, email, subject, and message fields. Add form validation with error messages and a submit button with loading state.',
    category: 'forms',
    isCustom: false,
    outputType: 'form',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Validated contact form with feedback',
    previewHint: 'Clean form with inline validation',
  },
  {
    id: 'form-login',
    title: 'Login Form',
    prompt: 'Create a login form with email and password fields, "Remember me" checkbox, forgot password link, and submit button. Include a "Sign up" link at the bottom.',
    category: 'forms',
    isCustom: false,
    outputType: 'form',
    complexity: 'simple',
    techStack: ['HTML', 'Tailwind'],
    description: 'Standard login form with options',
    previewHint: 'Centered card with email/password inputs',
  },
  {
    id: 'form-signup',
    title: 'Signup Form',
    prompt: 'Create a signup form with name, email, password, confirm password fields. Add password strength indicator and terms checkbox. Include social signup buttons.',
    category: 'forms',
    isCustom: false,
    outputType: 'form',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Full registration with password strength',
    previewHint: 'Multi-field form with progress indicator',
  },
  {
    id: 'form-search',
    title: 'Search Bar',
    prompt: 'Create an advanced search bar with autocomplete suggestions dropdown, search history, and filter chips. Include keyboard navigation.',
    category: 'forms',
    isCustom: false,
    outputType: 'form',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Search with autocomplete and filters',
    previewHint: 'Search input with dropdown suggestions',
  },

  // Navigation
  {
    id: 'nav-header',
    title: 'Header Navigation',
    prompt: 'Create a responsive header navigation with logo, menu links, and a mobile hamburger menu. Include dropdown menus for nested navigation items.',
    category: 'navigation',
    isCustom: false,
    outputType: 'navigation',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Responsive navbar with dropdowns',
    previewHint: 'Fixed header with mobile menu toggle',
  },
  {
    id: 'nav-sidebar',
    title: 'Collapsible Sidebar',
    prompt: 'Create a sidebar navigation with collapsible menu sections, icons for each item, active state styling, and a collapse/expand toggle button.',
    category: 'navigation',
    isCustom: false,
    outputType: 'navigation',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Collapsible icon sidebar',
    previewHint: 'Dark sidebar with icon-only collapsed state',
  },
  {
    id: 'nav-tabs',
    title: 'Tab Navigation',
    prompt: 'Create a tabbed interface with horizontal tabs. Each tab shows different content when clicked. Include keyboard navigation and animated transitions.',
    category: 'navigation',
    isCustom: false,
    outputType: 'navigation',
    complexity: 'simple',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Tabbed content switcher',
    previewHint: 'Horizontal tabs with sliding indicator',
  },
  {
    id: 'nav-breadcrumb',
    title: 'Breadcrumb',
    prompt: 'Create a breadcrumb navigation component with separator icons, truncation for long paths, and mobile-friendly collapsed view.',
    category: 'navigation',
    isCustom: false,
    outputType: 'navigation',
    complexity: 'simple',
    techStack: ['HTML', 'Tailwind'],
    description: 'Path-style breadcrumb trail',
    previewHint: 'Home > Category > Item style navigation',
  },

  // Full Pages
  {
    id: 'page-dashboard',
    title: 'Dashboard',
    prompt: 'Create a dashboard page with a sidebar navigation, header with user menu, stat cards showing KPIs, a line chart area, and a recent activity list.',
    category: 'pages',
    isCustom: false,
    outputType: 'dashboard',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Full admin dashboard with stats',
    previewHint: 'Sidebar + header + KPI cards + activity feed',
  },
  {
    id: 'page-blog',
    title: 'Blog Layout',
    prompt: 'Create a blog page layout with a hero post at top, grid of recent posts with thumbnails and excerpts, sidebar with categories and popular posts, and pagination.',
    category: 'pages',
    isCustom: false,
    outputType: 'page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind'],
    description: 'Blog with featured post and grid',
    previewHint: 'Large featured post + post grid + sidebar',
  },
  {
    id: 'page-portfolio',
    title: 'Portfolio',
    prompt: 'Create a portfolio page with a hero section introducing the person, a filterable project grid, skills section, and contact form.',
    category: 'pages',
    isCustom: false,
    outputType: 'page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Personal portfolio showcase',
    previewHint: 'Hero intro + project gallery + contact',
  },
  {
    id: 'page-ecommerce',
    title: 'Product Page',
    prompt: 'Create a product detail page with image gallery, product info, size/color selectors, add to cart button, reviews section, and related products.',
    category: 'pages',
    isCustom: false,
    outputType: 'page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'E-commerce product detail page',
    previewHint: 'Image gallery + purchase options + reviews',
  },
  {
    id: 'page-settings',
    title: 'Settings Page',
    prompt: 'Create a settings page with a vertical tab navigation on the left, form sections for profile, notifications, privacy settings, with save/cancel buttons.',
    category: 'pages',
    isCustom: false,
    outputType: 'page',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Settings page with vertical tabs',
    previewHint: 'Left tabs + settings forms on right',
  },
];

interface PromptLibraryState {
  customPrompts: Prompt[];
  expandedCategories: Set<string>;
  hydrated: boolean;

  // Actions
  hydrate: () => void;
  addCustomPrompt: (title: string, prompt: string) => void;
  removeCustomPrompt: (id: string) => void;
  toggleCategory: (categoryId: string) => void;
  getAllPrompts: () => Prompt[];
  getPromptsByCategory: (categoryId: string) => Prompt[];
}

export const usePromptLibraryStore = create<PromptLibraryState>()(
  persist(
    (set, get) => ({
      customPrompts: [],
      expandedCategories: new Set(['layout']), // Default expanded
      hydrated: false,

      hydrate: () => {
        set({ hydrated: true });
      },

      addCustomPrompt: (title, prompt) => {
        const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newPrompt: Prompt = {
          id,
          title,
          prompt,
          category: 'custom',
          isCustom: true,
          outputType: 'component',
          complexity: 'medium',
        };
        set(state => ({
          customPrompts: [newPrompt, ...state.customPrompts],
        }));
      },

      removeCustomPrompt: (id) => {
        set(state => ({
          customPrompts: state.customPrompts.filter(p => p.id !== id),
        }));
      },

      toggleCategory: (categoryId) => {
        set(state => {
          const expanded = new Set(state.expandedCategories);
          if (expanded.has(categoryId)) {
            expanded.delete(categoryId);
          } else {
            expanded.add(categoryId);
          }
          return { expandedCategories: expanded };
        });
      },

      getAllPrompts: () => {
        return [...PREBUILT_PROMPTS, ...get().customPrompts];
      },

      getPromptsByCategory: (categoryId) => {
        const allPrompts = get().getAllPrompts();
        return allPrompts.filter(p => p.category === categoryId);
      },
    }),
    {
      name: 'builder-prompt-library',
      version: 1,
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        customPrompts: state.customPrompts,
        expandedCategories: Array.from(state.expandedCategories),
      }),
      merge: (persisted: any, current) => ({
        ...current,
        customPrompts: persisted?.customPrompts || [],
        expandedCategories: new Set(persisted?.expandedCategories || ['layout']),
      }),
    }
  )
);

// Helper function to get complexity color
export function getComplexityColor(complexity: Complexity): string {
  switch (complexity) {
    case 'simple': return 'text-emerald-500 bg-emerald-500/10';
    case 'medium': return 'text-amber-500 bg-amber-500/10';
    case 'complex': return 'text-rose-500 bg-rose-500/10';
  }
}

// Helper function to get output type label
export function getOutputTypeLabel(type: OutputType): string {
  switch (type) {
    case 'landing-page': return 'Landing Page';
    case 'form': return 'Form';
    case 'dashboard': return 'Dashboard';
    case 'component': return 'Component';
    case 'layout': return 'Layout';
    case 'navigation': return 'Navigation';
    case 'page': return 'Full Page';
  }
}
