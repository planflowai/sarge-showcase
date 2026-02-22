"use client";

import { useDebateStore } from "@/lib/stores/debateStore";
import { providers } from "@/lib/providers";
import { Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DebateBanner() {
  const { debate, endDebate } = useDebateStore();

  if (!debate) return null;

  const participantNames = debate.participants
    .map((p) => providers.find((pr) => pr.id === p.provider)?.name ?? p.provider)
    .join(" vs ");

  return (
    <div className="flex items-center gap-3 border-b border-zinc-700 bg-zinc-800/50 px-4 py-2">
      <Swords className="h-4 w-4 text-amber-400" />
      <div className="flex-1">
        <p className="text-xs font-semibold text-amber-400">
          Debate: {debate.topic}
        </p>
        <p className="text-[10px] text-zinc-500">
          {participantNames} — Round {debate.currentRound}/{debate.rounds}{" "}
          {debate.status === "completed" && "— Completed"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
        onClick={endDebate}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
