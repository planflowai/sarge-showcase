"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/stores/settingsStore";

interface BuilderCodeBlockProps {
  code: string;
  language?: string;
  onOpenInEditor?: (code: string, language?: string) => void;
}

export function BuilderCodeBlock({ code, language, onOpenInEditor }: BuilderCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const currentTheme = useSettingsStore((s) => s.theme);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInEditor = () => {
    if (onOpenInEditor) {
      onOpenInEditor(code, language);
    }
  };

  return (
    <div className="group/code relative my-2 overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{language || "text"}</span>
        <div className="flex items-center gap-1">
          {/* Open in Editor button */}
          {onOpenInEditor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInEditor}
              className="h-6 gap-1 px-2 text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <ExternalLink className="h-3 w-3" /> Open in Editor
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 gap-1 px-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language || "text"}
        style={currentTheme === "dark" ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: "0.85rem",
          padding: "1rem",
          background: currentTheme === "dark" ? "#1e1e2e" : "#fafafa",
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
