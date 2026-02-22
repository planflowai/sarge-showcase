"use client";

import { useEffect } from "react";
import { useJournalStore } from "@/lib/stores/journalStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { JournalNotepad } from "@/components/journal/JournalNotepad";
import { JournalChatPanel } from "@/components/journal/JournalChatPanel";
import { AnalysisPanel } from "@/components/journal/AnalysisPanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { BookText } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PageLoading } from "@/components/ui/skeleton";

export default function JournalPage() {
  const hydrate = useJournalStore((s) => s.hydrate);
  const hydrated = useJournalStore((s) => s.hydrated);
  const hydrateBatchHistory = useTestModeStore((s) => s.hydrateBatchHistory);

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
    // Hydrate batch history from localStorage
    hydrateBatchHistory();
  }, [hydrate, hydrated, hydrateBatchHistory]);

  if (!hydrated) {
    return <PageLoading message="Loading journal..." />;
  }

  return (
    <ErrorBoundary fallbackTitle="Journal Error">
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30">
            <BookText className="h-4 w-4 text-teal-500" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Project Journal
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Chat · Analysis · Notes
            </p>
          </div>
        </div>
      </div>

      {/* 3-Column Layout: Chat | Analysis | Journal */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* Chat Panel */}
          <ResizablePanel defaultSize={30} minSize={20}>
            <JournalChatPanel />
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-zinc-200 dark:bg-zinc-800 hover:bg-teal-500/30 transition-colors" />

          {/* Analysis Panel */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <AnalysisPanel />
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-zinc-200 dark:bg-zinc-800 hover:bg-indigo-500/30 transition-colors" />

          {/* Journal Notepad */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <JournalNotepad />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
    </ErrorBoundary>
  );
}
