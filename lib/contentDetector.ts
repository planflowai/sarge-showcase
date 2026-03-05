/**
 * Content Detection for Preview Rendering
 *
 * Detects content type and wraps appropriately for iframe rendering.
 * Priority order:
 * 1. Complete HTML document (<!DOCTYPE or <html) → render as-is
 * 2. React/JSX → wrap in React bootstrap template
 * 3. HTML snippet → wrap in basic HTML document with Tailwind
 * 4. Fallback → render as preformatted text
 */

export type ContentType = 'html-document' | 'react-jsx' | 'html-snippet' | 'css-only' | 'js-only' | 'text';

/**
 * Script to inject into preview to prevent navigation.
 * - Intercepts all anchor clicks and prevents navigation
 * - Allows onclick handlers to still execute (fires before preventDefault)
 * - Allows href="#" anchor scrolling
 * - Prevents navigation to external/absolute URLs
 */
const NAVIGATION_BLOCKER_SCRIPT = `
<script>
// Block all navigation that would leave the preview
document.addEventListener('click', function(e) {
  var link = e.target.closest('a');
  if (link) {
    var href = link.getAttribute('href');
    if (!href) return;
    // Allow javascript: hrefs (onclick handlers)
    if (href.startsWith('javascript:')) return;
    // Handle # and #section anchor links — scroll within preview
    if (href === '#' || href.startsWith('#')) {
      e.preventDefault();
      e.stopPropagation();
      if (href !== '#') {
        try {
          var target = document.querySelector(href);
          if (target) target.scrollIntoView({behavior:'smooth'});
        } catch(err) {}
      }
      return;
    }
    // Allow tel: and mailto: links to open natively
    if (href.startsWith('tel:') || href.startsWith('mailto:')) return;
    // Block everything else (relative URLs, absolute URLs, etc.)
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
// Block form submissions that navigate away
document.addEventListener('submit', function(e) {
  e.preventDefault();
}, true);
// Block programmatic navigation
try {
  window.addEventListener('beforeunload', function(e) { e.preventDefault(); });
} catch(e) {}
</script>
`;

/**
 * Detect the type of content
 */
export function detectContentType(code: string): ContentType {
  const trimmed = code.trim();

  // 1. Complete HTML document
  if (/<!DOCTYPE/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return 'html-document';
  }

  // 2. React/JSX detection
  const reactPatterns = [
    /import\s+React/,
    /from\s+['"]react['"]/,
    /from\s+["']react["']/,
    /export\s+default/,
    /function\s+[A-Z][a-zA-Z]*\s*\([^)]*\)\s*\{[\s\S]*return\s*\(/,
    /const\s+[A-Z][a-zA-Z]*\s*=\s*\([^)]*\)\s*=>\s*[\({]/,
    /useState\s*\(/,
    /useEffect\s*\(/,
    /useRef\s*\(/,
    /useCallback\s*\(/,
    /useMemo\s*\(/,
    /<[A-Z][a-zA-Z]*[\s/>]/,  // JSX component tags like <App /> or <Button>
  ];

  if (reactPatterns.some(pattern => pattern.test(trimmed))) {
    return 'react-jsx';
  }

  // 3. HTML snippet (starts with an HTML tag but not a full document)
  if (/^<[a-z]/i.test(trimmed)) {
    return 'html-snippet';
  }

  // 4. CSS-only detection (selectors, @rules, properties)
  if (/^[\w\-\.\#\[\*\:]+\s*\{|^@media|^@keyframes|^@font-face|^@import|^\*\s*\{|^:root\s*\{/.test(trimmed)) {
    return 'css-only';
  }

  // 5. JavaScript-only detection (not React)
  if (/^(function|const|let|var|class|async|\/\/|\/\*)/.test(trimmed) && !reactPatterns.some(p => p.test(trimmed))) {
    return 'js-only';
  }

  // 6. Fallback
  return 'text';
}

/**
 * Build the srcdoc content for iframe rendering
 * Returns empty string if code is empty/whitespace only
 * @param airGapMode When true, CDN URLs are replaced with local /vendor/ paths
 */
export function buildPreviewContent(code: string, airGapMode = false): string {
  // Don't build preview for empty content - prevents iframe from loading default page
  if (!code || !code.trim()) {
    console.log('[contentDetector] buildPreviewContent: empty code, returning empty string');
    return '';
  }

  const contentType = detectContentType(code);
  console.log('[contentDetector] buildPreviewContent called, contentType:', contentType, 'code length:', code.length, 'airGap:', airGapMode);

  let result: string;
  switch (contentType) {
    case 'html-document':
      // Inject navigation blocker into existing HTML document
      result = injectNavigationBlocker(code);
      break;

    case 'react-jsx':
      result = wrapReactJSX(code, airGapMode);
      break;

    case 'html-snippet':
      result = wrapHTMLSnippet(code, airGapMode);
      break;

    case 'css-only':
      result = wrapCSSOnly(code);
      break;

    case 'js-only':
      result = wrapJSOnly(code);
      break;

    case 'text':
    default:
      result = wrapAsText(code);
      break;
  }

  console.log('[contentDetector] buildPreviewContent result length:', result.length);
  return result;
}

/**
 * Inject navigation blocker and base tag into an existing HTML document
 * Injects <base target="_blank"> and click interceptor right after <head> opening tag
 */
function injectNavigationBlocker(code: string): string {
  const headInjection = `<base target="_blank">
${NAVIGATION_BLOCKER_SCRIPT}`;

  // Try to inject right after opening <head> tag
  if (/<head[^>]*>/i.test(code)) {
    return code.replace(/<head[^>]*>/i, function(match) {
      return match + '\n' + headInjection;
    });
  } else if (/<html[^>]*>/i.test(code)) {
    // No <head> tag, inject right after <html>
    return code.replace(/<html[^>]*>/i, function(match) {
      return match + '\n<head>' + headInjection + '</head>';
    });
  } else {
    // No HTML tag, inject at the very beginning
    return headInjection + '\n' + code;
  }
}

/**
 * Wrap React/JSX code in bootstrap template
 * In air-gap mode: uses local /vendor/ copies of React/ReactDOM; omits Babel + Tailwind CDN
 */
function wrapReactJSX(code: string, airGapMode = false): string {
  // Clean up the code - remove import statements as we're using UMD builds
  let cleanCode = code
    .replace(/import\s+React.*?['"]\s*;?\n?/g, '')
    .replace(/import\s+\{[^}]+\}\s+from\s+['"]react['"]\s*;?\n?/g, '')
    .replace(/import\s+ReactDOM.*?['"]\s*;?\n?/g, '')
    .replace(/import\s+\{[^}]+\}\s+from\s+['"]react-dom['"]\s*;?\n?/g, '')
    .replace(/export\s+default\s+/g, '')
    .trim();

  if (airGapMode) {
    // Air-gap mode: use local vendor files; Babel/Tailwind unavailable
    return `<!DOCTYPE html>
<html>
<head>
  <base target="_blank">
  ${NAVIGATION_BLOCKER_SCRIPT}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="/vendor/react.production.min.js"></script>
  <script src="/vendor/react-dom.production.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    .airgap-notice { padding: 16px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; margin: 16px; font-family: system-ui, sans-serif; font-size: 13px; color: #92400e; }
  </style>
</head>
<body>
  <div class="airgap-notice">
    ⚠️ <strong>Air-gap mode:</strong> React JSX preview requires Babel (cdn.unpkg.com) for transpilation, which is unavailable offline. JSX rendering is disabled. The code is correct — connect to the internet to preview it.
  </div>
  <div id="root"></div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <base target="_blank">
  ${NAVIGATION_BLOCKER_SCRIPT}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;

    ${cleanCode}

    // Try to find and render the main component
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      // Look for common component names
      if (typeof App !== 'undefined') {
        root.render(React.createElement(App));
      } else if (typeof Main !== 'undefined') {
        root.render(React.createElement(Main));
      } else if (typeof Component !== 'undefined') {
        root.render(React.createElement(Component));
      } else {
        // Try to find any function that starts with uppercase (React component convention)
        const componentNames = Object.keys(window).filter(k =>
          typeof window[k] === 'function' && /^[A-Z]/.test(k)
        );
        if (componentNames.length > 0) {
          root.render(React.createElement(window[componentNames[componentNames.length - 1]]));
        } else {
          root.render(React.createElement('div', {
            style: { padding: '20px', color: '#666' }
          }, 'No React component found. Define a function component named App, Main, or Component.'));
        }
      }
    } catch (err) {
      document.getElementById('root').innerHTML = '<pre style="color: red; padding: 20px;">' + err.message + '</pre>';
    }
  </script>
</body>
</html>`;
}

/**
 * Wrap HTML snippet in a basic document with Tailwind
 * In air-gap mode: Tailwind CDN is omitted (classes won't be styled, but HTML renders)
 */
function wrapHTMLSnippet(code: string, airGapMode = false): string {
  const tailwindScript = airGapMode
    ? '<!-- Tailwind CDN unavailable in air-gap mode -->'
    : '<script src="https://cdn.tailwindcss.com"></script>';
  return `<!DOCTYPE html>
<html>
<head>
  <base target="_blank">
  ${NAVIGATION_BLOCKER_SCRIPT}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${tailwindScript}
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
}

/**
 * Wrap CSS-only code in a basic HTML document
 */
function wrapCSSOnly(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <base target="_blank">
  ${NAVIGATION_BLOCKER_SCRIPT}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${code}
  </style>
</head>
<body>
  <div style="padding: 20px; font-family: system-ui, sans-serif;">
    <h1>CSS Preview</h1>
    <p>This CSS has been loaded. Add HTML elements to see the styles applied.</p>
    <div class="preview-container">
      <button class="btn">Sample Button</button>
      <div class="card">
        <h2>Sample Card</h2>
        <p>This is a sample card to preview your styles.</p>
      </div>
      <input type="text" placeholder="Sample Input" />
    </div>
  </div>
</body>
</html>`;
}

/**
 * Wrap JavaScript-only code in a basic HTML document
 */
function wrapJSOnly(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <base target="_blank">
  ${NAVIGATION_BLOCKER_SCRIPT}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #1e1e1e; color: #d4d4d4; }
    #output { padding: 10px; background: #2d2d2d; border-radius: 4px; margin-top: 10px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>JavaScript Preview</h1>
  <div id="app"></div>
  <div id="output"></div>
  <script>
    // Capture console.log output
    const output = document.getElementById('output');
    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);
      output.textContent += args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ') + '\\n';
    };

    try {
      ${code}
    } catch (err) {
      output.textContent = 'Error: ' + err.message;
      output.style.color = '#f87171';
    }
  </script>
</body>
</html>`;
}

/**
 * Wrap plain text as preformatted content
 */
function wrapAsText(code: string): string {
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: monospace;
      background: #1e1e1e;
      color: #d4d4d4;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <pre>${escaped}</pre>
</body>
</html>`;
}

/**
 * Detect language from code content for syntax highlighting
 */
export function detectLanguage(code: string): string {
  const trimmed = code.trim();

  if (/<!DOCTYPE|<html|<head|<body/i.test(trimmed)) {
    return 'html';
  }

  if (/import\s+React|from\s+['"]react['"]|useState|useEffect|<[A-Z]/.test(trimmed)) {
    return 'typescript';
  }

  if (/^<[a-z]/i.test(trimmed)) {
    return 'html';
  }

  if (/function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=/.test(trimmed)) {
    return 'javascript';
  }

  if (/^{[\s\S]*}$/.test(trimmed) || /^[\s\S]*:\s/.test(trimmed)) {
    return 'json';
  }

  if (/^[\w-]+\s*{|@media|@keyframes|#[\w-]+\s*{|\.[\w-]+\s*{/.test(trimmed)) {
    return 'css';
  }

  return 'plaintext';
}
