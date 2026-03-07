"use client";

// FileSystem Access API types (for webkitGetAsEntry)
interface FileSystemEntry { isFile: boolean; isDirectory: boolean; name: string; }
interface FileSystemFileEntry extends FileSystemEntry { file(cb: (f: File) => void, err?: () => void): void; }
interface FileSystemDirectoryEntry extends FileSystemEntry { createReader(): FileSystemDirectoryReader; }
interface FileSystemDirectoryReader { readEntries(cb: (entries: FileSystemEntry[]) => void, err?: () => void): void; }

import { useState, useRef, useCallback, useEffect } from "react";
import { useKnowledgeStore } from "@sarge/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Upload, X, FileText, ImageIcon, Archive, File as FileIcon, Database } from "lucide-react";
import { inputCls, textareaCls, dashedCardCls } from "@/components/settings/settingsStyles";

export function SettingsKnowledge() {
  const documents = useKnowledgeStore((s) => s.documents);
  const hydrated = useKnowledgeStore((s) => s.hydrated);
  const hydrate = useKnowledgeStore((s) => s.hydrate);
  const addDocument = useKnowledgeStore((s) => s.addDocument);
  const addFromFiles = useKnowledgeStore((s) => s.addFromFiles);
  const removeDocument = useKnowledgeStore((s) => s.removeDocument);
  const clearAllDocuments = useKnowledgeStore((s) => s.clearAll);
  const knowledgeError = useKnowledgeStore((s) => s.error);
  const clearKnowledgeError = useKnowledgeStore((s) => s.clearError);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docName, setDocName] = useState("");
  const [docContent, setDocContent] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddDoc = () => {
    if (!docName.trim() || !docContent.trim()) return;
    addDocument(docName.trim(), docContent.trim());
    setDocName("");
    setDocContent("");
    setShowAddDoc(false);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await addFromFiles(files);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      const readEntry = (entry: FileSystemEntry): Promise<File[]> => {
        return new Promise((resolve) => {
          if (entry.isFile) {
            (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]));
          } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            const results: Promise<File[]>[] = [];
            const readBatch = () => {
              reader.readEntries(async (entries) => {
                if (entries.length === 0) {
                  const nested = await Promise.all(results);
                  resolve(nested.flat());
                } else {
                  for (const e of entries) results.push(readEntry(e));
                  readBatch();
                }
              }, () => resolve([]));
            };
            readBatch();
          } else {
            resolve([]);
          }
        });
      };

      const items = e.dataTransfer.items;
      const allFiles: File[] = [];
      let usedEntries = false;

      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const entry = (items[i] as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.();
          if (entry) {
            usedEntries = true;
            const files = await readEntry(entry);
            allFiles.push(...files);
          }
        }
      }

      if (!usedEntries) {
        allFiles.push(...Array.from(e.dataTransfer.files));
      }

      if (allFiles.length > 0) {
        await addFromFiles(allFiles);
      }
    },
    [addFromFiles]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-100 dark:text-white">Knowledge Vault</h2>
        <p className="mb-4 text-xs font-medium text-zinc-300 dark:text-white">
          Upload documents, paste text, or drag files here. These are injected into your conversations as context for the AI.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { handleFileUpload(e.target.files); e.target.value = ""; }}
      />

      {knowledgeError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-300 dark:border-red-700/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <span className="flex-1">{knowledgeError}</span>
          <button onClick={clearKnowledgeError} className="text-red-400 hover:text-red-300"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700">
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Files
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowAddDoc(true)} className="text-zinc-300 dark:text-zinc-100 hover:text-zinc-800 dark:hover:text-zinc-200">
          <Plus className="h-3.5 w-3.5 mr-1" /> Paste Text
        </Button>
        {documents.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearAllDocuments} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 ml-auto">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
          </Button>
        )}
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed transition-colors ${
          dragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-zinc-300 dark:border-zinc-700"
        } ${documents.length === 0 ? "p-8" : "p-3"}`}
      >
        {documents.length === 0 ? (
          <div className="text-center">
            <Database className="mx-auto h-8 w-8 text-zinc-100 dark:text-white mb-2" />
            <p className="text-sm text-zinc-300">Drop files here — text, images, zips, or entire folders</p>
            <p className="text-xs text-zinc-100 dark:text-white mt-1">Supported: text files, images (&lt; 2MB), zip archives</p>
          </div>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => {
              const DocIcon = doc.type === "image" ? ImageIcon
                : doc.type === "binary" ? (doc.name.match(/\.zip$/i) ? Archive : FileIcon)
                : FileText;
              const iconColor = doc.type === "image" ? "text-emerald-500"
                : doc.type === "binary" ? "text-amber-500"
                : "text-indigo-500";
              const sizeStr = doc.size < 1024 ? `${doc.size}B`
                : doc.size < 1024 * 1024 ? `${(doc.size / 1024).toFixed(0)}KB`
                : `${(doc.size / (1024 * 1024)).toFixed(1)}MB`;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <DocIcon className={`h-4 w-4 flex-shrink-0 ${iconColor}`} />
                  <span className="flex-1 truncate" title={doc.name}>{doc.name}</span>
                  <span className="text-xs text-zinc-100 dark:text-white">{sizeStr}</span>
                  <button onClick={() => removeDocument(doc.id)} className="text-zinc-100 hover:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {dragging && (
              <p className="py-2 text-center text-sm text-indigo-400">Drop to add</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-100 dark:text-white">{documents.length} document{documents.length !== 1 ? "s" : ""} in vault</p>

      {showAddDoc && (
        <div className={dashedCardCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-100 dark:text-white">Add Text Document</h3>
            <button onClick={() => setShowAddDoc(false)} className="text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300"><X className="h-4 w-4" /></button>
          </div>
          <Input
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="Document name (e.g., My Patent)"
            className={`mb-2 ${inputCls}`}
          />
          <textarea
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            placeholder="Paste your document content here..."
            rows={8}
            className={textareaCls}
          />
          <Button
            onClick={handleAddDoc}
            disabled={!docName.trim() || !docContent.trim()}
            size="sm"
            className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Document
          </Button>
        </div>
      )}
    </div>
  );
}
