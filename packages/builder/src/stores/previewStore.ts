import { create } from "zustand";

export interface PreviewFile {
  path: string;
  content: string;
  language: string;
}

interface PreviewState {
  isOpen: boolean;
  code: string;
  language: string;
  fileName: string;
  // Multi-file support
  files: PreviewFile[];
  activeFile: string; // path of active file
  openPreview: (code: string, language: string, fileName?: string) => void;
  openFiles: (files: PreviewFile[], entryFile?: string) => void;
  setActiveFile: (path: string) => void;
  closePreview: () => void;
}

function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "html", htm: "html", css: "css", js: "javascript", jsx: "jsx",
    ts: "typescript", tsx: "tsx", json: "json", md: "markdown", py: "python",
    rs: "rust", go: "go", java: "java", xml: "xml", yaml: "yaml", yml: "yaml",
    svg: "xml", txt: "text",
  };
  return map[ext] || "text";
}

export const usePreviewStore = create<PreviewState>((set) => ({
  isOpen: false,
  code: "",
  language: "",
  fileName: "code",
  files: [],
  activeFile: "",
  openPreview: (code, language, fileName) =>
    set({
      isOpen: true,
      code,
      language,
      fileName: fileName || `code.${language || "txt"}`,
      files: [{ path: fileName || `code.${language || "txt"}`, content: code, language }],
      activeFile: fileName || `code.${language || "txt"}`,
    }),
  openFiles: (files, entryFile) => {
    const entry = entryFile || files.find((f) => /index\.html?$/i.test(f.path))?.path || files[0]?.path || "";
    const active = files.find((f) => f.path === entry);
    set({
      isOpen: true,
      files,
      activeFile: entry,
      code: active?.content || "",
      language: active?.language || "text",
      fileName: entry,
    });
  },
  setActiveFile: (path) =>
    set((state) => {
      const file = state.files.find((f) => f.path === path);
      if (!file) return state;
      return { activeFile: path, code: file.content, language: file.language, fileName: path };
    }),
  closePreview: () =>
    set({ isOpen: false, code: "", language: "", fileName: "code", files: [], activeFile: "" }),
}));

export { guessLanguage };
