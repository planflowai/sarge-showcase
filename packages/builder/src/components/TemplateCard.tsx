"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FileCode, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ProjectTemplate } from "@/lib/projectTemplates";
import { buildPreviewContent } from "@/lib/contentDetector";

interface TemplateCardProps {
  template: ProjectTemplate;
  onClick: () => void;
}

// Get tech stack badges from template files
function getTechStack(template: ProjectTemplate): string[] {
  const stack: string[] = [];
  const hasHtml = template.files.some(f => f.path.endsWith('.html'));
  const hasJs = template.files.some(f => f.path.endsWith('.js'));
  const hasCss = template.files.some(f => f.path.endsWith('.css'));
  const hasTailwind = template.files.some(f => f.content.includes('tailwindcss'));
  const hasReact = template.files.some(f => f.content.includes('react'));

  if (hasHtml) stack.push('HTML');
  if (hasCss) stack.push('CSS');
  if (hasTailwind) stack.push('Tailwind');
  if (hasReact) stack.push('React');
  if (hasJs && !hasReact) stack.push('JS');

  return stack;
}

// Badge colors for tech stack
const techColors: Record<string, string> = {
  'HTML': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'CSS': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Tailwind': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'React': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  'JS': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export default function TemplateCard({ template, onClick }: TemplateCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const techStack = getTechStack(template);

  // Generate preview thumbnail on mount
  useEffect(() => {
    // Find the main HTML file
    const htmlFile = template.files.find(f => f.path === 'index.html') || template.files[0];
    if (htmlFile && htmlFile.content) {
      const previewContent = buildPreviewContent(htmlFile.content);
      // Create a blob URL for the preview
      const blob = new Blob([previewContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    }
    setIsLoading(false);

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [template]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-xl border overflow-hidden transition-all duration-300",
        "bg-zinc-900 border-zinc-700 hover:border-indigo-500/50",
        "hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5"
      )}
    >
      {/* Preview thumbnail */}
      <div className="relative w-full h-28 bg-zinc-800 overflow-hidden">
        {previewUrl ? (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="absolute inset-0 w-[400%] h-[400%] origin-top-left scale-[0.25] pointer-events-none border-0"
            sandbox="allow-scripts"
            title={`${template.name} preview`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers className="w-8 h-8 text-zinc-600" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Hover effect glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Template info */}
      <div className="flex-1 p-3 text-left">
        {/* Header with icon */}
        <div className="flex items-start gap-2 mb-1.5">
          <span className="text-xl flex-shrink-0">{template.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-indigo-300 transition-colors">
              {template.name}
            </h3>
            <p className="text-[10px] text-zinc-500 truncate mt-0.5">
              {template.description}
            </p>
          </div>
        </div>

        {/* Footer with file count and tech stack */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
          {/* File count */}
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            <FileCode className="w-3 h-3" />
            <span>{template.files.length} files</span>
          </div>

          {/* Tech stack badges */}
          <div className="flex gap-1">
            {techStack.slice(0, 3).map((tech) => (
              <span
                key={tech}
                className={cn(
                  "px-1.5 py-0.5 text-[8px] font-medium rounded border",
                  techColors[tech] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                )}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Selection indicator */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-500/50 rounded-xl pointer-events-none transition-colors" />
    </button>
  );
}
