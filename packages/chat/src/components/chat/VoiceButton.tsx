"use client";

import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@sarge/core";
import type { VoiceState } from "@sarge/core";

interface VoiceButtonProps {
  voiceState: VoiceState;
  supportsVoice: boolean;
  onStart: () => void;
  onStop: () => void;
  onInterrupt: () => void;
}

const stateLabels: Record<VoiceState, string> = {
  idle: "Start voice",
  listening: "Listening...",
  processing: "Processing...",
  speaking: "Speaking...",
};

export function VoiceButton({
  voiceState,
  supportsVoice,
  onStart,
  onStop,
  onInterrupt,
}: VoiceButtonProps) {
  if (!supportsVoice) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                disabled
                className="h-[44px] bg-zinc-800 text-zinc-600 cursor-not-allowed"
              >
                <MicOff className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Voice not supported for this provider</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const handleClick = () => {
    switch (voiceState) {
      case "idle":
        onStart();
        break;
      case "speaking":
        onInterrupt();
        break;
      case "listening":
      case "processing":
        onStop();
        break;
    }
  };

  const isActive = voiceState !== "idle";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            className={cn(
              "h-[44px] relative",
              isActive
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            )}
          >
            {voiceState === "idle" && <Mic className="h-4 w-4" />}
            {voiceState === "listening" && (
              <>
                <Mic className="h-4 w-4 animate-pulse" />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              </>
            )}
            {voiceState === "processing" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {voiceState === "speaking" && (
              <Volume2 className="h-4 w-4 animate-pulse" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{stateLabels[voiceState]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
