"use client";

import { useState, useMemo, useEffect } from "react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackFileExplorer,
} from "@codesandbox/sandpack-react";
import { X, Download, Eye, Code2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreviewStore } from "@/lib/stores/previewStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type Tab = "preview" | "code";

/** Check if content looks like valid HTML */
function isValidHtml(code: string): boolean {
  if (!code || code.trim().length < 10) return false;
  const trimmed = code.trim().toLowerCase();
  // Must contain at least one HTML tag
  return /<[a-z][\s\S]*>/i.test(trimmed);
}

/** Sandboxed iframe using srcDoc for safe HTML rendering */
function HtmlIframe({ code, onError }: { code: string; onError?: (msg: string) => void }) {
  const [hasError, setHasError] = useState(false);

  // Wrap the HTML to catch errors
  const wrappedHtml = useMemo(() => {
    // If it's a complete HTML document, use as-is
    if (code.trim().toLowerCase().startsWith('<!doctype') ||
        code.trim().toLowerCase().startsWith('<html')) {
      return code;
    }
    // Otherwise wrap in a basic HTML structure
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }</style>
</head>
<body>
${code}
</body>
</html>`;
  }, [code]);

  if (hasError) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-100 dark:bg-zinc-900 p-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="text-zinc-600 dark:text-zinc-400">Failed to render HTML preview</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">Switch to Code tab to view the source</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={wrappedHtml}
      sandbox="allow-scripts"
      className="w-full h-full border-0 bg-white"
      title="HTML Preview"
      onError={() => {
        setHasError(true);
        onError?.("Failed to render HTML");
      }}
    />
  );
}

export function PreviewPane() {
  const { isOpen, code, language, fileName, files, activeFile, setActiveFile, closePreview } =
    usePreviewStore();
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [renderError, setRenderError] = useState<string | null>(null);
  const currentTheme = useSettingsStore((s) => s.theme);

  if (!isOpen) return null;

  const lang = (language || "").toLowerCase();
  const isHtml = ["html", "htm"].includes(lang);
  const isReact = ["jsx", "tsx", "javascript", "js"].includes(lang);
  const hasMultipleFiles = files.length > 1;

  // Check if we have valid content to preview
  const hasValidContent = code && code.trim().length > 0;
  const isHtmlValid = isHtml ? isValidHtml(code) : true;

  // Keyboard shortcut to close preview (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePreview]);

  // Show error state if no valid content
  if (!hasValidContent) {
    return (
      <div className="flex h-full flex-col border-l border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-300 dark:border-zinc-700 px-3 py-2">
          <span className="text-sm text-zinc-500">Preview</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={closePreview}
            className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            title="Close preview"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-zinc-500">
            <p>No content to preview</p>
          </div>
        </div>
      </div>
    );
  }

  // Build Sandpack files object
  const sandpackFiles = useMemo(() => {
    // Multi-file project
    if (hasMultipleFiles) {
      const spFiles: Record<string, string> = {};
      for (const f of files) {
        // Sandpack needs paths starting with /
        const path = f.path.startsWith("/") ? f.path : `/${f.path}`;
        spFiles[path] = f.content;
      }
      return spFiles;
    }

    // Single file — wrap based on type
    if (isHtml) {
      return { "/index.html": code };
    }

    if (isReact) {
      // Wrap as React app
      const hasDefaultExport = /export\s+default/.test(code);
      const hasComponentDef = /(?:function|const)\s+[A-Z]\w*/.test(code);

      let appCode = code;
      // If it has a default export, import and render it
      if (hasDefaultExport) {
        return {
          "/App.js": code,
          "/index.js": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);`,
        };
      }
      // If it defines a component, wrap it
      if (hasComponentDef) {
        const match = code.match(/(?:function|const)\s+([A-Z]\w*)/);
        const name = match?.[1] || "App";
        return {
          "/App.js": `${appCode}\nexport default ${name};`,
          "/index.js": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);`,
        };
      }
      // Plain JS — just run it
      return {
        "/App.js": `export default function App() {
  return (${code.trim().startsWith("<") ? code : `<pre>${JSON.stringify(code).slice(1, -1)}</pre>`});
}`,
      };
    }

    // Non-previewable — show as code only
    return {
      "/index.html": `<html><body style="margin:0;padding:16px;background:#1a1a2e;color:#e0e0e0;font-family:monospace;">
<pre style="white-space:pre-wrap;">${code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body></html>`,
    };
  }, [code, language, files, hasMultipleFiles, isHtml, isReact]);

  // Determine Sandpack template
  const template = isHtml ? "static" as const : "react" as const;

  // Determine entry file for Sandpack
  const entryFile = useMemo(() => {
    if (hasMultipleFiles) {
      // Look for index.html first
      const htmlEntry = files.find((f) => /index\.html?$/i.test(f.path));
      if (htmlEntry) return htmlEntry.path.startsWith("/") ? htmlEntry.path : `/${htmlEntry.path}`;
      return files[0]?.path.startsWith("/") ? files[0].path : `/${files[0]?.path}`;
    }
    return isHtml ? "/index.html" : "/App.js";
  }, [files, hasMultipleFiles, isHtml]);

  const handleDownload = async () => {
    const zip = new JSZip();
    if (files.length > 1) {
      for (const f of files) {
        zip.file(f.path, f.content);
      }
    } else {
      const ext = language || "txt";
      const name = fileName.includes(".") ? fileName : `${fileName}.${ext}`;
      zip.file(name, code);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = files.length > 1 ? "project" : fileName.replace(/\.[^.]+$/, "");
    saveAs(blob, `${zipName}.zip`);
  };

  const tabs: { id: Tab; label: string; icon: typeof Eye }[] = [
    { id: "preview", label: "Preview", icon: Eye },
    { id: "code", label: "Code", icon: Code2 },
  ];

  return (
    <div className="flex h-full flex-col border-l-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg min-h-[400px] max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className="h-7 gap-1 px-2 text-xs"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {renderError && (
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Error
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 gap-1 px-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <Download className="h-3.5 w-3.5" />
            ZIP
          </Button>
          {/* Prominent close button */}
          <Button
            variant="outline"
            size="sm"
            onClick={closePreview}
            className="h-8 gap-1.5 px-2.5 text-xs font-medium border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:border-red-500/50 dark:hover:text-red-400 transition-colors"
            title="Close preview (Esc)"
          >
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </div>

      {/* Sandpack */}
      <div className="flex-1 overflow-hidden">
        <SandpackProvider
          template={template}
          files={sandpackFiles}
          theme={currentTheme === "dark" ? "dark" : "light"}
          options={{
            activeFile: entryFile,
            visibleFiles: hasMultipleFiles ? files.map((f) => f.path.startsWith("/") ? f.path : `/${f.path}`) : undefined,
          }}
        >
          <div className="flex h-full">
            {/* File explorer for multi-file projects */}
            {hasMultipleFiles && activeTab === "code" && (
              <div className="w-48 flex-shrink-0 border-r border-zinc-300 dark:border-zinc-700">
                <SandpackFileExplorer style={{ height: "100%" }} />
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              {activeTab === "preview" ? (
                isHtml && !hasMultipleFiles ? (
                  isHtmlValid ? (
                    /* Sandboxed iframe for plain HTML using srcDoc */
                    <HtmlIframe
                      code={code}
                      onError={(msg) => setRenderError(msg)}
                    />
                  ) : (
                    /* Invalid HTML warning */
                    <div className="flex h-full items-center justify-center bg-zinc-100 dark:bg-zinc-900 p-8">
                      <div className="text-center">
                        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                        <p className="text-zinc-600 dark:text-zinc-400 font-medium">Invalid HTML Content</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                          The content doesn&apos;t appear to be valid HTML.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("code")}
                          className="mt-4"
                        >
                          <Code2 className="h-4 w-4 mr-1.5" />
                          View Source Code
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <SandpackPreview
                    style={{ height: "100%" }}
                    showOpenInCodeSandbox={false}
                    showRefreshButton={true}
                  />
                )
              ) : (
                <SandpackCodeEditor
                  style={{ height: "100%" }}
                  showLineNumbers
                  showTabs={hasMultipleFiles}
                  wrapContent
                />
              )}
            </div>
          </div>
        </SandpackProvider>
      </div>
    </div>
  );
}
