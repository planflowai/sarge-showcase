"use client";

import { useMemo } from "react";
import { Code2, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { detectContentType, detectLanguage } from "@/lib/contentDetector";

interface ArtifactCardProps {
  code: string;
  language?: string;
  onOpenCode: () => void;
  onOpenPreview: () => void;
}

// Generate a title from code content
function generateTitle(code: string, language?: string): string {
  // Try to find a component name for React
  const componentMatch = code.match(/(?:function|const)\s+([A-Z][a-zA-Z0-9]*)/);
  if (componentMatch) {
    return componentMatch[1];
  }

  // Try to find HTML title
  const titleMatch = code.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Try to find h1
  const h1Match = code.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim().substring(0, 30);
  }

  // Use language-based default
  const contentType = detectContentType(code);
  switch (contentType) {
    case 'react-jsx':
      return 'React Component';
    case 'html-document':
      return 'HTML Document';
    case 'html-snippet':
      return 'HTML Snippet';
    default:
      if (language === 'css') return 'Stylesheet';
      if (language === 'json') return 'JSON Data';
      return 'Code Artifact';
  }
}

// Get language badge info
function getLanguageBadge(code: string, language?: string): { label: string; color: string } {
  const contentType = detectContentType(code);
  const detectedLang = language || detectLanguage(code);

  if (contentType === 'react-jsx') {
    return { label: 'React', color: 'bg-cyan-500' };
  }

  switch (detectedLang) {
    case 'html':
      return { label: 'HTML', color: 'bg-orange-500' };
    case 'css':
    case 'scss':
      return { label: 'CSS', color: 'bg-pink-500' };
    case 'javascript':
      return { label: 'JS', color: 'bg-yellow-500' };
    case 'typescript':
      return { label: 'TS', color: 'bg-blue-500' };
    case 'json':
      return { label: 'JSON', color: 'bg-green-500' };
    default:
      return { label: 'Code', color: 'bg-zinc-500' };
  }
}

export default function ArtifactCard({ code, language, onOpenCode, onOpenPreview }: ArtifactCardProps) {
  const title = useMemo(() => generateTitle(code, language), [code, language]);
  const badge = useMemo(() => getLanguageBadge(code, language), [code, language]);
  const contentType = detectContentType(code);
  const canPreview = contentType === 'html-document' || contentType === 'react-jsx' || contentType === 'html-snippet';

  return (
    <div className="my-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Single row: icon, title, badge, buttons */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-indigo-500 flex-shrink-0" />
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{title}</span>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex-shrink-0", badge.color)}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onOpenCode(); }}
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <Code2 className="h-3.5 w-3.5" />
            Open Code
          </Button>
          {canPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onOpenPreview(); }}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
