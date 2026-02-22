"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useJournalStore } from "@/lib/stores/journalStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Download, Save, Clock, Calendar, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "edit" | "browse";

export function JournalNotepad() {
  const currentDraft = useJournalStore((s) => s.currentDraft);
  const updateDraft = useJournalStore((s) => s.updateDraft);
  const saveDraft = useJournalStore((s) => s.saveDraft);
  const exportToday = useJournalStore((s) => s.exportToday);
  const exportForDate = useJournalStore((s) => s.exportForDate);
  const getEntriesForDate = useJournalStore((s) => s.getEntriesForDate);
  const getAvailableDates = useJournalStore((s) => s.getAvailableDates);
  const hydrated = useJournalStore((s) => s.hydrated);
  const showToast = useUIStore((s) => s.showToast);

  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [browseDate, setBrowseDate] = useState<Date | null>(null);
  const [browseContent, setBrowseContent] = useState<string>("");
  const [localText, setLocalText] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const availableDates = getAvailableDates();

  // Sync from store on hydration
  useEffect(() => {
    if (hydrated) {
      setLocalText(currentDraft);
    }
  }, [hydrated, currentDraft]);

  // Load content for browsed date
  useEffect(() => {
    if (browseDate && viewMode === "browse") {
      const entries = getEntriesForDate(browseDate);
      if (entries.length > 0) {
        setBrowseContent(entries.map((e) => e.content).join("\n\n---\n\n"));
      } else {
        setBrowseContent("_No entries for this date._");
      }
    }
  }, [browseDate, viewMode, getEntriesForDate]);

  // Debounced save
  const handleTextChange = useCallback(
    (newText: string) => {
      setLocalText(newText);
      updateDraft(newText);
      setSaveStatus("saving");

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        saveDraft();
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }, 500);
    },
    [updateDraft, saveDraft]
  );

  // Insert timestamp on Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      const now = new Date();
      const timestamp = `[${now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}] `;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        localText.substring(0, start) +
        "\n" +
        timestamp +
        localText.substring(end);

      handleTextChange(newText);

      // Move cursor after timestamp
      setTimeout(() => {
        const newPos = start + 1 + timestamp.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
        textarea.focus();
      }, 0);
    }
  };

  // Export entries
  const handleExport = () => {
    const dateToExport = viewMode === "browse" && browseDate ? browseDate : new Date();
    const markdown = viewMode === "browse" && browseDate
      ? exportForDate(browseDate)
      : exportToday();
    const dateStr = dateToExport.toISOString().split("T")[0];
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-journal-${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ message: "Exported journal as markdown", type: "success" });
  };

  // Insert timestamp button
  const insertTimestamp = () => {
    const now = new Date();
    const timestamp = `[${now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}] `;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prefix = localText.length > 0 && !localText.endsWith("\n") ? "\n" : "";
    const newText =
      localText.substring(0, start) +
      prefix +
      timestamp +
      localText.substring(end);

    handleTextChange(newText);

    setTimeout(() => {
      const newPos = start + prefix.length + timestamp.length;
      textarea.selectionStart = textarea.selectionEnd = newPos;
      textarea.focus();
    }, 0);
  };

  // Date navigation
  const navigateDate = (direction: "prev" | "next") => {
    if (!browseDate || availableDates.length === 0) return;

    const currentIndex = availableDates.findIndex(
      (d) => d.toDateString() === browseDate.toDateString()
    );

    if (direction === "prev" && currentIndex < availableDates.length - 1) {
      setBrowseDate(availableDates[currentIndex + 1]);
    } else if (direction === "next" && currentIndex > 0) {
      setBrowseDate(availableDates[currentIndex - 1]);
    }
  };

  const startBrowsing = () => {
    if (availableDates.length > 0) {
      // Start with yesterday or most recent past date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const pastDates = availableDates.filter((d) => d < new Date());
      setBrowseDate(pastDates.length > 0 ? pastDates[0] : availableDates[0]);
      setViewMode("browse");
    }
  };

  const formatBrowseDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isToday = browseDate?.toDateString() === new Date().toDateString();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
        <div className="flex items-center gap-3">
          {viewMode === "browse" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode("edit")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => navigateDate("prev")}
                  disabled={
                    !browseDate ||
                    availableDates.findIndex(
                      (d) => d.toDateString() === browseDate.toDateString()
                    ) >= availableDates.length - 1
                  }
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 min-w-[140px] text-center">
                  {browseDate && formatBrowseDate(browseDate)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => navigateDate("next")}
                  disabled={
                    !browseDate ||
                    availableDates.findIndex(
                      (d) => d.toDateString() === browseDate.toDateString()
                    ) <= 0
                  }
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              {isToday && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  Today
                </span>
              )}
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Journal Notepad
              </h2>
              <div className="flex items-center gap-1.5">
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1 text-xs text-amber-500">
                    <Save className="h-3 w-3 animate-pulse" />
                    Saving...
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <Save className="h-3 w-3" />
                    Saved
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "edit" && (
            <>
              {availableDates.length > 1 && (
                <Button
                  onClick={startBrowsing}
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-7 text-xs text-zinc-600 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  History
                </Button>
              )}
              <Button
                onClick={insertTimestamp}
                size="sm"
                variant="ghost"
                className="gap-1.5 h-7 text-xs text-zinc-600 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                <Clock className="h-3.5 w-3.5" />
                Timestamp
              </Button>
            </>
          )}
          <Button
            onClick={handleExport}
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs border-teal-500/30 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10"
          >
            <Download className="h-3.5 w-3.5" />
            Export {viewMode === "browse" ? "This Day" : "Today"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-hidden">
        {viewMode === "browse" ? (
          <div className="w-full h-full overflow-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
              {browseContent}
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Start typing your journal entry...\n\nPress Enter to add a timestamp.\nUse Shift+Enter for a regular new line.\n\nExample:\n[14:35] Ran batch test with new D2 prompt\n[14:42] Catch rate improved to 85%`}
            className={cn(
              "w-full h-full resize-none bg-transparent border-none focus:outline-none",
              "text-sm text-zinc-900 dark:text-zinc-100 font-mono leading-relaxed",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            )}
            spellCheck={false}
          />
        )}
      </div>

      {/* Helper text */}
      <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
        {viewMode === "browse" ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <span className="text-teal-500">Read-only view</span>
            <span className="mx-2">|</span>
            Use arrows to navigate dates
            <span className="mx-2">|</span>
            Click back to return to today's entry
          </p>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <span className="text-teal-500">Enter</span> = add timestamp
            <span className="mx-2">|</span>
            <span className="text-teal-500">Shift+Enter</span> = new line
            <span className="mx-2">|</span>
            Auto-saves every 500ms
            <span className="mx-2">|</span>
            Markdown supported
          </p>
        )}
      </div>
    </div>
  );
}
