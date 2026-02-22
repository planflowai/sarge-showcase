import * as Babel from "@babel/standalone";

export interface RenderResult {
  html: string;
  error?: string;
}

/**
 * Render code to HTML for preview based on language.
 */
export function renderCode(code: string, language?: string): RenderResult {
  const lang = (language || "").toLowerCase();

  // HTML — render directly
  if (lang === "html" || lang === "htm") {
    return { html: code };
  }

  // CSS — wrap in style tag
  if (lang === "css") {
    return { html: `<style>${code}</style><p style="padding:16px;color:#ccc;">CSS applied. Add HTML to see styled content.</p>` };
  }

  // Markdown — return as-is
  if (lang === "markdown" || lang === "md") {
    return { html: `<pre style="white-space:pre-wrap;color:#ccc;padding:16px;font-family:sans-serif;">${escapeHtml(code)}</pre>` };
  }

  // JSON — formatted display
  if (lang === "json") {
    try {
      const formatted = JSON.stringify(JSON.parse(code), null, 2);
      return { html: `<pre style="color:#ccc;padding:16px;font-family:monospace;white-space:pre-wrap;">${escapeHtml(formatted)}</pre>` };
    } catch {
      return { html: `<pre style="color:#ccc;padding:16px;">${escapeHtml(code)}</pre>` };
    }
  }

  // JSX / TSX / JS — transpile with Babel
  if (lang === "jsx" || lang === "tsx" || lang === "javascript" || lang === "js") {
    // Skip transpilation for very large files (> 200KB) — just show raw
    if (code.length > 200_000) {
      return {
        html: `<div style="padding:16px;color:#a0a0a0;font-family:sans-serif;">
          <p>File too large for live preview (${(code.length / 1024).toFixed(0)}KB).</p>
          <p>Use the <strong>Raw</strong> tab to view the code.</p>
        </div>`,
      };
    }

    try {
      // Strip import/export statements — React/ReactDOM loaded via UMD globals
      const stripped = stripImportsExports(code);
      const wrapped = wrapJSX(stripped);
      const result = Babel.transform(wrapped, {
        presets: ["react"],
        filename: "preview.jsx",
      });
      const transpiledCode = result.code || "";

      const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="/vendor/react.production.min.js"><\/script>
  <script src="/vendor/react-dom.production.min.js"><\/script>
  <style>
    body { margin: 0; padding: 16px; background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    try {
      ${transpiledCode}
    } catch(e) {
      document.getElementById('root').innerHTML = '<pre style="color:#f87171;">' + e.message + '</pre>';
    }
  <\/script>
</body>
</html>`;
      return { html };
    } catch (err) {
      return {
        html: `<pre style="color:#f87171;padding:16px;">${escapeHtml(String(err))}</pre>`,
        error: String(err),
      };
    }
  }

  // Python, TypeScript, etc. — can't execute
  return {
    html: `<div style="padding:16px;color:#a0a0a0;font-family:sans-serif;">
      <p>Preview not available for <strong>${escapeHtml(lang || "this language")}</strong>.</p>
      <p>Use the <strong>Raw</strong> tab to view the code.</p>
    </div>`,
  };
}

/**
 * Strip import and export statements so code can run in a plain script tag
 * with React/ReactDOM available as UMD globals.
 */
function stripImportsExports(code: string): string {
  // Remove import lines (single and multi-line)
  let result = code.replace(/^\s*import\s+.*?(?:from\s+['"][^'"]*['"])?;?\s*$/gm, "");
  // Remove "export default " prefix but keep the declaration
  result = result.replace(/^\s*export\s+default\s+/gm, "");
  // Remove "export " prefix from named exports
  result = result.replace(/^\s*export\s+(?=(?:function|const|let|var|class)\s)/gm, "");
  return result;
}

/**
 * Wrap JSX code so it renders into #root if it looks like a component.
 */
function wrapJSX(code: string): string {
  // If code already has ReactDOM.render or createRoot, use as-is
  if (code.includes("ReactDOM") || code.includes("createRoot") || code.includes("render(")) {
    return code;
  }

  // If code defines a component function, wrap it
  const componentMatch = code.match(/(?:^|\n)\s*(?:function|const)\s+(\w+)/);
  if (componentMatch) {
    const name = componentMatch[1];
    // Check if name starts with uppercase (React component convention)
    if (name[0] === name[0].toUpperCase()) {
      return `${code}\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${name}));`;
    }
  }

  // If it's a simple JSX expression, wrap it
  if (code.trim().startsWith("<")) {
    return `ReactDOM.createRoot(document.getElementById('root')).render(${code});`;
  }

  return code;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
