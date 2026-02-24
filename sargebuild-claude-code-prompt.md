# SargeBuild v1 — Claude Code Build Instructions

## ⚠️ CRITICAL SAFETY RULES — READ BEFORE DOING ANYTHING

**DO NOT delete, rename, gut, rewrite, or restructure ANY existing files.**
**DO NOT remove any existing nav items, routes, stores, components, or API routes.**
**DO NOT modify any file not explicitly listed in the "FILES TO MODIFY" section below.**
**DO NOT touch the debate system, chat system, test mode, forensic system, or any other existing feature.**

If you are unsure whether a change will break something, STOP and ask.

Before modifying any existing file:
1. Read the ENTIRE file first
2. Make ONLY the specific additions described below
3. Do not refactor, clean up, or "improve" any existing code
4. Preserve every single import, variable, function, and line of existing code

---

## PROJECT CONTEXT

This is an existing Next.js 16 app called SARGE — a multi-feature AI workbench with 40+ API routes, 43 Zustand stores, and 30+ Builder components. It already has:

- ✅ Working Monaco editor in `components/Builder/ArtifactPanel.tsx`
- ✅ Working iframe preview (srcdoc + localhost) in `ArtifactPanel.tsx`
- ✅ Working streaming with anti-flicker debounce
- ✅ Zustand stores with persist middleware
- ✅ Dark theme (`dark:bg-zinc-950`)
- ✅ Header nav with mode switching (`components/layout/Header.tsx`)
- ✅ Builder page at `/builder` with chat + artifact panel
- ✅ Settings page at `/settings`
- ✅ `ollama` package (v0.6.3) already installed
- ✅ `@anthropic-ai/sdk`, `@google/generative-ai`, `openai` packages installed
- ✅ `@monaco-editor/react` (v4.7.0) already installed
- ✅ `react-resizable-panels` already installed
- ✅ `zustand` (v5.0.10) already installed

**We are ADDING SargeBuild as a new feature alongside everything that exists.** Nothing gets removed or replaced.

---

## WHAT WE'RE BUILDING

SargeBuild is a fast website builder feature that lets the user:
1. Pick from 8 pre-built templates
2. Use AI (local Ollama or cloud) to generate/refine HTML/CSS/JS
3. Edit code in Monaco with live preview
4. Export clean vanilla HTML/CSS/JS zip files for client delivery

It integrates INTO the existing Builder infrastructure — using the existing ArtifactPanel for code editing and preview, the existing BuilderChat for prompt input, and the existing stores for state management.

---

## STEP 1: CREATE NEW FILES (5 files)

### File 1: `lib/templates.ts`

```typescript
// SargeBuild Template System
// DO NOT modify any other files in lib/ — this is a new standalone file

export interface SargeBuildTemplate {
  id: string;
  name: string;
  category: 'landing' | 'business' | 'portfolio' | 'ecommerce' | 'minimal';
  thumbnail: string;
  description: string;
  files: {
    html: string;
    css: string;
    js?: string;
  };
  editableRegions: {
    id: string;
    label: string;
    selector: string;
    type: 'text' | 'image' | 'color' | 'link';
  }[];
  meta: {
    fonts: string[];
    colorScheme: string[];
    responsive: boolean;
    snipcartReady?: boolean;
  };
}

export const seedTemplates: SargeBuildTemplate[] = [
  {
    id: 'modern-clean',
    name: 'Modern Clean',
    category: 'landing',
    thumbnail: '/previews/modern-clean.png',
    description: 'Clean, minimal landing page with bold hero and CTA',
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modern Clean</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-gray-900">
  <nav class="flex items-center justify-between px-8 py-4 border-b">
    <span class="text-xl font-bold">Brand</span>
    <div class="flex gap-6 text-sm">
      <a href="#features" class="hover:text-blue-600">Features</a>
      <a href="#pricing" class="hover:text-blue-600">Pricing</a>
      <a href="#contact" class="hover:text-blue-600">Contact</a>
    </div>
  </nav>
  <section class="max-w-4xl mx-auto px-8 py-24 text-center">
    <h1 class="text-5xl font-bold mb-6">Your Business, Elevated</h1>
    <p class="text-xl text-gray-600 mb-8">Professional websites built in hours, not weeks.</p>
    <a href="#contact" class="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition">Get Started</a>
  </section>
  <section id="features" class="max-w-6xl mx-auto px-8 py-16 grid md:grid-cols-3 gap-8">
    <div class="text-center p-6">
      <div class="text-4xl mb-4">⚡</div>
      <h3 class="text-lg font-semibold mb-2">Lightning Fast</h3>
      <p class="text-gray-600">Built for speed from the ground up.</p>
    </div>
    <div class="text-center p-6">
      <div class="text-4xl mb-4">🎨</div>
      <h3 class="text-lg font-semibold mb-2">Beautiful Design</h3>
      <p class="text-gray-600">Every pixel crafted with care.</p>
    </div>
    <div class="text-center p-6">
      <div class="text-4xl mb-4">📱</div>
      <h3 class="text-lg font-semibold mb-2">Fully Responsive</h3>
      <p class="text-gray-600">Looks perfect on every device.</p>
    </div>
  </section>
  <footer class="text-center py-8 text-sm text-gray-500 border-t">
    &copy; 2026 Brand. All rights reserved.
  </footer>
</body>
</html>`,
      css: '',
    },
    editableRegions: [
      { id: 'brand', label: 'Brand Name', selector: 'nav span', type: 'text' },
      { id: 'hero-title', label: 'Hero Title', selector: 'h1', type: 'text' },
      { id: 'hero-subtitle', label: 'Hero Subtitle', selector: 'section p', type: 'text' },
      { id: 'cta-text', label: 'CTA Button Text', selector: 'section a', type: 'text' },
    ],
    meta: {
      fonts: ['Inter', 'system-ui'],
      colorScheme: ['#2563eb', '#ffffff', '#111827'],
      responsive: true,
    },
  },
  {
    id: 'bold-startup',
    name: 'Bold Startup',
    category: 'landing',
    thumbnail: '/previews/bold-startup.png',
    description: 'High-energy startup landing page with dark hero',
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bold Startup</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-black text-white">
  <nav class="flex items-center justify-between px-8 py-4">
    <span class="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">StartupName</span>
    <div class="flex gap-6 text-sm text-gray-400">
      <a href="#" class="hover:text-white">Product</a>
      <a href="#" class="hover:text-white">Pricing</a>
      <a href="#" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">Launch App</a>
    </div>
  </nav>
  <section class="max-w-4xl mx-auto px-8 py-32 text-center">
    <div class="inline-block px-4 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm mb-6">Now in Beta</div>
    <h1 class="text-6xl font-black mb-6 leading-tight">Build the Future.<br>Ship It Today.</h1>
    <p class="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">The all-in-one platform for teams that move fast and break records, not promises.</p>
    <div class="flex gap-4 justify-center">
      <a href="#" class="bg-purple-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-purple-700 transition">Start Free Trial</a>
      <a href="#" class="border border-gray-700 text-gray-300 px-8 py-3 rounded-lg text-lg font-medium hover:border-gray-500 transition">Watch Demo</a>
    </div>
  </section>
  <footer class="text-center py-8 text-sm text-gray-600 border-t border-gray-800">
    &copy; 2026 StartupName. All rights reserved.
  </footer>
</body>
</html>`,
      css: '',
    },
    editableRegions: [
      { id: 'brand', label: 'Startup Name', selector: 'nav span', type: 'text' },
      { id: 'hero-title', label: 'Hero Title', selector: 'h1', type: 'text' },
      { id: 'hero-subtitle', label: 'Hero Subtitle', selector: 'section p', type: 'text' },
    ],
    meta: {
      fonts: ['Inter', 'system-ui'],
      colorScheme: ['#9333ea', '#000000', '#ffffff'],
      responsive: true,
    },
  },
  {
    id: 'professional-corporate',
    name: 'Professional Corporate',
    category: 'business',
    thumbnail: '/previews/professional-corporate.png',
    description: 'Clean corporate site with services and contact sections',
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Professional Corporate</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-gray-800">
  <nav class="flex items-center justify-between px-8 py-4 bg-slate-900 text-white">
    <span class="text-xl font-bold">CompanyName</span>
    <div class="flex gap-6 text-sm">
      <a href="#services" class="hover:text-blue-300">Services</a>
      <a href="#about" class="hover:text-blue-300">About</a>
      <a href="#contact" class="hover:text-blue-300">Contact</a>
    </div>
  </nav>
  <section class="bg-slate-900 text-white px-8 py-24">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-4xl font-bold mb-4">Trusted Solutions for Growing Businesses</h1>
      <p class="text-lg text-slate-300 mb-8">We deliver results that matter. 20+ years of industry experience.</p>
      <a href="#contact" class="bg-blue-600 text-white px-6 py-3 rounded font-medium hover:bg-blue-700 transition">Schedule Consultation</a>
    </div>
  </section>
  <section id="services" class="max-w-6xl mx-auto px-8 py-16">
    <h2 class="text-3xl font-bold text-center mb-12">Our Services</h2>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="border rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-2">Consulting</h3>
        <p class="text-gray-600">Strategic guidance to help your business thrive in a competitive market.</p>
      </div>
      <div class="border rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-2">Implementation</h3>
        <p class="text-gray-600">End-to-end project delivery with proven methodologies.</p>
      </div>
      <div class="border rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-2">Support</h3>
        <p class="text-gray-600">24/7 dedicated support to keep your operations running smoothly.</p>
      </div>
    </div>
  </section>
  <section id="contact" class="bg-gray-50 px-8 py-16">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="text-3xl font-bold mb-4">Get In Touch</h2>
      <p class="text-gray-600 mb-8">Ready to take the next step? Contact us today.</p>
      <a href="mailto:info@company.com" class="bg-slate-900 text-white px-8 py-3 rounded font-medium hover:bg-slate-800 transition">Contact Us</a>
    </div>
  </section>
  <footer class="bg-slate-900 text-slate-400 text-center py-8 text-sm">
    &copy; 2026 CompanyName. All rights reserved.
  </footer>
</body>
</html>`,
      css: '',
    },
    editableRegions: [
      { id: 'brand', label: 'Company Name', selector: 'nav span', type: 'text' },
      { id: 'hero-title', label: 'Hero Title', selector: 'h1', type: 'text' },
      { id: 'hero-subtitle', label: 'Hero Subtitle', selector: '.text-slate-300', type: 'text' },
    ],
    meta: {
      fonts: ['Inter', 'system-ui'],
      colorScheme: ['#1e293b', '#2563eb', '#ffffff'],
      responsive: true,
    },
  },
  {
    id: 'creative-portfolio',
    name: 'Creative Portfolio',
    category: 'portfolio',
    thumbnail: '/previews/creative-portfolio.png',
    description: 'Minimal portfolio with project grid',
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Creative Portfolio</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-neutral-50 text-neutral-900">
  <nav class="flex items-center justify-between px-8 py-6">
    <span class="text-lg font-medium">Your Name</span>
    <div class="flex gap-6 text-sm text-neutral-500">
      <a href="#work" class="hover:text-neutral-900">Work</a>
      <a href="#about" class="hover:text-neutral-900">About</a>
      <a href="mailto:hello@you.com" class="hover:text-neutral-900">Contact</a>
    </div>
  </nav>
  <section class="max-w-3xl mx-auto px-8 py-20">
    <h1 class="text-4xl font-bold mb-4">Designer &amp; Developer</h1>
    <p class="text-lg text-neutral-500">I create beautiful digital experiences that people love to use.</p>
  </section>
  <section id="work" class="max-w-6xl mx-auto px-8 py-8 grid md:grid-cols-2 gap-6">
    <div class="aspect-video bg-neutral-200 rounded-xl flex items-center justify-center text-neutral-400">Project 1</div>
    <div class="aspect-video bg-neutral-200 rounded-xl flex items-center justify-center text-neutral-400">Project 2</div>
    <div class="aspect-video bg-neutral-200 rounded-xl flex items-center justify-center text-neutral-400">Project 3</div>
    <div class="aspect-video bg-neutral-200 rounded-xl flex items-center justify-center text-neutral-400">Project 4</div>
  </section>
  <footer class="text-center py-12 text-sm text-neutral-400">
    &copy; 2026 Your Name
  </footer>
</body>
</html>`,
      css: '',
    },
    editableRegions: [
      { id: 'name', label: 'Your Name', selector: 'nav span', type: 'text' },
      { id: 'title', label: 'Title', selector: 'h1', type: 'text' },
      { id: 'bio', label: 'Bio', selector: 'section p', type: 'text' },
    ],
    meta: {
      fonts: ['Inter', 'system-ui'],
      colorScheme: ['#fafaf9', '#171717', '#a3a3a3'],
      responsive: true,
    },
  },
  {
    id: 'minimal-elegant',
    name: 'Minimal Elegant',
    category: 'minimal',
    thumbnail: '/previews/minimal-elegant.png',
    description: 'Ultra-minimal single page with typography focus',
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minimal Elegant</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
</head>
<body class="bg-white text-gray-900 max-w-2xl mx-auto px-6 py-16">
  <header class="mb-20">
    <h1 class="text-3xl font-bold" style="font-family: 'Playfair Display', serif">Brand</h1>
  </header>
  <main>
    <p class="text-xl leading-relaxed text-gray-700 mb-8">We believe in the power of simplicity. Less noise, more impact. Every detail intentional, every word purposeful.</p>
    <p class="text-xl leading-relaxed text-gray-700 mb-12">Our work speaks for itself.</p>
    <a href="mailto:hello@brand.com" class="text-lg underline underline-offset-4 decoration-gray-300 hover:decoration-gray-900 transition">Get in touch &rarr;</a>
  </main>
  <footer class="mt-32 text-sm text-gray-400">
    &copy; 2026
  </footer>
</body>
</html>`,
      css: '',
    },
    editableRegions: [
      { id: 'brand', label: 'Brand Name', selector: 'h1', type: 'text' },
      { id: 'body-text', label: 'Body Text', selector: 'main p:first-child', type: 'text' },
    ],
    meta: {
      fonts: ['Playfair Display', 'system-ui'],
      colorScheme: ['#ffffff', '#111827', '#9ca3af'],
      responsive: true,
    },
  },
  {
    id: 'saas-landing',
    name: 'SaaS Landing',
    category: 'landing',
    thumbnail: '/previews/saas-landing.png',
    description: 'SaaS product landing with pricing and features',
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SaaS Landing</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900">
  <nav class="flex items-center justify-between px-8 py-4 bg-white border-b">
    <span class="text-xl font-bold text-indigo-600">SaaSName</span>
    <div class="flex items-center gap-6 text-sm">
      <a href="#features" class="hover:text-indigo-600">Features</a>
      <a href="#pricing" class="hover:text-indigo-600">Pricing</a>
      <a href="#" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Start Free</a>
    </div>
  </nav>
  <section class="max-w-4xl mx-auto px-8 py-24 text-center">
    <h1 class="text-5xl font-bold mb-6">Automate Your Workflow</h1>
    <p class="text-xl text-gray-600 mb-8">Save 10+ hours per week with intelligent automation. No code required.</p>
    <div class="flex gap-4 justify-center">
      <a href="#" class="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-indigo-700 transition">Start Free Trial</a>
      <a href="#" class="border border-gray-300 px-8 py-3 rounded-lg text-lg font-medium hover:border-gray-400 transition">See Demo</a>
    </div>
  </section>
  <section id="pricing" class="max-w-5xl mx-auto px-8 py-16">
    <h2 class="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="bg-white border rounded-xl p-8">
        <h3 class="text-lg font-semibold mb-2">Starter</h3>
        <div class="text-3xl font-bold mb-4">$9<span class="text-base font-normal text-gray-500">/mo</span></div>
        <ul class="text-sm text-gray-600 space-y-2 mb-6">
          <li>✓ 5 automations</li>
          <li>✓ 1,000 runs/month</li>
          <li>✓ Email support</li>
        </ul>
        <a href="#" class="block text-center border border-indigo-600 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 transition">Get Started</a>
      </div>
      <div class="bg-indigo-600 text-white rounded-xl p-8 shadow-xl">
        <h3 class="text-lg font-semibold mb-2">Pro</h3>
        <div class="text-3xl font-bold mb-4">$29<span class="text-base font-normal text-indigo-200">/mo</span></div>
        <ul class="text-sm text-indigo-100 space-y-2 mb-6">
          <li>✓ Unlimited automations</li>
          <li>✓ 10,000 runs/month</li>
          <li>✓ Priority support</li>
        </ul>
        <a href="#" class="block text-center bg-white text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 transition font-medium">Get Started</a>
      </div>
      <div class="bg-white border rounded-xl p-8">
        <h3 class="text-lg font-semibold mb-2">Enterprise</h3>
        <div class="text-3xl font-bold mb-4">Custom</div>
        <ul class="text-sm text-gray-600 space-y-2 mb-6">
          <li>✓ Everything in Pro</li>
          <li>✓ Unlimited runs</li>
          <li>✓ Dedicated support</li>
        </ul>
        <a href="#" class="block text-center border border-indigo-600 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 transition">Contact Sales</a>
      </div>
    </div>
  </section>
  <footer class="text-center py-8 text-sm text-gray-500 border-t">
    &copy; 2026 SaaSName. All rights reserved.
  </footer>
</body>
</html>`,
      css: '',
    },
    editableRegions: [
      { id: 'brand', label: 'SaaS Name', selector: 'nav span', type: 'text' },
      { id: 'hero-title', label: 'Hero Title', selector: 'h1', type: 'text' },
      { id: 'hero-subtitle', label: 'Hero Subtitle', selector: 'section > p', type: 'text' },
    ],
    meta: {
      fonts: ['Inter', 'system-ui'],
      colorScheme: ['#4f46e5', '#f9fafb', '#111827'],
      responsive: true,
    },
  },
  {
    id: 'local-business',
    name: 'Local Business',
    category: 'business',
    thumbnail: '/previews/local-business.png',
    description: 'Local business with hours, location, and contact',
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Local Business</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-gray-800">
  <nav class="flex items-center justify-between px-8 py-4 bg-emerald-700 text-white">
    <span class="text-xl font-bold">Business Name</span>
    <div class="flex gap-4 text-sm">
      <a href="#services" class="hover:text-emerald-200">Services</a>
      <a href="#hours" class="hover:text-emerald-200">Hours</a>
      <a href="tel:+15551234567" class="bg-white text-emerald-700 px-4 py-1.5 rounded font-medium hover:bg-emerald-50">Call Now</a>
    </div>
  </nav>
  <section class="bg-emerald-700 text-white px-8 py-20">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-4xl font-bold mb-4">Your Trusted Local Partner</h1>
      <p class="text-lg text-emerald-100 mb-6">Serving the community since 2010. Quality work, fair prices.</p>
      <div class="flex gap-4">
        <a href="tel:+15551234567" class="bg-white text-emerald-700 px-6 py-3 rounded font-medium hover:bg-emerald-50 transition">📞 (555) 123-4567</a>
        <a href="#" class="border border-emerald-300 px-6 py-3 rounded font-medium hover:bg-emerald-600 transition">Get Directions</a>
      </div>
    </div>
  </section>
  <section id="hours" class="max-w-3xl mx-auto px-8 py-16">
    <h2 class="text-2xl font-bold mb-6">Hours &amp; Location</h2>
    <div class="grid md:grid-cols-2 gap-8">
      <div>
        <h3 class="font-semibold mb-3">Business Hours</h3>
        <ul class="text-gray-600 space-y-1">
          <li>Monday - Friday: 8am - 6pm</li>
          <li>Saturday: 9am - 4pm</li>
          <li>Sunday: Closed</li>
        </ul>
      </div>
      <div>
        <h3 class="font-semibold mb-3">Location</h3>
        <p class="text-gray-600">123 Main Street<br>Anytown, USA 12345</p>
      </div>
    </div>
  </section>
  <footer class="bg-emerald-800 text-emerald-200 text-center py-8 text-sm">
    &copy; 2026 Business Name. All rights reserved.
  </footer>
</body>
</html>`,
      css: '',
    },
    editableRegions: [
      { id: 'brand', label: 'Business Name', selector: 'nav span', type: 'text' },
      { id: 'hero-title', label: 'Hero Title', selector: 'h1', type: 'text' },
      { id: 'phone', label: 'Phone Number', selector: 'a[href^="tel:"]', type: 'text' },
    ],
    meta: {
      fonts: ['Inter', 'system-ui'],
      colorScheme: ['#047857', '#ffffff', '#1f2937'],
      responsive: true,
    },
  },
  {
    id: 'tiny-ecommerce',
    name: 'Tiny E-commerce',
    category: 'ecommerce',
    thumbnail: '/previews/tiny-ecommerce.png',
    description: 'Simple product showcase ready for Snipcart integration',
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tiny E-commerce</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900">
  <nav class="flex items-center justify-between px-8 py-4 bg-white border-b">
    <span class="text-xl font-bold">ShopName</span>
    <div class="flex items-center gap-6 text-sm">
      <a href="#products" class="hover:text-rose-600">Products</a>
      <a href="#" class="hover:text-rose-600">About</a>
      <button class="relative">🛒 <span class="absolute -top-1 -right-2 bg-rose-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">0</span></button>
    </div>
  </nav>
  <section class="max-w-4xl mx-auto px-8 py-16 text-center">
    <h1 class="text-4xl font-bold mb-4">Handcrafted with Love</h1>
    <p class="text-lg text-gray-600">Unique products made just for you.</p>
  </section>
  <section id="products" class="max-w-6xl mx-auto px-8 py-8 grid md:grid-cols-3 gap-8">
    <div class="bg-white rounded-xl overflow-hidden shadow-sm border">
      <div class="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Product Image</div>
      <div class="p-4">
        <h3 class="font-semibold">Product One</h3>
        <p class="text-gray-500 text-sm mb-3">Short description here.</p>
        <div class="flex items-center justify-between">
          <span class="text-lg font-bold">$29.99</span>
          <button class="bg-rose-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-rose-700 transition">Add to Cart</button>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-xl overflow-hidden shadow-sm border">
      <div class="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Product Image</div>
      <div class="p-4">
        <h3 class="font-semibold">Product Two</h3>
        <p class="text-gray-500 text-sm mb-3">Short description here.</p>
        <div class="flex items-center justify-between">
          <span class="text-lg font-bold">$49.99</span>
          <button class="bg-rose-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-rose-700 transition">Add to Cart</button>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-xl overflow-hidden shadow-sm border">
      <div class="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Product Image</div>
      <div class="p-4">
        <h3 class="font-semibold">Product Three</h3>
        <p class="text-gray-500 text-sm mb-3">Short description here.</p>
        <div class="flex items-center justify-between">
          <span class="text-lg font-bold">$39.99</span>
          <button class="bg-rose-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-rose-700 transition">Add to Cart</button>
        </div>
      </div>
    </div>
  </section>
  <footer class="text-center py-8 text-sm text-gray-500 border-t mt-8">
    &copy; 2026 ShopName. All rights reserved.
  </footer>
</body>
</html>`,
      css: '',
    },
    editableRegions: [
      { id: 'brand', label: 'Shop Name', selector: 'nav span', type: 'text' },
      { id: 'hero-title', label: 'Hero Title', selector: 'h1', type: 'text' },
    ],
    meta: {
      fonts: ['Inter', 'system-ui'],
      colorScheme: ['#e11d48', '#f9fafb', '#111827'],
      responsive: true,
      snipcartReady: true,
    },
  },
];

// Helper: get template by ID
export function getTemplate(id: string): SargeBuildTemplate | undefined {
  return seedTemplates.find(t => t.id === id);
}

// Helper: get templates by category
export function getTemplatesByCategory(category: SargeBuildTemplate['category']): SargeBuildTemplate[] {
  return seedTemplates.filter(t => t.category === category);
}

// Helper: get all categories
export function getCategories(): SargeBuildTemplate['category'][] {
  return ['landing', 'business', 'portfolio', 'ecommerce', 'minimal'];
}
```

### File 2: `lib/sarge-build.ts`

```typescript
// SargeBuild — AI Routing, Task Classification, Anchor Injection, Export
// DO NOT modify any other files in lib/ — this is a new standalone file

import JSZip from 'jszip';

// ============================================
// TWO-TIER AI CONFIG
// ============================================

export interface SargeBuildAIConfig {
  tiers: {
    local: {
      provider: 'ollama';
      primary: string;
      fallback: string;
      maxTokens: number;
      tasks: string[];
    };
    cloud: {
      provider: 'anthropic' | 'xai' | 'google' | 'deepseek';
      model: string;
      apiKey: string;
      maxTokens: number;
      tasks: string[];
    };
  };
  routing: 'auto' | 'manual';
  fallbackToCloud: boolean;
  maxRetries: number;
}

export const defaultSargeBuildConfig: SargeBuildAIConfig = {
  tiers: {
    local: {
      provider: 'ollama',
      primary: 'qwen2.5-coder:7b',
      fallback: 'deepseek-coder:6.7b',
      maxTokens: 4096,
      tasks: [
        'component', 'style-change', 'text-edit', 'color-swap',
        'nav-structure', 'responsive-layout', 'section-generation',
        'form-wiring'
      ],
    },
    cloud: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      apiKey: '',
      maxTokens: 8192,
      tasks: [
        'full-page-generation', 'multi-page-site',
        'complex-logic', 'ecommerce-setup'
      ],
    },
  },
  routing: 'auto',
  fallbackToCloud: true,
  maxRetries: 3,
};

// ============================================
// TASK CLASSIFIER
// ============================================

export function classifyTask(prompt: string): 'local' | 'cloud' {
  const localPatterns = /change (color|text|font|background)|make .* (bigger|smaller|bold|italic|centered)|update (button|link|image|heading)|swap (image|icon|logo)|add (nav|navigation|header|footer|form|section|card|grid)|make responsive|wire .* link|fix (spacing|padding|margin|alignment)|remove (section|element|div)/i;
  if (localPatterns.test(prompt)) return 'local';
  return 'cloud';
}

// ============================================
// TRUTH ANCHOR INJECTION
// ============================================

export interface ClientInfo {
  businessName: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoPath?: string;
  brandColors?: string[];
}

export function buildAnchorPrompt(clientInfo: ClientInfo | undefined): string {
  if (!clientInfo || !clientInfo.businessName) return '';

  let anchors = `\n\nTRUTH ANCHORS — Use these EXACTLY as provided. Do NOT invent, modify, or hallucinate alternatives:\n`;
  anchors += `- Business Name: ${clientInfo.businessName}\n`;
  if (clientInfo.tagline) anchors += `- Tagline: ${clientInfo.tagline}\n`;
  if (clientInfo.phone) anchors += `- Phone: ${clientInfo.phone}\n`;
  if (clientInfo.email) anchors += `- Email: ${clientInfo.email}\n`;
  if (clientInfo.address) anchors += `- Address: ${clientInfo.address}\n`;
  if (clientInfo.brandColors?.length) anchors += `- Brand Colors: ${clientInfo.brandColors.join(', ')}\n`;
  if (clientInfo.logoPath) anchors += `- Logo: included at ${clientInfo.logoPath}\n`;

  return anchors;
}

// ============================================
// SYSTEM PROMPTS FOR AGENTS
// ============================================

export const GENERATOR_SYSTEM_PROMPT = `You are a professional web developer. Generate clean, semantic HTML with Tailwind CSS classes. 
Output ONLY the complete HTML document — no markdown, no code fences, no explanations. 
Always include: <!DOCTYPE html>, <html>, <head> with viewport meta and Tailwind CDN script, <body>.
Use <script src="https://cdn.tailwindcss.com"></script> for styling.
Make all output responsive and mobile-friendly.`;

export const REVIEWER_SYSTEM_PROMPT = `You are a code reviewer for HTML/CSS websites. Review the provided HTML and check for:
1. Valid HTML structure (DOCTYPE, html, head, body)
2. Responsive meta viewport tag
3. Tailwind CDN included
4. No broken links or missing alt text
5. Semantic HTML usage
6. Mobile responsiveness

Respond with JSON only: { "passed": boolean, "issues": string[] }
If no issues, respond: { "passed": true, "issues": [] }`;

export const REFINER_SYSTEM_PROMPT = `You are a web developer making targeted edits to HTML. 
You will receive the current HTML code and an edit instruction.
Output ONLY the complete updated HTML document — no markdown, no code fences, no explanations.
Preserve ALL existing content unless specifically asked to change it.
Keep the Tailwind CDN script tag intact.`;

// ============================================
// EXPORT TO ZIP
// ============================================

export async function exportToZip(
  html: string,
  css: string,
  js: string | undefined,
  projectName: string
): Promise<Blob> {
  const zip = new JSZip();

  // Add index.html
  zip.file('index.html', html);

  // Add styles.css if there's custom CSS beyond Tailwind
  if (css && css.trim().length > 0) {
    zip.file('styles.css', css);
  }

  // Add script.js if there's custom JS
  if (js && js.trim().length > 0) {
    zip.file('script.js', js);
  }

  // Add deploy instructions
  const deployInstructions = `# Deploy Instructions for ${projectName}

## Option 1: Netlify (Recommended)
1. Go to https://app.netlify.com/drop
2. Drag and drop this entire folder onto the page
3. Your site will be live in seconds!

## Option 2: Vercel
1. Go to https://vercel.com/new
2. Choose "Import from directory"
3. Upload this folder
4. Click Deploy

## Option 3: Any Static Host
Upload all files to any web server or static hosting provider.
The site is pure HTML/CSS/JS — no build step needed.

## Files Included
- index.html — Your website
${css && css.trim().length > 0 ? '- styles.css — Custom styles\n' : ''}${js && js.trim().length > 0 ? '- script.js — Custom functionality\n' : ''}- README.txt — This file

Built with SargeBuild — Fast AI-Assisted Website Builder
`;

  zip.file('README.txt', deployInstructions);

  return await zip.generateAsync({ type: 'blob' });
}

// Trigger browser download of the zip
export function downloadZip(blob: Blob, projectName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()}-site.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### File 3: `app/templates/page.tsx`

```tsx
"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { seedTemplates, getCategories, getTemplatesByCategory, SargeBuildTemplate } from "@/lib/templates";
import { useArtifactStore } from "@/lib/stores/artifactStore";
import { cn } from "@/lib/utils";

const categoryLabels: Record<string, string> = {
  landing: '🚀 Landing Pages',
  business: '🏢 Business',
  portfolio: '🎨 Portfolio',
  ecommerce: '🛒 E-commerce',
  minimal: '✨ Minimal',
};

export default function TemplatesPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const { setCode } = useArtifactStore();

  const categories = getCategories();
  const filtered = activeFilter === 'all'
    ? seedTemplates
    : getTemplatesByCategory(activeFilter as SargeBuildTemplate['category']);

  const handleSelectTemplate = (template: SargeBuildTemplate) => {
    // Load template HTML into the artifact store so ArtifactPanel picks it up
    setCode(template.files.html, null, null);
    // Navigate to builder
    router.push('/builder');
  };

  return (
    <div className="h-full overflow-auto bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">SargeBuild Templates</h1>
          <p className="text-zinc-400">Pick a template to start building. Click to load into the Builder.</p>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mb-8 flex-wrap">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeFilter === 'all'
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
            )}
          >
            All ({seedTemplates.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeFilter === cat
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
              )}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(template => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className="group text-left bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
            >
              {/* Preview thumbnail */}
              <div className="aspect-video bg-zinc-800 flex items-center justify-center text-zinc-600 text-sm group-hover:bg-zinc-750">
                {/* Placeholder — replace with actual screenshots later */}
                <span className="text-2xl">
                  {template.category === 'landing' ? '🚀' :
                   template.category === 'business' ? '🏢' :
                   template.category === 'portfolio' ? '🎨' :
                   template.category === 'ecommerce' ? '🛒' : '✨'}
                </span>
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-zinc-100 mb-1">{template.name}</h3>
                <p className="text-sm text-zinc-500">{template.description}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {template.category}
                  </span>
                  {template.meta.snipcartReady && (
                    <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                      Cart Ready
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Start blank option */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setCode(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Site</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>

</body>
</html>`, null, null);
              router.push('/builder');
            }}
            className="text-zinc-500 hover:text-zinc-300 text-sm underline underline-offset-4"
          >
            Or start with a blank page →
          </button>
        </div>
      </div>
    </div>
  );
}
```

### File 4: `app/sargebuild-projects/page.tsx`

Note: Using `/sargebuild-projects` to avoid conflicting with any existing `/projects` route.

```tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, FolderOpen, Copy, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToZip, downloadZip } from "@/lib/sarge-build";
import { cn } from "@/lib/utils";

interface SargeBuildProject {
  id: string;
  name: string;
  templateId: string | null;
  html: string;
  css: string;
  js?: string;
  clientName?: string;
  createdAt: string;
  updatedAt: string;
}

export default function SargeBuildProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<SargeBuildProject[]>([]);

  // Load projects from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sargebuild-projects');
      if (stored) setProjects(JSON.parse(stored));
    } catch {}
  }, []);

  const handleExport = async (project: SargeBuildProject) => {
    const blob = await exportToZip(project.html, project.css, project.js, project.name);
    downloadZip(blob, project.name);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    localStorage.setItem('sargebuild-projects', JSON.stringify(updated));
  };

  return (
    <div className="h-full overflow-auto bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">SargeBuild Projects</h1>
            <p className="text-zinc-400">Your saved client sites. Export, duplicate, or re-open.</p>
          </div>
          <Button
            onClick={() => router.push('/templates')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">Pick a template and build your first site!</p>
            <Button
              onClick={() => router.push('/templates')}
              className="mt-6 bg-blue-600 hover:bg-blue-700"
            >
              Browse Templates
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map(project => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition"
              >
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-sm text-zinc-500">
                    {project.clientName || 'No client'} · Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExport(project)}
                    className="text-zinc-400 hover:text-zinc-100"
                    title="Export zip"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(project.id)}
                    className="text-zinc-400 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### File 5: `app/handoff/page.tsx`

```tsx
"use client";
import React, { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HandoffPage() {
  const [copiedNetlify, setCopiedNetlify] = useState(false);
  const [copiedVercel, setCopiedVercel] = useState(false);

  const netlifyInstructions = `How to deploy your site on Netlify:

1. Go to https://app.netlify.com/drop
2. Drag and drop the zip folder contents onto the page
3. Wait about 10 seconds
4. Your site is live! Copy the URL and share it.

That's it — no account needed for the first deploy.
For a custom domain, create a free Netlify account and follow their domain setup.`;

  const vercelInstructions = `How to deploy your site on Vercel:

1. Go to https://vercel.com/new
2. Click "Import from directory"
3. Upload the folder contents
4. Click Deploy
5. Your site is live!

For a custom domain, go to your project settings > Domains.`;

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="h-full overflow-auto bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Client Hand-off Guide</h1>
        <p className="text-zinc-400 mb-8">Send these instructions to your client along with their zip file.</p>

        {/* Netlify */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="text-teal-400">▲</span> Deploy on Netlify
            </h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(netlifyInstructions, setCopiedNetlify)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                {copiedNetlify ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                {copiedNetlify ? 'Copied' : 'Copy'}
              </Button>
              <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100">
                  <ExternalLink className="h-4 w-4 mr-1" /> Open Netlify
                </Button>
              </a>
            </div>
          </div>
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap bg-zinc-950 rounded-lg p-4 font-mono">
            {netlifyInstructions}
          </pre>
        </div>

        {/* Vercel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="text-zinc-300">▲</span> Deploy on Vercel
            </h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(vercelInstructions, setCopiedVercel)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                {copiedVercel ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                {copiedVercel ? 'Copied' : 'Copy'}
              </Button>
              <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100">
                  <ExternalLink className="h-4 w-4 mr-1" /> Open Vercel
                </Button>
              </a>
            </div>
          </div>
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap bg-zinc-950 rounded-lg p-4 font-mono">
            {vercelInstructions}
          </pre>
        </div>

        {/* Loom placeholder */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">📹 Video Walkthrough</h2>
          <div className="aspect-video bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500">
            <p className="text-sm">Record a 60-second Loom video and paste the embed URL here</p>
          </div>
          <p className="text-sm text-zinc-500 mt-3">
            Tip: Record yourself deploying on Netlify Drop — it takes 30 seconds and clients love seeing it.
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## STEP 2: INSTALL ONE NEW DEPENDENCY

```bash
npm install jszip
```

This is needed for the export-to-zip function. Everything else is already installed.

---

## STEP 3: MODIFY EXISTING FILES (3 files — ADDITIONS ONLY)

### Modify 1: `components/layout/Header.tsx`

Find the `NAV_ITEMS` array (around line 28-47). Add these 3 items to the END of the array, BEFORE the closing bracket. Do NOT remove or reorder any existing items:

```typescript
// ADD these 3 items at the end of NAV_ITEMS array:
{ label: "Templates", icon: "🏗️", path: "/templates" },
{ label: "Sites", icon: "📦", path: "/sargebuild-projects" },
{ label: "Handoff", icon: "🤝", path: "/handoff" },
```

The exact format should match the existing NAV_ITEMS entries. Look at how the other items are structured and match that pattern exactly. If they use an object with `label`, `icon`, `path` — use that. If they use additional fields like `mode` or `key`, add appropriate values.

**DO NOT change any existing items. DO NOT reorder anything. Just append these 3 at the end.**

### Modify 2: `components/Builder/ArtifactPanel.tsx`

**Addition A — Add import at top of file (after existing imports, around line 15):**

```typescript
import { exportToZip, downloadZip } from "@/lib/sarge-build";
```

**Addition B — Add "Export for Client" button in the toolbar section (around line 747-750, near the existing Download and Copy buttons):**

Find this existing code block in the toolbar:
```tsx
{/* Download */}
<Button
  variant="ghost"
  size="sm"
  onClick={handleDownload}
```

BEFORE that Download button, add:

```tsx
{/* Export for Client (SargeBuild) */}
<Button
  variant="ghost"
  size="sm"
  onClick={async () => {
    if (!code) return;
    const name = projectName || storeProjectName || 'client-site';
    const blob = await exportToZip(code, '', undefined, name);
    downloadZip(blob, name);
    showToast({ message: `Exported ${name} as zip`, type: 'success' });
  }}
  disabled={!code}
  className="h-7 gap-1.5 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
  title="Export as client-ready zip (HTML/CSS/JS + deploy instructions)"
>
  <Download className="h-3.5 w-3.5" />
  Export for Client
</Button>
```

**DO NOT modify any other part of ArtifactPanel.tsx. Leave every existing function, state, effect, and prop exactly as they are.**

### Modify 3: `lib/stores/settingsStore.ts`

**Addition — Add SargeBuild config fields to the store. Add these to the SettingsState interface AND to the create() call:**

In the `interface SettingsState` (around line 12), add AFTER the existing fields:

```typescript
// SargeBuild tier config
sargeBuildRouting: 'auto' | 'manual';
sargeBuildFallbackToCloud: boolean;
sargeBuildLocalModel: string;
sargeBuildLocalFallback: string;
sargeBuildCloudProvider: string;
sargeBuildCloudModel: string;
setSargeBuildRouting: (routing: 'auto' | 'manual') => void;
setSargeBuildFallbackToCloud: (enabled: boolean) => void;
setSargeBuildLocalModel: (model: string) => void;
setSargeBuildLocalFallback: (model: string) => void;
setSargeBuildCloudProvider: (provider: string) => void;
setSargeBuildCloudModel: (model: string) => void;
```

In the `create<SettingsState>` call, add AFTER the existing state fields (around line 55):

```typescript
// SargeBuild defaults
sargeBuildRouting: 'auto',
sargeBuildFallbackToCloud: true,
sargeBuildLocalModel: 'qwen2.5-coder:7b',
sargeBuildLocalFallback: 'deepseek-coder:6.7b',
sargeBuildCloudProvider: 'anthropic',
sargeBuildCloudModel: 'claude-sonnet-4-5-20250929',
setSargeBuildRouting: (routing) => set({ sargeBuildRouting: routing }),
setSargeBuildFallbackToCloud: (enabled) => set({ sargeBuildFallbackToCloud: enabled }),
setSargeBuildLocalModel: (model) => set({ sargeBuildLocalModel: model }),
setSargeBuildLocalFallback: (model) => set({ sargeBuildLocalFallback: model }),
setSargeBuildCloudProvider: (provider) => set({ sargeBuildCloudProvider: provider }),
setSargeBuildCloudModel: (model) => set({ sargeBuildCloudModel: model }),
```

**DO NOT change any existing fields or actions. Just add these new ones alongside them.**

---

## STEP 4: VERIFY NOTHING IS BROKEN

After making all changes, verify:

1. `npm run dev` starts without errors
2. Navigate to every existing page (Dashboard, Chat, Debate, Builder, Settings, etc.) and confirm they still work
3. Navigate to the new pages:
   - `/templates` shows the 8 template cards
   - `/sargebuild-projects` shows the empty projects page
   - `/handoff` shows the deploy instructions
4. Click a template card — it should load the HTML into the Builder's code editor
5. In the Builder, the "Export for Client" button appears in the toolbar
6. Click "Export for Client" — it downloads a zip file containing index.html + README.txt

If ANY existing page is broken, STOP and tell me what happened. Do not try to fix it by modifying more files.

---

## WHAT THIS DOES NOT INCLUDE (Future Steps)

These are NOT part of this build. Do not implement them:
- Live Ollama API calls in the Builder (will be wired up separately)
- Settings page UI for SargeBuild config (will be added later)
- Actual template thumbnail images (using emoji placeholders for now)
- Client info form in the Builder (will be added later)
- Agent pipeline (Generator → Reviewer → Refiner loop — will be wired up separately)

The goal of THIS build is: get the pages, templates, navigation, and export working. AI integration comes next.

---

## SUMMARY OF ALL CHANGES

**New files created (5):**
- `lib/templates.ts`
- `lib/sarge-build.ts`
- `app/templates/page.tsx`
- `app/sargebuild-projects/page.tsx`
- `app/handoff/page.tsx`

**Existing files modified (3):**
- `components/layout/Header.tsx` — 3 nav items appended
- `components/Builder/ArtifactPanel.tsx` — 1 import + 1 button added
- `lib/stores/settingsStore.ts` — SargeBuild config fields added

**New dependencies (1):**
- `jszip`

**Files NOT touched:** Everything else. All 43 stores, all 40+ API routes, all existing components, all existing pages. Zero deletions, zero renames, zero refactors.
