/**
 * Builder Preview API
 *
 * Serves project files for the preview iframe.
 * For HTML files, automatically inlines local CSS and JS (not CDN links).
 *
 * GET /api/builder/preview?project=mysite&file=index.html
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validatePathWithinProject, logForensicEvent } from '@/lib/security/pathValidator';

const BUILDER_PROJECTS_DIR = process.env.BUILDER_PROJECTS_DIR || 'L:/ai_builder/projects';

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.xml': 'application/xml',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Check if a URL is a local file reference (not a CDN/external URL)
 */
function isLocalReference(href: string): boolean {
  if (!href) return false;
  // Skip URLs that start with http://, https://, //, or data:
  if (/^(https?:)?\/\/|^data:/i.test(href)) return false;
  // Skip absolute paths that look like CDN paths
  if (href.startsWith('/') && href.includes('cdn')) return false;
  return true;
}

/**
 * Read a local file relative to the project directory
 */
async function readLocalFile(projectDir: string, relativePath: string): Promise<string | null> {
  try {
    // Normalize the path (handle ./ prefix)
    const cleanPath = relativePath.replace(/^\.\//, '');
    const fullPath = path.join(projectDir, cleanPath);

    console.log(`[Preview] readLocalFile: projectDir="${projectDir}", relativePath="${relativePath}", fullPath="${fullPath}"`);

    // Security check
    const normalizedProjectDir = path.normalize(projectDir).replace(/\\/g, '/');
    const normalizedFullPath = path.normalize(fullPath).replace(/\\/g, '/');

    if (!normalizedFullPath.startsWith(normalizedProjectDir)) {
      console.warn(`[Preview] Blocked path traversal attempt: ${relativePath}`);
      return null;
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    console.log(`[Preview] Successfully read ${relativePath}, length: ${content.length} chars`);
    return content;
  } catch (err: any) {
    console.warn(`[Preview] Could not read local file: ${relativePath}, error: ${err.message}`);
    return null;
  }
}

/**
 * Process HTML to inline local CSS and JS files
 */
async function inlineLocalAssets(html: string, projectDir: string): Promise<string> {
  console.log(`[Preview] inlineLocalAssets called, projectDir="${projectDir}", html length: ${html.length}`);
  let processed = html;

  // Inline local CSS files: <link rel="stylesheet" href="styles.css">
  const cssLinkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
  const cssLinks = [...html.matchAll(cssLinkRegex)];
  console.log(`[Preview] Found ${cssLinks.length} CSS links (rel before href pattern)`);

  for (const match of cssLinks) {
    const fullTag = match[0];
    const href = match[1];
    console.log(`[Preview] CSS link found: href="${href}", isLocal=${isLocalReference(href)}, fullTag="${fullTag}"`);

    if (isLocalReference(href)) {
      const cssContent = await readLocalFile(projectDir, href);
      if (cssContent) {
        // Replace the link tag with inline style
        const inlineStyle = `<style>/* Inlined from ${href} */\n${cssContent}</style>`;
        processed = processed.replace(fullTag, inlineStyle);
        console.log(`[Preview] Inlined CSS from ${href}, ${cssContent.length} chars`);
      } else {
        console.log(`[Preview] Failed to read CSS file: ${href}`);
      }
    }
  }

  // Also check for href before rel pattern: <link href="styles.css" rel="stylesheet">
  const cssLinkRegex2 = /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi;
  const cssLinks2 = [...processed.matchAll(cssLinkRegex2)];
  console.log(`[Preview] Found ${cssLinks2.length} CSS links (href before rel pattern)`);

  for (const match of cssLinks2) {
    const fullTag = match[0];
    const href = match[1];
    console.log(`[Preview] CSS link found (pattern 2): href="${href}", isLocal=${isLocalReference(href)}`);

    if (isLocalReference(href)) {
      const cssContent = await readLocalFile(projectDir, href);
      if (cssContent) {
        const inlineStyle = `<style>/* Inlined from ${href} */\n${cssContent}</style>`;
        processed = processed.replace(fullTag, inlineStyle);
        console.log(`[Preview] Inlined CSS from ${href} (pattern 2), ${cssContent.length} chars`);
      }
    }
  }

  // Inline local JS files: <script src="script.js"></script>
  const jsScriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  const jsScripts = [...processed.matchAll(jsScriptRegex)];

  for (const match of jsScripts) {
    const fullTag = match[0];
    const src = match[1];

    if (isLocalReference(src)) {
      const jsContent = await readLocalFile(projectDir, src);
      if (jsContent) {
        // Replace the script tag with inline script
        const inlineScript = `<script>/* Inlined from ${src} */\n${jsContent}</script>`;
        processed = processed.replace(fullTag, inlineScript);
      }
    }
  }

  // Handle self-closing or src-only script tags: <script src="script.js" />
  const jsSelfClosingRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*\/>/gi;
  const jsSelfClosing = [...processed.matchAll(jsSelfClosingRegex)];

  for (const match of jsSelfClosing) {
    const fullTag = match[0];
    const src = match[1];

    if (isLocalReference(src)) {
      const jsContent = await readLocalFile(projectDir, src);
      if (jsContent) {
        const inlineScript = `<script>/* Inlined from ${src} */\n${jsContent}</script>`;
        processed = processed.replace(fullTag, inlineScript);
      }
    }
  }

  return processed;
}

/**
 * Inject navigation blocker into preview HTML.
 * Prevents links from navigating the iframe (which would load the builder app).
 * Adds <base target="_blank"> so links open in new tabs, plus a click interceptor
 * that blocks any remaining in-frame navigation.
 */
function injectPreviewNavigationBlocker(html: string): string {
  const blocker = `<base target="_blank">
<script>
document.addEventListener('click', function(e) {
  var link = e.target.closest('a');
  if (link) {
    var href = link.getAttribute('href');
    if (href && href !== '#' && !href.startsWith('javascript:')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);
</script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, function(match) {
      return match + '\n' + blocker;
    });
  } else if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, function(match) {
      return match + '\n<head>' + blocker + '</head>';
    });
  } else {
    return blocker + '\n' + html;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get('project');
  const fileName = searchParams.get('file') || 'index.html';
  const inline = searchParams.get('inline') !== 'false'; // Default to true

  if (!projectName) {
    return NextResponse.json(
      { error: 'Project name is required' },
      { status: 400 }
    );
  }

  // Construct the full path
  const normalizedProjectsDir = path.normalize(BUILDER_PROJECTS_DIR).replace(/\\/g, '/');
  const projectDir = path.join(normalizedProjectsDir, projectName);
  const relativePath = `${projectName}/${fileName}`;
  const fullPath = path.join(normalizedProjectsDir, relativePath);

  // Validate the path is within projects directory
  const validation = validatePathWithinProject(fullPath, normalizedProjectsDir);

  if (!validation.valid) {
    logForensicEvent({
      event: 'Preview path validation failed',
      severity: validation.securityViolation ? 'critical' : 'warning',
      category: 'security_violation',
      details: {
        operation: 'preview',
        path: relativePath,
        projectPath: normalizedProjectsDir,
        error: validation.error,
        blocked: true,
      },
    });

    return NextResponse.json(
      { error: 'Access denied', securityViolation: true },
      { status: 403 }
    );
  }

  try {
    // Read the file
    console.log(`[Preview] Reading file: ${validation.normalizedPath}`);
    let content = await fs.readFile(validation.normalizedPath, 'utf-8');
    const mimeType = getMimeType(fileName);
    console.log(`[Preview] File read successfully, length: ${content.length}, mimeType: ${mimeType}`);

    // For HTML files, inline local CSS and JS + inject navigation blocker
    if (inline && (fileName.endsWith('.html') || fileName.endsWith('.htm'))) {
      console.log(`[Preview] Inlining assets for HTML file, projectDir: ${projectDir}`);
      const beforeLength = content.length;
      content = await inlineLocalAssets(content, projectDir);
      content = injectPreviewNavigationBlocker(content);
      console.log(`[Preview] Inlining complete. Before: ${beforeLength} chars, After: ${content.length} chars`);
    }

    logForensicEvent({
      event: 'Preview file served',
      severity: 'info',
      category: 'file_operation',
      details: {
        operation: 'preview',
        path: relativePath,
      },
    });

    // Return with appropriate headers
    return new NextResponse(content, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Allow scripts and styles from same origin and CDNs
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; img-src 'self' data: https:; font-src 'self' data: https:;",
      },
    });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // File not found - return a helpful 404 page
      if (fileName === 'index.html') {
        return new NextResponse(
          `<!DOCTYPE html>
<html>
<head>
  <title>Project Not Found</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #1a1a1a;
      color: #888;
    }
    .message {
      text-align: center;
    }
    h1 { color: #666; }
    code {
      background: #333;
      padding: 0.25em 0.5em;
      border-radius: 4px;
      color: #10b981;
    }
  </style>
</head>
<body>
  <div class="message">
    <h1>No index.html found</h1>
    <p>Create an <code>index.html</code> file in your project to see the preview.</p>
  </div>
</body>
</html>`,
          {
            headers: { 'Content-Type': 'text/html' },
            status: 404,
          }
        );
      }

      return NextResponse.json(
        { error: 'File not found', path: relativePath },
        { status: 404 }
      );
    }

    console.error('[Builder Preview] Error:', err);
    return NextResponse.json(
      { error: 'Failed to read file', details: err.message },
      { status: 500 }
    );
  }
}
