/**
 * Prompt Library Store - Pre-built and custom prompts for Builder
 * Enhanced with rich metadata for premium UI
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "../lib/utils/debouncedStorage";

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
  { id: 'client-sites', name: 'Client Sites', icon: '🏗️', color: '#10b981' },
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

  // Client Sites
  {
    id: 'site-modern-saas',
    title: 'Modern SaaS Landing',
    prompt: 'Create a complete SaaS landing page. Include: sticky navigation with logo and CTA button, hero section with bold headline, subtitle, email signup form and product screenshot placeholder, 3-column features section with icons, pricing table with 3 tiers (Starter/Pro/Enterprise) where Pro is highlighted, testimonials section with 3 quote cards, FAQ accordion section, and footer with links. Use a professional indigo/white color scheme. Make it fully responsive with Tailwind CSS. Include the Tailwind CDN script tag. Output a single complete HTML file.',
    category: 'client-sites',
    isCustom: false,
    outputType: 'landing-page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Full SaaS landing with pricing, testimonials, and FAQ',
    previewHint: 'Professional SaaS page with indigo theme, pricing cards, and testimonial quotes',
  },
  {
    id: 'site-local-business',
    title: 'Local Business',
    prompt: 'Create a complete local business website. Include: navigation bar with business name, phone number and "Call Now" button, hero section with headline and business description, services section with 3-4 service cards, business hours and location section side by side, Google Maps embed placeholder div, customer reviews section with 3 testimonial cards with star ratings, contact section with address/phone/email, and footer. Use a professional emerald green and white color scheme. Make it fully responsive with Tailwind CSS. Include the Tailwind CDN script tag. Output a single complete HTML file.',
    category: 'client-sites',
    isCustom: false,
    outputType: 'page',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind'],
    description: 'Local business with hours, services, reviews, and contact',
    previewHint: 'Business site with emerald theme, service cards, hours section, and review stars',
  },
  {
    id: 'site-ecommerce',
    title: 'E-commerce Store',
    prompt: 'Create a complete e-commerce storefront page. Include: navigation with logo, search bar, cart icon with badge count, hero banner with promotional text and "Shop Now" button, featured products grid (6 product cards with image placeholder, title, price, and "Add to Cart" button), category filter bar, newsletter signup section, and footer with payment icons and links. Use a modern rose/white color scheme. Make it fully responsive with Tailwind CSS. Include the Tailwind CDN script tag. Output a single complete HTML file.',
    category: 'client-sites',
    isCustom: false,
    outputType: 'page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Product storefront with cards, cart, and newsletter signup',
    previewHint: 'Shop page with product grid, cart icon, and promotional banner',
  },
  {
    id: 'site-portfolio',
    title: 'Creative Portfolio',
    prompt: 'Create a complete creative portfolio website. Include: minimal navigation with name and links to Work/About/Contact, hero section with large name, title, and one-line bio, project gallery grid with 6 project cards (image placeholder, project title, category tag) that have hover overlay effects, about section with bio paragraph and skills list, contact section with email link and social media icon links, and minimal footer. Use a neutral/minimal color scheme with subtle hover animations. Make it fully responsive with Tailwind CSS. Include the Tailwind CDN script tag. Output a single complete HTML file.',
    category: 'client-sites',
    isCustom: false,
    outputType: 'page',
    complexity: 'medium',
    techStack: ['HTML', 'Tailwind', 'CSS'],
    description: 'Minimal portfolio with project grid and hover effects',
    previewHint: 'Clean portfolio with project grid, hover overlays, and minimal typography',
  },
  {
    id: 'site-startup',
    title: 'Startup Pitch Page',
    prompt: 'Create a bold startup landing page. Include: navigation with logo and "Get Early Access" button, dramatic hero section with large bold headline on dark background, animated gradient or bold color accent, email waitlist signup form, social proof section showing logos of 4-5 fake partner companies as gray placeholder boxes, 3 key benefits section with large icons and short descriptions, team section with 3 team member cards (photo placeholder, name, role), and footer. Use a dark theme with purple/violet accents. Make it fully responsive with Tailwind CSS. Include the Tailwind CDN script tag. Output a single complete HTML file.',
    category: 'client-sites',
    isCustom: false,
    outputType: 'landing-page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'CSS'],
    description: 'Bold dark startup page with waitlist and social proof',
    previewHint: 'Dark theme with purple accents, bold hero text, and partner logo bar',
  },
  {
    id: 'site-service-company',
    title: 'Service Company',
    prompt: 'Create a professional service company website. Include: navigation with company name and Contact Us button, hero section with headline about services and a professional background, "What We Do" section with 4 service cards each with icon, title, and description, process/how-it-works section with 3 numbered steps, stats bar showing key numbers (years experience, clients served, projects completed), client logos section with 4-5 gray placeholder boxes, contact form section with name, email, phone, message fields and submit button, and professional footer with company info and links. Use a slate blue and white color scheme. Make it fully responsive with Tailwind CSS. Include the Tailwind CDN script tag. Output a single complete HTML file.',
    category: 'client-sites',
    isCustom: false,
    outputType: 'page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind'],
    description: 'Professional services site with process steps and contact form',
    previewHint: 'Corporate blue theme with service cards, stats bar, and contact form',
  },
  {
    id: 'site-real-estate',
    title: 'Real Estate Listing',
    prompt: 'Create a real estate property listing page. Include: navigation with agency name and "List Your Property" button, hero section with large property image placeholder and search/filter bar with dropdowns for location, price range, and property type, featured listings grid with 6 property cards (image placeholder, price, address, bed/bath/sqft icons with numbers, and "View Details" button), neighborhood highlights section with 3 cards, agent contact card with photo placeholder, name, phone, email, and "Schedule Viewing" button, and footer with agency info. Use a warm amber and white color scheme. Make it fully responsive with Tailwind CSS. Include the Tailwind CDN script tag. Output a single complete HTML file.',
    category: 'client-sites',
    isCustom: false,
    outputType: 'page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Property listings with search filters and agent contact',
    previewHint: 'Real estate page with property cards, search bar, and agent card',
  },
  {
    id: 'site-membership',
    title: 'Membership Site',
    prompt: 'Create a membership and subscription landing page. Include: navigation with brand name and Login/Sign Up buttons, hero section with compelling headline about joining the community and primary CTA button, benefits section with 4 benefit cards showing what members get (icons with descriptions), membership tiers section with 3 pricing cards (Free/Premium/VIP) showing features list with checkmarks and grayed-out unavailable features, social proof section with member count and 3 testimonial quotes, FAQ section with 4 expandable accordion items using JavaScript toggle, and footer with links. Use a modern teal and white color scheme. Make it fully responsive with Tailwind CSS. Include the Tailwind CDN script tag. Output a single complete HTML file.',
    category: 'client-sites',
    isCustom: false,
    outputType: 'landing-page',
    complexity: 'complex',
    techStack: ['HTML', 'Tailwind', 'JavaScript'],
    description: 'Membership landing with tiers, benefits, and FAQ accordion',
    previewHint: 'Membership page with teal theme, tiered pricing, and accordion FAQ',
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
