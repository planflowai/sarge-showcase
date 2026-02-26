"use client";

import { useEffect, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";

interface BuilderDiffEditorProps {
  originalContent: string;
  modifiedContent: string;
  language?: string;
  filePath?: string;
}

/**
 * Monaco Diff Editor for comparing file changes
 */
export default function BuilderDiffEditor({
  originalContent,
  modifiedContent,
  language = "plaintext",
  filePath,
}: BuilderDiffEditorProps) {
  const diffEditorRef = useRef<any>(null);

  // Detect language from file path if not provided
  const detectedLanguage = language !== "plaintext" ? language : detectLanguageFromPath(filePath);

  // Cleanup function for proper Monaco disposal order
  useEffect(() => {
    return () => {
      if (diffEditorRef.current) {
        try {
          // Reset models BEFORE disposing editor to prevent race condition
          diffEditorRef.current.setModel(null);
        } catch (e) {
          // Ignore if already disposed
        }
        try {
          diffEditorRef.current.dispose();
        } catch (e) {
          // Ignore if already disposed
        }
        diffEditorRef.current = null;
      }
    };
  }, []);

  return (
    <div className="h-full w-full">
      <DiffEditor
        height="100%"
        language={detectedLanguage}
        original={originalContent}
        modified={modifiedContent}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          originalEditable: false,
          renderOverviewRuler: true,
          diffWordWrap: "on",
        }}
        onMount={(editor) => {
          diffEditorRef.current = editor;
        }}
      />
    </div>
  );
}

function detectLanguageFromPath(filePath?: string): string {
  if (!filePath) return "plaintext";

  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
  };

  return languageMap[ext] || 'plaintext';
}
