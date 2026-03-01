"use client";

import { ExternalLink } from "lucide-react";
import type { NewsItem } from "@/lib/types/trading";
import { formatRelativeTime } from "@/lib/utils";

const SOURCE_COLORS: Record<string, string> = {
  bloomberg: "text-orange-400",
  reuters: "text-blue-400",
  cnbc: "text-yellow-400",
  marketwatch: "text-green-400",
  seekingalpha: "text-orange-300",
  yahoo: "text-purple-400",
  wsj: "text-sky-400",
  barrons: "text-red-400",
  fool: "text-blue-300",
  benzinga: "text-teal-400",
};

export function StockCard({ item, compact }: { item: NewsItem; compact?: boolean }) {
  const sourceColor = SOURCE_COLORS[item.source] ?? "text-zinc-400";

  if (compact) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all group"
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-zinc-200 group-hover:text-white line-clamp-2 leading-snug">
            {item.title}
          </h4>
          <ExternalLink className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px]">
          <span className={`font-bold uppercase ${sourceColor}`}>{item.source}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">
            {item.published_date ? formatRelativeTime(item.published_date) : "recently"}
          </span>
          {item.score > 0 && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">{Math.round(item.score * 100)}% match</span>
            </>
          )}
        </div>
      </a>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-white leading-snug">
            {item.title}
          </h4>
          <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">
            {item.content.slice(0, 200)}
          </p>
        </div>
        <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px]">
        <span className={`font-bold uppercase ${sourceColor}`}>{item.source}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500">
          {item.published_date ? formatRelativeTime(item.published_date) : "recently"}
        </span>
        {item.score > 0 && (
          <>
            <span className="text-zinc-600">·</span>
            <span className="font-mono text-zinc-500">{Math.round(item.score * 100)}%</span>
          </>
        )}
      </div>
    </a>
  );
}
