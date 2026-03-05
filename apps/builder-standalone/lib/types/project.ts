export interface ProjectToggles {
  seo: boolean;
  accessibility: boolean;
  privacy: boolean;
  analytics: boolean;
  security: boolean;
  performance: boolean;
  punchList: boolean;
  calendly: boolean;
  mailchimp: boolean;
}

export interface ToggleConfig {
  calendly?: { url: string };
  mailchimp?: { actionUrl: string };
}

export interface DeployUrls {
  github: string;
  vercel: string;
  netlify: string;
  cloudflare: string;
}

export interface RevisionItem {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
  completedAt?: string;
}

export interface ProjectRevisions {
  round: number;
  maxRounds: number;
  items: RevisionItem[];
}

export interface ProjectMeta {
  name: string;
  clientName: string;
  clientEmail: string;
  domain: string;
  createdAt: string;
  toggles: ProjectToggles;
  toggleConfig?: ToggleConfig;
  deployUrls: DeployUrls;
  revisions: ProjectRevisions;
  template?: string;
}

export const DEFAULT_TOGGLES: ProjectToggles = {
  seo: true,
  accessibility: true,
  privacy: true,
  analytics: true,
  security: false,
  performance: false,
  punchList: false,
  calendly: false,
  mailchimp: false,
};

export const TOGGLE_INFO: {
  key: keyof ProjectToggles;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    key: "seo",
    label: "SEO Optimization",
    description: "Auto meta tags, sitemap, robots.txt",
    color: "#4285f4",
  },
  {
    key: "accessibility",
    label: "ADA Accessibility",
    description: "WCAG 2.1 AA compliance check",
    color: "#22c55e",
  },
  {
    key: "privacy",
    label: "Privacy Compliance",
    description: "Privacy policy page, cookie consent",
    color: "#8b5cf6",
  },
  {
    key: "analytics",
    label: "Client Analytics",
    description: "Embed Plausible script, generate dashboard link",
    color: "#FF6700",
  },
  {
    key: "security",
    label: "Security Pack",
    description: "ReCaptcha, spam filters",
    color: "#ef4444",
  },
  {
    key: "performance",
    label: "Performance Boost",
    description: "Lazy-load images, minify CSS/JS",
    color: "#eab308",
  },
  {
    key: "punchList",
    label: "Punch List",
    description: "Enable client revision form after delivery",
    color: "#00b4d8",
  },
  {
    key: "calendly",
    label: "Calendly Booking",
    description: "Add a Book a Call button linked to your Calendly",
    color: "#006BFF",
  },
  {
    key: "mailchimp",
    label: "Mailchimp Signup",
    description: "Add email capture form for your mailing list",
    color: "#FFE01B",
  },
];
