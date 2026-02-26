"use client";

import { useState, useEffect } from "react";
import { useKnowledgeStore, type KnowledgeDocument } from "@sarge/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Image, Check, X, Database, Search } from "lucide-react";
import { cn } from "@sarge/core";

interface VaultAttachmentModalProps {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function VaultAttachmentModal({
  open,
  onClose,
  selectedIds,
  onSelectionChange,
}: VaultAttachmentModalProps) {
  const documents = useKnowledgeStore((s) => s.documents);
  const hydrated = useKnowledgeStore((s) => s.hydrated);
  const hydrate = useKnowledgeStore((s) => s.hydrate);
  const [search, setSearch] = useState("");
  const [localSelection, setLocalSelection] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    setLocalSelection(selectedIds);
  }, [selectedIds, open]);

  const toggleDocument = (id: string) => {
    setLocalSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    onSelectionChange(localSelection);
    onClose();
  };

  const handleClear = () => {
    setLocalSelection([]);
  };

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(search.toLowerCase()) ||
    doc.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const estimateTokens = (content: string) => {
    // Rough estimate: ~4 chars per token
    return Math.ceil(content.length / 4);
  };

  const totalSelectedTokens = localSelection.reduce((sum, id) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return sum;
    const tokens = Math.min(estimateTokens(doc.content), 2000); // Cap at 2000 per file
    return sum + tokens;
  }, 0);

  const maxTotalTokens = 6000;
  const isOverLimit = totalSelectedTokens > maxTotalTokens;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-400" />
            Attach from Knowledge Vault
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border-0 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Token budget indicator */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">
            Selected: {localSelection.length} file{localSelection.length !== 1 ? "s" : ""}
          </span>
          <span className={cn(
            "font-medium",
            isOverLimit ? "text-red-400" : "text-zinc-400"
          )}>
            ~{totalSelectedTokens.toLocaleString()} / {maxTotalTokens.toLocaleString()} tokens
          </span>
        </div>

        {/* Document list */}
        <ScrollArea className="h-64 rounded-lg border border-zinc-200 dark:border-zinc-700">
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Database className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">
                {documents.length === 0
                  ? "No documents in vault"
                  : "No matching documents"}
              </p>
              {documents.length === 0 && (
                <a
                  href="/settings"
                  className="mt-2 text-xs text-indigo-400 hover:underline"
                >
                  Add documents in Settings
                </a>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredDocs.map((doc) => {
                const isSelected = localSelection.includes(doc.id);
                const docTokens = Math.min(estimateTokens(doc.content), 2000);
                const willTruncate = estimateTokens(doc.content) > 2000;

                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDocument(doc.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                      isSelected
                        ? "bg-indigo-600/20 border border-indigo-500/50"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>

                    {/* Icon */}
                    {doc.type === "image" ? (
                      <Image className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                          {doc.name}
                        </span>
                        {willTruncate && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            truncated
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{formatSize(doc.size)}</span>
                        <span>~{docTokens} tokens</span>
                        {doc.tags && doc.tags.length > 0 && (
                          <span className="truncate">
                            {doc.tags.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {isOverLimit && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            Selection exceeds {maxTotalTokens.toLocaleString()} token limit. Some files will be truncated more aggressively.
          </div>
        )}

        <DialogFooter className="gap-2">
          {localSelection.length > 0 && (
            <Button variant="ghost" onClick={handleClear} className="text-zinc-400">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="text-zinc-400">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Attach {localSelection.length > 0 ? `(${localSelection.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export a helper to get selected documents with content
export function getVaultDocumentsForContext(
  documents: KnowledgeDocument[],
  selectedIds: string[],
  maxTokensPerFile: number = 2000,
  maxTotalTokens: number = 6000
): { docs: { id: string; name: string; content: string; truncated: boolean }[]; totalTokens: number } {
  const result: { id: string; name: string; content: string; truncated: boolean }[] = [];
  let totalTokens = 0;

  for (const id of selectedIds) {
    const doc = documents.find((d) => d.id === id);
    if (!doc || doc.type === "image") continue; // Skip images for now

    const estimatedTokens = Math.ceil(doc.content.length / 4);
    let content = doc.content;
    let truncated = false;

    // Truncate per-file limit
    if (estimatedTokens > maxTokensPerFile) {
      const maxChars = maxTokensPerFile * 4;
      content = doc.content.slice(0, maxChars) + "\n...[truncated]";
      truncated = true;
    }

    // Check total budget
    const contentTokens = Math.ceil(content.length / 4);
    if (totalTokens + contentTokens > maxTotalTokens) {
      // Truncate to fit remaining budget
      const remainingTokens = maxTotalTokens - totalTokens;
      if (remainingTokens > 100) {
        const maxChars = remainingTokens * 4;
        content = doc.content.slice(0, maxChars) + "\n...[truncated]";
        truncated = true;
        totalTokens = maxTotalTokens;
        result.push({ id: doc.id, name: doc.name, content, truncated });
      }
      break;
    }

    totalTokens += contentTokens;
    result.push({ id: doc.id, name: doc.name, content, truncated });
  }

  return { docs: result, totalTokens };
}
