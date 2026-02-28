/**
 * Shared utility for parsing streaming AI content into structured edits.
 * Used by StreamingMessageRenderer (chat bubbles) and BuilderStatusStrip (artifact panel).
 */

/**
 * Infer a meaningful filename from code content instead of generic "artifact.html"
 */
export function inferFilename(code: string, ext: string, language: string): string {
  if (ext === "html" || language === "html" || language === "htm") {
    if (code.includes("<!DOCTYPE html>") || code.includes("<html")) return "index.html";
    if (code.includes("<nav") || code.includes("navbar")) return "navbar.html";
    if (code.includes("<form") && (code.includes("login") || code.includes("sign"))) return "login.html";
    if (code.includes("<form")) return "form.html";
    if (code.includes("<footer")) return "footer.html";
    if (code.includes("<header")) return "header.html";
    return "index.html";
  }
  if (ext === "css" || language === "css" || language === "scss") {
    if (code.match(/^:root\s*\{|--[a-z]/m)) return "variables.css";
    if (code.match(/dark|theme|color-scheme/i)) return "theme.css";
    return "styles.css";
  }
  if (ext === "tsx" || ext === "ts" || language === "tsx" || language === "typescript") {
    const fnMatch = code.match(/export\s+default\s+function\s+(\w+)/);
    if (fnMatch) return `${fnMatch[1]}.tsx`;
    const constMatch = code.match(/(?:export\s+)?(?:const|function)\s+(\w+)/);
    if (constMatch && constMatch[1][0] === constMatch[1][0].toUpperCase()) return `${constMatch[1]}.tsx`;
    return "Component.tsx";
  }
  if (ext === "jsx" || ext === "js" || language === "javascript" || language === "jsx") {
    const fnMatch = code.match(/export\s+default\s+function\s+(\w+)/);
    if (fnMatch) return `${fnMatch[1]}.jsx`;
    if (code.includes("addEventListener") || code.includes("document.querySelector")) return "main.js";
    return "script.js";
  }
  if (ext === "json" || language === "json") {
    if (code.includes('"name"') && code.includes('"version"')) return "package.json";
    if (code.includes('"compilerOptions"')) return "tsconfig.json";
    return "data.json";
  }
  if (ext === "py" || language === "python") return "main.py";
  return `file.${ext}`;
}

export interface ParsedEdit {
  filePath: string;
  content: string;
  language: string;
  isNew: boolean;
  lineCount: number;
}

export interface ParsedContent {
  explanationBefore: string;
  edits: ParsedEdit[];
  explanationAfter: string;
  isComplete: boolean;
}

export function parseStreamingContent(content: string): ParsedContent {
  const result: ParsedContent = {
    explanationBefore: "",
    edits: [],
    explanationAfter: "",
    isComplete: false,
  };

  if (!content) return result;

  // Check for FILE: path pattern (project mode)
  const fileEditRegex = /FILE:\s*([^\n]+)\n```(\w+)?[\r\n]+([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let hasFileEdits = false;

  while ((match = fileEditRegex.exec(content)) !== null) {
    hasFileEdits = true;
    if (result.edits.length === 0) {
      result.explanationBefore = content.substring(lastIndex, match.index).trim();
    }
    result.edits.push({
      filePath: match[1].trim(),
      content: match[3] || "",
      language: match[2] || "text",
      isNew: false,
      lineCount: (match[3] || "").split("\n").length,
    });
    lastIndex = match.index + match[0].length;
  }

  if (hasFileEdits) {
    result.explanationAfter = content.substring(lastIndex).trim();
    result.isComplete = true;
    return result;
  }

  // Generic code blocks
  const codeBlockRegex = /```(\w+)?[ \t]*[\r\n]+([\s\S]*?)```/g;
  lastIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const code = match[2] || "";
    if (code.length < 50 && !code.includes("\n")) continue;

    if (result.edits.length === 0) {
      result.explanationBefore = content.substring(lastIndex, match.index).trim();
    }

    const language = match[1] || "html";
    let ext = "html";
    if (language === "typescript" || language === "tsx" || language === "ts") ext = "tsx";
    else if (language === "javascript" || language === "jsx" || language === "js") ext = "jsx";
    else if (language === "css" || language === "scss" || language === "less") ext = "css";
    else if (language === "json") ext = "json";
    else if (language === "python" || language === "py") ext = "py";

    result.edits.push({
      filePath: inferFilename(code, ext, language),
      content: code,
      language,
      isNew: true,
      lineCount: code.split("\n").length,
    });
    lastIndex = match.index + match[0].length;
  }

  if (result.edits.length > 0) {
    result.explanationAfter = content.substring(lastIndex).trim();
    result.isComplete = true;
  } else {
    // Check for unclosed code block (still streaming)
    const openFenceMatch = content.match(/```(\w+)?[ \t]*[\r\n]+([\s\S]*)$/);
    if (openFenceMatch && !openFenceMatch[2].includes("```")) {
      result.explanationBefore = content.substring(0, content.lastIndexOf("```")).trim();
      const lang = openFenceMatch[1] || "html";
      const code = openFenceMatch[2] || "";
      let ext = lang === "css" ? "css" : lang === "tsx" || lang === "typescript" ? "tsx" : "html";

      result.edits.push({
        filePath: inferFilename(code, ext, lang),
        content: code,
        language: lang,
        isNew: true,
        lineCount: code.split("\n").length,
      });
      result.isComplete = false;
    } else {
      result.explanationBefore = content;
    }
  }

  return result;
}
