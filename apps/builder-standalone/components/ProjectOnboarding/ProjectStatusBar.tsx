"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  User,
  GitBranch,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { TOGGLE_INFO, type ProjectMeta } from "@/lib/types/project";

interface ProjectStatusBarProps {
  projectPath: string;
}

export function ProjectStatusBar({ projectPath }: ProjectStatusBarProps) {
  const [meta, setMeta] = useState<ProjectMeta | null>(null);

  useEffect(() => {
    if (!projectPath) return;
    fetch(`/api/project/meta?path=${encodeURIComponent(projectPath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.exists && data.meta) setMeta(data.meta);
      })
      .catch(() => {});
  }, [projectPath]);

  if (!meta) return null;

  const activeToggles = TOGGLE_INFO.filter((t: any) => meta.toggles[t.key]);
  const deployTargets = [
    { key: "github", label: "GitHub", url: meta.deployUrls.github },
    { key: "vercel", label: "Vercel", url: meta.deployUrls.vercel },
    { key: "netlify", label: "Netlify", url: meta.deployUrls.netlify },
    { key: "cloudflare", label: "CF", url: meta.deployUrls.cloudflare },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs overflow-x-auto">
      {/* Project name */}
      <span className="font-bold text-zinc-900 dark:text-white whitespace-nowrap">
        {meta.name}
      </span>

      {/* Client */}
      {meta.clientName && (
        <>
          <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
          <span className="flex items-center gap-1 text-zinc-300 whitespace-nowrap">
            <User className="w-3 h-3" />
            {meta.clientName}
          </span>
        </>
      )}

      {/* Domain */}
      {meta.domain && (
        <>
          <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
          <span className="flex items-center gap-1 text-zinc-300 whitespace-nowrap">
            <Globe className="w-3 h-3" />
            {meta.domain}
          </span>
        </>
      )}

      {/* Toggle pills */}
      {activeToggles.length > 0 && (
        <>
          <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center gap-1">
            {activeToggles.map((t: any) => (
              <span
                key={t.key}
                className="px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: `${t.color}20`,
                  color: t.color,
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Deploy status */}
      <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
      <div className="flex items-center gap-2">
        {deployTargets.map((d) => (
          <span
            key={d.key}
            className="flex items-center gap-1 whitespace-nowrap"
            title={d.url || `${d.label}: not connected`}
          >
            {d.url ? (
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            ) : (
              <Circle className="w-3 h-3 text-zinc-300" />
            )}
            <span className={d.url ? "text-zinc-400" : "text-zinc-300"}>
              {d.label}
            </span>
          </span>
        ))}
      </div>

      {/* Created date */}
      <div className="ml-auto text-zinc-300 whitespace-nowrap">
        Created {new Date(meta.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}
