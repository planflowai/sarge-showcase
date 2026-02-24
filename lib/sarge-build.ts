// SargeBuild — AI Routing, Task Classification, Anchor Injection, Export
// Fast website builder with template support and client handoff

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
// HELPER: Extract CSS and JS from HTML
// ============================================

function extractStylesAndScripts(html: string): {
  cleanHtml: string;
  css: string;
  js: string;
} {
  let cleanHtml = html;
  let cssContent = '';
  let jsContent = '';

  // Extract all <style> tags and their content
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  cleanHtml = cleanHtml.replace(styleRegex, (match, content) => {
    cssContent += content + '\n';
    return '';
  });

  // Extract all <script> tags (except Tailwind CDN)
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  cleanHtml = cleanHtml.replace(scriptRegex, (match, content) => {
    // Keep Tailwind CDN script in HTML
    if (match.includes('cdn.tailwindcss.com')) {
      return match;
    }
    jsContent += content + '\n';
    return '';
  });

  return {
    cleanHtml: cleanHtml.trim(),
    css: cssContent.trim(),
    js: jsContent.trim(),
  };
}

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

  // Extract CSS and JS from HTML artifact
  const { cleanHtml, css: extractedCss, js: extractedJs } = extractStylesAndScripts(html);

  // Add index.html (with styles and scripts removed)
  zip.file('index.html', cleanHtml);

  // Add style.css if there's extracted CSS
  if (extractedCss.length > 0) {
    zip.file('style.css', extractedCss);
  }

  // Add script.js if there's extracted JS
  if (extractedJs.length > 0) {
    zip.file('script.js', extractedJs);
  }

  // Add custom CSS/JS passed as parameters (fallback)
  if (css && css.trim().length > 0 && extractedCss.length === 0) {
    zip.file('style.css', css);
  }
  if (js && js.trim().length > 0 && extractedJs.length === 0) {
    zip.file('script.js', js);
  }

  // Add deploy instructions
  const hasStyles = extractedCss.length > 0 || (css && css.trim().length > 0);
  const hasScripts = extractedJs.length > 0 || (js && js && js.trim().length > 0);

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
${hasStyles ? '- style.css — Stylesheets\n' : ''}${hasScripts ? '- script.js — JavaScript functionality\n' : ''}- README.txt — This file

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
