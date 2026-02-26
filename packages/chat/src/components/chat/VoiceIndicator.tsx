"use client";

import { Mic, Loader2, Volume2 } from "lucide-react";
import { cn } from "@sarge/core";
import type { VoiceState } from "@sarge/core";

interface VoiceIndicatorProps {
  voiceState: VoiceState;
}

export function VoiceIndicator({ voiceState }: VoiceIndicatorProps) {
  if (voiceState === "idle") return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-2 text-xs font-medium",
        voiceState === "listening" && "text-red-400",
        voiceState === "processing" && "text-amber-400",
        voiceState === "speaking" && "text-emerald-400"
      )}
    >
      {voiceState === "listening" && (
        <>
          <Mic className="h-3.5 w-3.5 animate-pulse" />
          <span>Listening...</span>
          {/* Simple waveform bars */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-0.5 rounded-full bg-red-400"
                style={{
                  height: `${8 + Math.random() * 12}px`,
                  animation: `pulse 0.5s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </div>
        </>
      )}
      {voiceState === "processing" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Processing...</span>
        </>
      )}
      {voiceState === "speaking" && (
        <>
          <Volume2 className="h-3.5 w-3.5 animate-pulse" />
          <span>Speaking...</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-0.5 rounded-full bg-emerald-400"
                style={{
                  height: `${8 + Math.random() * 12}px`,
                  animation: `pulse 0.5s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
