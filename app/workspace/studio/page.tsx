"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bot, Hammer, Send, StopCircle, X, Zap, Clock, Copy, Check, UserPlus, MessageSquare, Globe, Search, Router, DollarSign, Sparkles, AlertTriangle, PanelLeftClose, PanelLeft, Folder, Code2, Eye, FileCode, Sparkle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useWorkspaceStore, type AgentConfig } from "@/lib/stores/workspaceStore";
import { useModelStore } from "@/lib/stores/modelStore";
import { useBuilderModeStore, getBuilderSystemPrompt } from "@/lib/stores/builderModeStore";
import { useBuilderDocumentStore } from "@/lib/stores/builderDocumentStore";
import { providers } from "@/lib/providers";
import { getOllamaFriendlyName } from "@/lib/ollamaModelGroups";
import { fetchOllamaModels, type LocalModel } from "@/lib/providers/localModels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  analyzeTask,
  logRoutingDecision,
  getModelDisplayName,
  getTaskTypeDisplayName,
  type TaskAnalysis,
  type RoutingDecision,
} from "@/lib/builderAutoRouter";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { BuilderFileTree } from "@/components/Builder/BuilderFileTree";

// Web search/fetch types
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebFetchResult {
  title: string;
  url: string;
  content: string;
  wordCount: number;
  error?: string;
}

// Detect [SEARCH: query] patterns in AI response
function detectSearchCommands(content: string): string[] {
  const regex = /\[SEARCH:\s*([^\]]+)\]/gi;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

// Detect [FETCH: url] patterns in AI response
function detectFetchCommands(content: string): string[] {
  const regex = /\[FETCH:\s*([^\]]+)\]/gi;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

// Execute web search
async function executeWebSearch(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch("/api/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxResults: 5 }),
    });
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error("[WebSearch] Error:", err);
    return [];
  }
}

// Execute web fetch
async function executeWebFetch(url: string): Promise<WebFetchResult | null> {
  try {
    const res = await fetch("/api/web-fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, maxTokens: 4000 }),
    });
    return await res.json();
  } catch (err) {
    console.error("[WebFetch] Error:", err);
    return null;
  }
}

// Format search results for context injection
function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "[No search results found]";
  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
    .join("\n\n");
}

// Format fetch result for context injection
function formatFetchResult(result: WebFetchResult): string {
  if (result.error) return `[Fetch error: ${result.error}]`;
  return `**${result.title}** (${result.wordCount} words)\n${result.url}\n\n${result.content}`;
}

// ─── Multi-File Extraction ───────────────────────────────────────────────────

interface ExtractedFile {
  filename: string;
  language: string;
  content: string;
}

// Extract multiple code blocks with optional filenames
// Supports: ```html filename="index.html" or ```html:index.html or ```html <!-- index.html -->
function extractCodeBlocks(content: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];

  // Match code blocks with optional filename indicators
  const codeBlockRegex = /```(\w+)(?:\s*(?:filename=["']([^"']+)["']|:([^\s\n]+)|<!--\s*([^\s]+)\s*-->))?\n([\s\S]*?)```/g;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] || 'text';
    const filename = match[2] || match[3] || match[4] || inferFilename(language, files.length);
    const code = match[5].trim();

    if (code.length > 0) {
      files.push({
        filename,
        language,
        content: code,
      });
    }
  }

  return files;
}

// Infer a default filename based on language
function inferFilename(language: string, index: number): string {
  const suffix = index > 0 ? `_${index}` : '';
  const extensions: Record<string, string> = {
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
    jsx: 'jsx',
    tsx: 'tsx',
    json: 'json',
    markdown: 'md',
    md: 'md',
    python: 'py',
    py: 'py',
    rust: 'rs',
    go: 'go',
  };

  const ext = extensions[language.toLowerCase()] || language.toLowerCase();
  if (ext === 'html') return `index${suffix}.html`;
  if (ext === 'css') return `styles${suffix}.css`;
  if (ext === 'js') return `script${suffix}.js`;
  return `file${suffix}.${ext}`;
}

// Detect file creation commands in AI response
// Patterns: "Create a file called X", "Save this as X", "File: X", etc.
function detectFileCommands(content: string): { filename: string; action: 'create' | 'update' }[] {
  const commands: { filename: string; action: 'create' | 'update' }[] = [];

  // Pattern: "Create a file called/named X"
  const createPattern = /(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?file\s+(?:called|named)\s+['""]?([^'""'\n,]+)['""]?/gi;
  let match;
  while ((match = createPattern.exec(content)) !== null) {
    commands.push({ filename: match[1].trim(), action: 'create' });
  }

  // Pattern: "Save this as X" or "Save to X"
  const savePattern = /save\s+(?:this\s+)?(?:as|to)\s+['""]?([^'""'\n,]+)['""]?/gi;
  while ((match = savePattern.exec(content)) !== null) {
    commands.push({ filename: match[1].trim(), action: 'create' });
  }

  // Pattern: "Update X" or "Modify X"
  const updatePattern = /(?:update|modify|edit)\s+(?:the\s+)?(?:file\s+)?['""]?([^'""'\n,]+\.\w+)['""]?/gi;
  while ((match = updatePattern.exec(content)) !== null) {
    commands.push({ filename: match[1].trim(), action: 'update' });
  }

  return commands;
}

// Shared message interface
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  provider?: string;
  tokenCount?: number;
  latencyMs?: number;
  isStreaming?: boolean;
}

export default function StudioPage() {
  // Architect state
  const [architectMessages, setArchitectMessages] = useState<ChatMessage[]>([]);
  const [architectInput, setArchitectInput] = useState("");
  const [architectSending, setArchitectSending] = useState(false);
  const [architectModel, setArchitectModel] = useState<string | null>(null);
  const [architectProvider, setArchitectProvider] = useState<string>("ollama");
  const [architectAbort, setArchitectAbort] = useState<AbortController | null>(null);
  const architectScrollRef = useRef<HTMLDivElement>(null);
  const architectInputRef = useRef<HTMLTextAreaElement>(null);

  // Builder state
  const [builderMessages, setBuilderMessages] = useState<ChatMessage[]>([]);
  const [builderInput, setBuilderInput] = useState("");
  const [builderSending, setBuilderSending] = useState(false);
  const [builderModel, setBuilderModel] = useState<string | null>(null);
  const [builderProvider, setBuilderProvider] = useState<string>("ollama");
  const [builderAbort, setBuilderAbort] = useState<AbortController | null>(null);
  const builderScrollRef = useRef<HTMLDivElement>(null);
  const builderInputRef = useRef<HTMLTextAreaElement>(null);

  // Agent modal
  const [showAddAgent, setShowAddAgent] = useState(false);

  // File tree sidebar state
  const [fileTreeVisible, setFileTreeVisible] = useState(true);

  // Auto-router state
  const [routingAnalysis, setRoutingAnalysis] = useState<TaskAnalysis | null>(null);
  const [manualOverride, setManualOverride] = useState(false);

  // Builder mode
  const {
    mode: builderMode,
    editMode,
    toggleMode,
    toggleEditMode,
    autoRouterEnabled,
    modelPreference,
    toggleModelPreference,
    hydrated: modeHydrated,
    hydrate: hydrateMode
  } = useBuilderModeStore();

  // Settings for air-gap mode
  const airGapMode = useSettingsStore((s) => s.airGapMode);

  // Document store for file management
  const {
    currentProject,
    hydrated: docHydrated,
    hydrate: hydrateDocuments,
  } = useBuilderDocumentStore();

  // Workspace store
  const {
    hydrate,
    hydrated,
    setActiveWindow,
    setArchitectPlan,
    setArchitectLastMessage,
    setPreviewCode,
    setPreviewStreaming,
    addBuilderAction,
    setBuilderLastSummary,
    projectPath,
    projectName,
    builderActions,
    builderLastSummary,
    architectPlan,
    previewCode,  // Current code in preview - CRITICAL for context memory
    agents,
    addAgent,
    removeAgent,
  } = useWorkspaceStore();

  // Model store
  const { hydrated: modelHydrated, hydrate: hydrateModels, getEffectiveModels } = useModelStore();
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);

  // Fetch Ollama models
  useEffect(() => {
    fetchOllamaModels()
      .then((models) => setOllamaModels(models))
      .catch(() => setOllamaModels([]));
  }, []);

  // Get cloud models (including xai/Grok)
  const cloudModels = getEffectiveModels("anthropic")
    .concat(getEffectiveModels("openai"))
    .concat(getEffectiveModels("google"))
    .concat(getEffectiveModels("deepseek"))
    .concat(getEffectiveModels("xai"));

  // Hydrate stores
  useEffect(() => {
    if (!hydrated) hydrate();
    if (!modelHydrated) hydrateModels();
    if (!modeHydrated) hydrateMode();
    if (!docHydrated) hydrateDocuments();
  }, [hydrated, hydrate, modelHydrated, hydrateModels, modeHydrated, hydrateMode, docHydrated, hydrateDocuments]);

  // Auto-router: analyze task as user types (debounced)
  useEffect(() => {
    if (!autoRouterEnabled || !builderInput.trim() || manualOverride) {
      return;
    }

    const timer = setTimeout(async () => {
      // Build available cloud models list
      const availableCloudModels = providers
        .filter(p => p.id !== 'ollama')
        .map(p => ({
          provider: p.id,
          models: getEffectiveModels(p.id).map((m: { id: string }) => m.id),
        }))
        .filter(p => p.models.length > 0);

      const analysis = await analyzeTask(builderInput, previewCode || null, {
        preference: modelPreference,
        airGapMode,
        availableCloudModels,
      });

      setRoutingAnalysis(analysis);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [builderInput, previewCode, autoRouterEnabled, modelPreference, airGapMode, manualOverride, getEffectiveModels]);

  // Register as active window
  useEffect(() => {
    setActiveWindow("builder", true); // Using "builder" since it contains both
    return () => setActiveWindow("builder", false);
  }, [setActiveWindow]);

  // Track window position
  useEffect(() => {
    const handleResize = () => {
      useWorkspaceStore.getState().setWindowPosition("builder", {
        x: window.screenX,
        y: window.screenY,
        width: window.outerWidth,
        height: window.outerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("beforeunload", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("beforeunload", handleResize);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (architectScrollRef.current) {
      architectScrollRef.current.scrollTop = architectScrollRef.current.scrollHeight;
    }
  }, [architectMessages]);

  useEffect(() => {
    if (builderScrollRef.current) {
      builderScrollRef.current.scrollTop = builderScrollRef.current.scrollHeight;
    }
  }, [builderMessages]);

  // Extract code from response
  const extractCode = (content: string): string | null => {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    if (matches.length > 0) return matches[matches.length - 1][1].trim();
    const partialMatch = content.match(/```(?:\w+)?\n([\s\S]+)$/);
    if (partialMatch) return partialMatch[1].trim();
    return null;
  };

  // Build architect context
  const buildArchitectContext = useCallback(() => {
    let context = "";
    if (projectPath) context += `[PROJECT: ${projectName || projectPath}]\n`;
    if (builderActions.length > 0) {
      context += "\n[BUILDER HISTORY:]\n";
      builderActions.slice(-10).forEach((a) => {
        context += `- ${a.action} ${a.filePath}: ${a.summary}\n`;
      });
    }
    if (builderLastSummary) context += `\n[LAST BUILD:]\n${builderLastSummary}\n`;
    return context;
  }, [projectPath, projectName, builderActions, builderLastSummary]);

  // Build builder context - INCLUDES current preview code for context memory
  const buildBuilderContext = useCallback(() => {
    let context = "";

    // Include current project info from document store
    const docStore = useBuilderDocumentStore.getState();
    if (docStore.currentProject) {
      context += `═══════════════════════════════════════════════════════════════════════════════
[PROJECT: ${docStore.currentProject.name}]
═══════════════════════════════════════════════════════════════════════════════\n`;

      // List project files so AI knows what exists
      const listFiles = (files: any[], prefix = ''): string[] => {
        const result: string[] = [];
        for (const file of files) {
          if (file.type === 'directory') {
            result.push(`${prefix}📁 ${file.name}/`);
            if (file.children) {
              result.push(...listFiles(file.children, `${prefix}  `));
            }
          } else {
            result.push(`${prefix}📄 ${file.name}`);
          }
        }
        return result;
      };

      const fileList = listFiles(docStore.currentProject.files);
      if (fileList.length > 0) {
        context += `\n[PROJECT FILES — These files exist in the project:]\n${fileList.join('\n')}\n`;
      }

      // Include active file content if one is open
      const activeFile = docStore.openFiles.find(f => f.path === docStore.activeFilePath);
      if (activeFile) {
        const numberedCode = activeFile.content.split('\n').map((line, i) => `${String(i + 1).padStart(4, ' ')}: ${line}`).join('\n');
        context += `\n[ACTIVE FILE: ${activeFile.path}]\n\`\`\`${activeFile.language}\n${numberedCode}\n\`\`\`\n`;
      }
    } else if (projectPath) {
      context += `[PROJECT: ${projectName || projectPath}]\n`;
    }

    if (architectPlan) context += `\n[ARCHITECT'S PLAN:]\n${architectPlan}\n`;

    // CRITICAL: Include current preview code so AI can modify existing work
    if (previewCode && previewCode.trim().length > 0) {
      // Add line numbers for edit mode - pad line numbers for alignment
      const lines = previewCode.split('\n');
      const padWidth = String(lines.length).length;
      const numberedCode = lines.map((line, i) => `${String(i + 1).padStart(padWidth, ' ')}: ${line}`).join('\n');

      context += `
═══════════════════════════════════════════════════════════════════════════════
[CURRENT CODE — This is what the user sees in the preview. EDIT THIS CODE.]
═══════════════════════════════════════════════════════════════════════════════
\`\`\`html
${numberedCode}
\`\`\`
═══════════════════════════════════════════════════════════════════════════════
`;
    }

    return context;
  }, [projectPath, projectName, architectPlan, previewCode]);

  // Process web search/fetch commands in AI response
  const processWebCommands = useCallback(async (content: string): Promise<string | null> => {
    const searchQueries = detectSearchCommands(content);
    const fetchUrls = detectFetchCommands(content);

    if (searchQueries.length === 0 && fetchUrls.length === 0) return null;

    let webContext = "\n\n[WEB RESEARCH RESULTS]\n";

    // Execute searches
    for (const query of searchQueries) {
      const results = await executeWebSearch(query);
      webContext += `\n### Search: "${query}"\n${formatSearchResults(results)}\n`;
    }

    // Execute fetches
    for (const url of fetchUrls) {
      const result = await executeWebFetch(url);
      if (result) {
        webContext += `\n### Fetched: ${url}\n${formatFetchResult(result)}\n`;
      }
    }

    return webContext;
  }, []);

  // Architect send
  const handleArchitectSend = async () => {
    if (!architectInput.trim() || !architectModel) return;
    const userMessage = architectInput.trim();
    setArchitectInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setArchitectMessages((prev) => [...prev, userMsg]);

    const assistantId = crypto.randomUUID();
    setArchitectMessages((prev) => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      model: architectModel,
      provider: architectProvider,
      isStreaming: true,
    }]);

    const controller = new AbortController();
    setArchitectAbort(controller);
    setArchitectSending(true);

    const startTime = Date.now();
    let totalContent = "";
    let tokenCount = 0;

    try {
      const context = buildArchitectContext();
      const systemPrompt = `You are an Architect assistant. Help plan and strategize software projects.

WEB RESEARCH: You have access to web search and fetch capabilities.
- To search the web: [SEARCH: your query here]
- To read a webpage: [FETCH: https://example.com]
When the user asks you to research competitors, review websites, or find inspiration, use these tools.
Results will be injected into context for your next response.

PLANNING OUTPUT: When you finalize a plan for the Builder, wrap it in a BUILDER_PROMPT block:
\`\`\`BUILDER_PROMPT
Your detailed instructions for the Builder here...
\`\`\`
Only the content inside BUILDER_PROMPT will be sent to the Builder.

${context}`;

      const response = await fetch("/api/test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: architectModel,
          prompt: userMessage,
          systemPrompt,
          source: architectProvider === "ollama" ? "local" : "cloud",
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              totalContent += data.message.content;
              tokenCount++;
              setArchitectMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: totalContent } : m)
              );
            }
            if (data.done && data.eval_count) tokenCount = data.eval_count;
          } catch {}
        }
      }

      setArchitectMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false, tokenCount, latencyMs: Date.now() - startTime } : m)
      );

      setArchitectLastMessage(totalContent);

      // Extract BUILDER_PROMPT block if present for Architect → Builder pipeline
      const builderPromptMatch = totalContent.match(/```BUILDER_PROMPT\n([\s\S]*?)```/);
      if (builderPromptMatch) {
        setArchitectPlan(builderPromptMatch[1].trim());
      } else if (totalContent.match(/^\d+\.|^-|\*\s/m)) {
        // Fallback: use the whole response if it looks like a plan
        setArchitectPlan(totalContent);
      }

      // Check for web search/fetch commands and process them
      const webContext = await processWebCommands(totalContent);
      if (webContext) {
        // Auto-inject web results as a follow-up
        const webResultId = crypto.randomUUID();
        setArchitectMessages((prev) => [...prev, {
          id: webResultId,
          role: "assistant",
          content: webContext,
          timestamp: new Date(),
          model: architectModel,
          provider: architectProvider,
        }]);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setArchitectMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } else {
        setArchitectMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `Error: ${(err as Error).message}`, isStreaming: false } : m)
        );
      }
    } finally {
      setArchitectSending(false);
      setArchitectAbort(null);
    }
  };

  // Builder send
  const handleBuilderSend = async () => {
    if (!builderInput.trim()) return;
    const userMessage = builderInput.trim();
    setBuilderInput("");

    // ─── AUTO-ROUTER ─────────────────────────────────────────────────────────
    // Determine which model to use based on task analysis
    let effectiveModel = builderModel;
    let effectiveProvider = builderProvider;
    let analysis: TaskAnalysis | null = null;
    const wasOverridden = manualOverride || !autoRouterEnabled;

    if (autoRouterEnabled && !manualOverride) {
      // Build available cloud models list for the router
      const availableCloudModels = providers
        .filter(p => p.id !== 'ollama')
        .map(p => ({
          provider: p.id,
          models: getEffectiveModels(p.id).map((m: { id: string }) => m.id),
        }))
        .filter(p => p.models.length > 0);

      // Analyze the task
      analysis = await analyzeTask(userMessage, previewCode || null, {
        preference: modelPreference,
        airGapMode,
        availableCloudModels,
      });

      setRoutingAnalysis(analysis);

      // Use the suggested model unless none found
      if (analysis.suggestedModel && analysis.suggestedModel !== 'none') {
        effectiveModel = analysis.suggestedModel;
        effectiveProvider = analysis.suggestedProvider;
      }
    }

    // If no model selected (manual mode without selection), show error
    if (!effectiveModel) {
      console.warn('[Builder] No model selected');
      return;
    }

    // Reset manual override for next message
    setManualOverride(false);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setBuilderMessages((prev) => [...prev, userMsg]);

    const assistantId = crypto.randomUUID();
    setBuilderMessages((prev) => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      model: effectiveModel,
      provider: effectiveProvider,
      isStreaming: true,
    }]);

    const controller = new AbortController();
    setBuilderAbort(controller);
    setBuilderSending(true);
    setPreviewStreaming(true);

    const startTime = Date.now();
    let totalContent = "";
    let tokenCount = 0;

    try {
      const context = buildBuilderContext();
      const modePrompt = getBuilderSystemPrompt(builderMode);
      const webResearchNote = `
WEB RESEARCH: You have access to web search and fetch capabilities.
- To search the web: [SEARCH: your query here]
- To read documentation or examples: [FETCH: https://example.com]
Use these when you need to look up APIs, find code examples, or research libraries.
`;

      // CRITICAL: Edit mode enforcement when existing code is present
      let editModeInstructions = "";
      const docStore = useBuilderDocumentStore.getState();
      const hasProject = docStore.currentProject !== null;
      const hasPreviewCode = previewCode && previewCode.trim().length > 0;

      if (hasPreviewCode || hasProject) {
        editModeInstructions = `
═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL: EDIT MODE — YOU ARE MODIFYING AN EXISTING PROJECT ⚠️
═══════════════════════════════════════════════════════════════════════════════

The current code is provided in [CURRENT CODE] above with line numbers.
${hasProject ? `Project files are listed in [PROJECT FILES] above.` : ''}

MANDATORY RULES:
1. DO NOT start from scratch or regenerate the entire site
2. DO NOT change the topic, theme, or purpose unless explicitly asked
3. DO NOT remove or replace existing sections unless explicitly asked
4. DO NOT use placeholder comments like "// rest of code here" — output COMPLETE files
5. PRESERVE all existing CSS, JavaScript, and HTML structure

YOUR TASK:
- Read the CURRENT CODE carefully
- Make ONLY the specific changes the user requested
- Return the COMPLETE updated file (not a partial snippet)
- Keep everything else exactly as it was

FORBIDDEN ACTIONS:
❌ Creating a new website from scratch
❌ Changing colors/fonts/layout unless asked
❌ Removing existing features or content
❌ Using placeholders or "..." to skip code
❌ Adding unwanted features or "improvements"

REQUIRED ACTION:
✅ Make the user's requested change
✅ Return the COMPLETE file with the change applied
✅ Leave everything else untouched

Remember: The user already has a working site. They want ONE change, not a rebuild.
═══════════════════════════════════════════════════════════════════════════════
`;
      }

      const systemPrompt = `${modePrompt}\n${webResearchNote}\n${editModeInstructions}\n${context}`;

      const response = await fetch("/api/test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: effectiveModel,
          prompt: userMessage,
          systemPrompt,
          source: effectiveProvider === "ollama" ? "local" : "cloud",
        }),
        signal: controller.signal,
      });

      // Log routing decision for forensics
      if (analysis) {
        const routingDecision: RoutingDecision = {
          ...analysis,
          timestamp: Date.now(),
          userMessage,
          codeLength: previewCode?.length || 0,
          wasOverridden,
          overrideModel: wasOverridden ? builderModel || undefined : undefined,
          overrideProvider: wasOverridden ? builderProvider : undefined,
        };
        logRoutingDecision(routingDecision);
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              totalContent += data.message.content;
              tokenCount++;
              setBuilderMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: totalContent } : m)
              );
              const code = extractCode(totalContent);
              if (code) setPreviewCode(code);
            }
            if (data.done && data.eval_count) tokenCount = data.eval_count;
          } catch {}
        }
      }

      setBuilderMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false, tokenCount, latencyMs: Date.now() - startTime } : m)
      );

      setBuilderLastSummary(totalContent.slice(0, 500));
      setPreviewStreaming(false);

      if (builderMode === "build") {
        const code = extractCode(totalContent);
        if (code) {
          addBuilderAction({
            action: "created",
            filePath: "preview",
            summary: userMessage.slice(0, 100),
            model: effectiveModel || builderModel || 'unknown',
          });

          // Auto-save to project if a project is open
          const docStore = useBuilderDocumentStore.getState();
          if (docStore.currentProject) {
            // Extract all code blocks with filenames
            const extractedFiles = extractCodeBlocks(totalContent);

            // If we found files with explicit names, save them
            if (extractedFiles.length > 0) {
              for (const file of extractedFiles) {
                await docStore.saveFile(file.filename, file.content);
                console.log(`[Builder] Auto-saved: ${file.filename}`);
              }
              // Refresh project to show new files
              await docStore.refreshProject();
            } else if (code) {
              // No explicit filenames - check for file commands
              const fileCommands = detectFileCommands(totalContent);
              const targetFile = fileCommands.length > 0
                ? fileCommands[0].filename
                : 'index.html'; // Default to index.html

              await docStore.saveFile(targetFile, code);
              console.log(`[Builder] Auto-saved: ${targetFile}`);
              await docStore.refreshProject();
            }
          }
        }
      }

      // Check for web search/fetch commands and process them
      const webContext = await processWebCommands(totalContent);
      if (webContext) {
        // Auto-inject web results as a follow-up
        const webResultId = crypto.randomUUID();
        setBuilderMessages((prev) => [...prev, {
          id: webResultId,
          role: "assistant",
          content: webContext,
          timestamp: new Date(),
          model: builderModel ?? undefined,
          provider: builderProvider,
        }]);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setBuilderMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } else {
        setBuilderMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `Error: ${(err as Error).message}`, isStreaming: false } : m)
        );
      }
      setPreviewStreaming(false);
    } finally {
      setBuilderSending(false);
      setBuilderAbort(null);
    }
  };

  const handleAddAgent = (model: string, provider: string) => {
    addAgent({ model, provider, role: "Reviewer", isActive: true });
    setShowAddAgent(false);
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      {/* Architect Panel */}
      <div className="flex-1 flex flex-col border-r border-zinc-800">
        {/* Architect Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium">Architect</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Local dropdown */}
            <select
              value={architectProvider === "ollama" && architectModel ? `ollama:${architectModel}` : ""}
              onChange={(e) => {
                if (e.target.value) {
                  const [, ...m] = e.target.value.split(":");
                  setArchitectProvider("ollama");
                  setArchitectModel(m.join(":"));
                }
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs max-w-[120px]"
            >
              <option value="">Local</option>
              {ollamaModels.map((m: LocalModel) => (
                <option key={`ollama:${m.id}`} value={`ollama:${m.id}`}>{getOllamaFriendlyName(m.id)}</option>
              ))}
            </select>
            {/* Cloud dropdown */}
            <select
              value={architectProvider !== "ollama" && architectModel ? `${architectProvider}:${architectModel}` : ""}
              onChange={(e) => {
                if (e.target.value) {
                  const [p, ...m] = e.target.value.split(":");
                  setArchitectProvider(p);
                  setArchitectModel(m.join(":"));
                }
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs max-w-[120px]"
            >
              <option value="">Cloud</option>
              {providers.filter((p) => p.id !== "ollama").map((provider) => {
                const active = cloudModels.filter((m: { provider?: string }) => m.provider === provider.id);
                if (!active.length) return null;
                return (
                  <optgroup key={provider.id} label={provider.name}>
                    {active.map((m: { id: string; name: string }) => (
                      <option key={`${provider.id}:${m.id}`} value={`${provider.id}:${m.id}`}>{m.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
        </div>

        {/* Architect Messages - overflow hidden to prevent horizontal scroll */}
        <div ref={architectScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3" style={{ wordBreak: 'break-word' }}>
          {architectMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Plan your approach here</p>
              {!architectModel && <p className="text-xs text-amber-500 mt-2">Select a model above</p>}
            </div>
          ) : (
            architectMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                color="amber"
                onOpenCode={() => console.log("[Architect] Open code clicked")}
                onPreview={() => console.log("[Architect] Preview clicked")}
              />
            ))
          )}
        </div>

        {/* Architect Input */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900">
          {!architectModel && (
            <div className="mb-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 flex items-center gap-2">
              <Bot className="w-3 h-3" />
              Select a model above to start planning
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              ref={architectInputRef}
              value={architectInput}
              onChange={(e) => setArchitectInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleArchitectSend(); }}}
              placeholder={architectModel ? "Plan, discuss, strategize..." : "Select a model above..."}
              disabled={!architectModel || architectSending}
              rows={2}
              className={cn(
                "flex-1 resize-none rounded-lg border px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none whitespace-pre-wrap break-words",
                !architectModel
                  ? "border-amber-500/30 bg-zinc-800/50 cursor-not-allowed opacity-60"
                  : "border-zinc-700 bg-zinc-800 focus:border-amber-500",
                architectSending && "opacity-50"
              )}
            />
            {architectSending ? (
              <Button onClick={() => architectAbort?.abort()} size="sm" className="bg-red-600 hover:bg-red-700 self-end">
                <StopCircle className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleArchitectSend} disabled={!architectModel || !architectInput.trim()} size="sm" className="bg-amber-600 hover:bg-amber-700 self-end disabled:opacity-50">
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Builder Panel (includes file tree sidebar) */}
      <div className="flex-1 flex">
        {/* File Tree Sidebar */}
        {fileTreeVisible && (
          <BuilderFileTree
            className="w-56 flex-shrink-0"
            onFileSelect={(path, content) => {
              // When a file is selected, update the preview code
              setPreviewCode(content);
            }}
          />
        )}

        {/* Builder Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Builder Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-2">
              {/* File Tree Toggle */}
              <button
                onClick={() => setFileTreeVisible(!fileTreeVisible)}
                className={cn(
                  "p-1.5 rounded hover:bg-zinc-800 transition-colors",
                  fileTreeVisible ? "text-emerald-400" : "text-zinc-500"
                )}
                title={fileTreeVisible ? "Hide file tree" : "Show file tree"}
              >
                {fileTreeVisible ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeft className="w-4 h-4" />
                )}
              </button>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <Hammer className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium">Builder</span>
              {/* Project indicator */}
              {currentProject && (
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Folder className="w-3 h-3" />
                  {currentProject.name}
                </span>
              )}
            </div>
          <div className="flex items-center gap-2">
            {/* Plan/Build toggle */}
            <div className="flex items-center h-7 rounded border border-zinc-700 overflow-hidden text-xs">
              <button
                onClick={() => builderMode !== "plan" && toggleMode()}
                className={cn("px-2 h-full", builderMode === "plan" ? "bg-amber-500/20 text-amber-400" : "text-zinc-400")}
              >
                Plan
              </button>
              <button
                onClick={() => builderMode !== "build" && toggleMode()}
                className={cn("px-2 h-full", builderMode === "build" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-400")}
              >
                Build
              </button>
            </div>
            {/* Local dropdown */}
            <select
              value={builderProvider === "ollama" && builderModel ? `ollama:${builderModel}` : ""}
              onChange={(e) => {
                if (e.target.value) {
                  const [, ...m] = e.target.value.split(":");
                  setBuilderProvider("ollama");
                  setBuilderModel(m.join(":"));
                }
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs max-w-[120px]"
            >
              <option value="">Local</option>
              {ollamaModels.map((m: LocalModel) => (
                <option key={`ollama:${m.id}`} value={`ollama:${m.id}`}>{getOllamaFriendlyName(m.id)}</option>
              ))}
            </select>
            {/* Cloud dropdown */}
            <select
              value={builderProvider !== "ollama" && builderModel ? `${builderProvider}:${builderModel}` : ""}
              onChange={(e) => {
                if (e.target.value) {
                  const [p, ...m] = e.target.value.split(":");
                  setBuilderProvider(p);
                  setBuilderModel(m.join(":"));
                }
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs max-w-[120px]"
            >
              <option value="">Cloud</option>
              {providers.filter((p) => p.id !== "ollama").map((provider) => {
                const active = cloudModels.filter((m: { provider?: string }) => m.provider === provider.id);
                if (!active.length) return null;
                return (
                  <optgroup key={provider.id} label={provider.name}>
                    {active.map((m: { id: string; name: string }) => (
                      <option key={`${provider.id}:${m.id}`} value={`${provider.id}:${m.id}`}>{m.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <Button variant="ghost" size="sm" onClick={() => setShowAddAgent(true)} className="text-zinc-400 hover:text-emerald-400 h-7 w-7 p-0">
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Agents bar */}
        {agents.length > 0 && (
          <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Agents:</span>
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-0.5">
                <span className="text-emerald-400">{agent.role}</span>
                <button onClick={() => removeAgent(agent.id)} className="text-zinc-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Context banner */}
        {architectPlan && (
          <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 text-xs text-zinc-400">
            <span className="text-emerald-500">Plan loaded:</span> {architectPlan.slice(0, 80)}...
          </div>
        )}

        {/* Builder Messages - overflow hidden to prevent horizontal scroll, word-wrap enabled */}
        <div ref={builderScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3" style={{ wordBreak: 'break-word' }}>
          {builderMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Hammer className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Build and iterate here</p>
              {!builderModel && <p className="text-xs text-emerald-500 mt-2">Select a model above</p>}
            </div>
          ) : (
            builderMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                color="emerald"
                onOpenCode={() => {
                  // Focus on code tab in artifact panel (if using BuilderPage) or scroll to code
                  console.log("[Builder] Open code clicked");
                }}
                onPreview={() => {
                  // Focus on preview tab
                  console.log("[Builder] Preview clicked");
                }}
              />
            ))
          )}
        </div>

        {/* Builder Input */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900">
          {/* Auto-Router Status Pill */}
          {autoRouterEnabled && routingAnalysis && !builderSending && (
            <div className={cn(
              "mb-2 px-2 py-1.5 rounded-lg text-xs flex items-center justify-between",
              routingAnalysis.tier === 1 && "bg-zinc-700/50 border border-zinc-600",
              routingAnalysis.tier === 2 && "bg-blue-500/10 border border-blue-500/30",
              routingAnalysis.tier === 3 && "bg-purple-500/10 border border-purple-500/30"
            )}>
              <div className="flex items-center gap-2">
                <Router className="w-3 h-3 text-zinc-400" />
                <span className={cn(
                  "font-medium",
                  routingAnalysis.tier === 1 && "text-zinc-300",
                  routingAnalysis.tier === 2 && "text-blue-400",
                  routingAnalysis.tier === 3 && "text-purple-400"
                )}>
                  Tier {routingAnalysis.tier}
                </span>
                <span className="text-zinc-500">→</span>
                <span className="text-zinc-300">
                  {getModelDisplayName(routingAnalysis.suggestedProvider, routingAnalysis.suggestedModel)}
                </span>
                <span className="text-zinc-500">
                  ({getTaskTypeDisplayName(routingAnalysis.taskType)})
                </span>
                {airGapMode && routingAnalysis.tier > 1 && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    Air-gap
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Cost/Quality Toggle */}
                <button
                  onClick={toggleModelPreference}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                    modelPreference === 'cost'
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-purple-500/20 text-purple-400"
                  )}
                  title={modelPreference === 'cost' ? "Prefer cost-effective models" : "Prefer quality models"}
                >
                  {modelPreference === 'cost' ? (
                    <span className="flex items-center gap-0.5"><DollarSign className="w-2.5 h-2.5" />Cost</span>
                  ) : (
                    <span className="flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />Quality</span>
                  )}
                </button>
                {/* Override button */}
                <button
                  onClick={() => setManualOverride(true)}
                  className="px-1.5 py-0.5 rounded text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                  title="Override auto-router for this message"
                >
                  Override
                </button>
              </div>
            </div>
          )}

          {/* Manual Override Banner */}
          {manualOverride && (
            <div className="mb-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" />
                Manual override: using {builderModel ? getModelDisplayName(builderProvider, builderModel) : 'selected model'}
              </div>
              <button
                onClick={() => setManualOverride(false)}
                className="text-amber-500 hover:text-amber-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* No model warning - only show when auto-router is off and no model selected */}
          {!autoRouterEnabled && !builderModel && (
            <div className="mb-2 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
              <Hammer className="w-3 h-3" />
              Select a model above to start building
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              ref={builderInputRef}
              value={builderInput}
              onChange={(e) => {
                setBuilderInput(e.target.value);
                // Analyze task as user types (debounced in effect below)
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleBuilderSend(); }}}
              placeholder={
                autoRouterEnabled
                  ? "Describe what to build... (auto-router will select the best model)"
                  : builderModel
                    ? (builderMode === "plan" ? "Discuss the approach..." : "Describe what to build...")
                    : "Select a model above..."
              }
              disabled={(!autoRouterEnabled && !builderModel) || builderSending}
              rows={2}
              className={cn(
                "flex-1 resize-none rounded-lg border px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none whitespace-pre-wrap break-words",
                !autoRouterEnabled && !builderModel
                  ? "border-emerald-500/30 bg-zinc-800/50 cursor-not-allowed opacity-60"
                  : "border-zinc-700 bg-zinc-800 focus:border-emerald-500",
                builderSending && "opacity-50"
              )}
            />
            {builderSending ? (
              <Button onClick={() => builderAbort?.abort()} size="sm" className="bg-red-600 hover:bg-red-700 self-end">
                <StopCircle className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleBuilderSend}
                disabled={(!autoRouterEnabled && !builderModel) || !builderInput.trim()}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 self-end disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Add Agent Modal */}
      {showAddAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-4 w-72">
            <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
              <UserPlus className="w-4 h-4" /> Add Agent
            </h3>
            <select id="agent-select" className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm mb-3" defaultValue="">
              <option value="">Select model...</option>
              <optgroup label="Local">
                {ollamaModels.map((m: LocalModel) => (
                  <option key={`ollama:${m.id}`} value={`ollama:${m.id}`}>{getOllamaFriendlyName(m.id)}</option>
                ))}
              </optgroup>
              {providers.filter((p) => p.id !== "ollama").map((provider) => {
                const active = cloudModels.filter((m: { provider?: string }) => m.provider === provider.id);
                if (!active.length) return null;
                return (
                  <optgroup key={provider.id} label={provider.name}>
                    {active.map((m: { id: string; name: string }) => (
                      <option key={`${provider.id}:${m.id}`} value={`${provider.id}:${m.id}`}>{m.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAddAgent(false)} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={() => {
                const sel = document.getElementById("agent-select") as HTMLSelectElement;
                if (sel.value) {
                  const [p, ...m] = sel.value.split(":");
                  handleAddAgent(m.join(":"), p);
                }
              }} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Add</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Artifact Card Component ─────────────────────────────────────────────────

interface ArtifactCardProps {
  language: string;
  title: string;
  summary: string;
  isNew?: boolean;
  onOpenCode?: () => void;
  onPreview?: () => void;
}

function ArtifactCard({ language, title, summary, isNew = true, onOpenCode, onPreview }: ArtifactCardProps) {
  const langBadgeColor = {
    html: "bg-orange-500",
    css: "bg-blue-500",
    javascript: "bg-yellow-500",
    js: "bg-yellow-500",
    typescript: "bg-blue-600",
    ts: "bg-blue-600",
    jsx: "bg-cyan-500",
    tsx: "bg-cyan-500",
    react: "bg-cyan-500",
  }[language.toLowerCase()] || "bg-zinc-500";

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 max-w-[280px]">
      <div className="flex items-center gap-2 mb-2">
        {isNew ? (
          <Sparkle className="w-4 h-4 text-emerald-400" />
        ) : (
          <FileCode className="w-4 h-4 text-blue-400" />
        )}
        <span className="text-sm font-medium text-zinc-200 truncate flex-1">{title}</span>
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium text-white uppercase", langBadgeColor)}>
          {language}
        </span>
      </div>
      {summary && (
        <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{summary}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onOpenCode}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300 transition-colors"
        >
          <Code2 className="w-3 h-3" />
          Open Code
        </button>
        <button
          onClick={onPreview}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs text-white transition-colors"
        >
          <Eye className="w-3 h-3" />
          Preview
        </button>
      </div>
    </div>
  );
}

// ─── Parse content for artifact cards ────────────────────────────────────────

interface ParsedContent {
  textParts: string[];
  artifacts: {
    language: string;
    code: string;
    title: string;
    summary: string;
  }[];
}

function parseContentForArtifacts(content: string): ParsedContent {
  const textParts: string[] = [];
  const artifacts: ParsedContent["artifacts"] = [];

  // Split by code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Text before this code block
    const textBefore = content.slice(lastIndex, match.index).trim();
    if (textBefore) {
      textParts.push(textBefore);
    }

    const language = match[1] || "text";
    const code = match[2].trim();

    // Auto-generate title from code content
    let title = "Generated Code";
    if (language === "html" || language === "htm") {
      const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        const h1Match = code.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) title = h1Match[1].trim();
      }
    }

    // Get summary from text before (first sentence or two)
    let summary = "";
    if (textBefore) {
      const sentences = textBefore.split(/[.!?]/).filter(s => s.trim());
      summary = sentences.slice(0, 2).join(". ").trim();
      if (summary && !summary.endsWith(".")) summary += ".";
      if (summary.length > 100) summary = summary.slice(0, 100) + "...";
    }

    artifacts.push({ language, code, title, summary });
    lastIndex = match.index + match[0].length;
  }

  // Text after last code block
  const textAfter = content.slice(lastIndex).trim();
  if (textAfter) {
    textParts.push(textAfter);
  }

  return { textParts, artifacts };
}

// ─── Message bubble component ────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  color: "amber" | "emerald";
  onOpenCode?: () => void;
  onPreview?: () => void;
}

function MessageBubble({ message, color, onOpenCode, onPreview }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    // Copy only the text, not code blocks
    const parsed = parseContentForArtifacts(message.content);
    navigator.clipboard.writeText(parsed.textParts.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tokensPerSec = message.tokenCount && message.latencyMs && message.latencyMs > 0
    ? (message.tokenCount / (message.latencyMs / 1000)).toFixed(1) : null;

  const bgColor = isUser
    ? color === "amber" ? "bg-amber-600" : "bg-emerald-600"
    : "bg-zinc-800";

  // For user messages, render normally
  if (isUser) {
    return (
      <div className="flex flex-col gap-1 items-end">
        <div className={cn("rounded-lg px-3 py-2 max-w-[90%] text-sm break-words", bgColor)}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // For assistant messages, parse and show artifact cards instead of code blocks
  const parsed = parseContentForArtifacts(message.content || "");
  const hasArtifacts = parsed.artifacts.length > 0;

  return (
    <div className="flex flex-col gap-2 items-start max-w-full">
      {/* Text content (without code blocks) */}
      {parsed.textParts.length > 0 && (
        <div className={cn("rounded-lg px-3 py-2 max-w-[90%] text-sm break-words", bgColor)}>
          <div className="prose prose-sm prose-invert max-w-none [&_pre]:hidden [&_code]:break-all [&_*]:break-words">
            <ReactMarkdown
              components={{
                // Override code blocks to not render them
                pre: () => null,
                code: ({ children, className }) => {
                  // Only render inline code, not code blocks
                  if (className?.includes("language-")) return null;
                  return <code className="bg-zinc-700 px-1 rounded text-xs break-all">{children}</code>;
                },
              }}
            >
              {parsed.textParts.join("\n\n")}
            </ReactMarkdown>
          </div>
          {message.isStreaming && (
            <span className={`inline-block w-1.5 h-3 animate-pulse ml-0.5 ${color === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} />
          )}
        </div>
      )}

      {/* Show streaming indicator if no content yet */}
      {!message.content && message.isStreaming && (
        <div className={cn("rounded-lg px-3 py-2 text-sm", bgColor)}>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${color === "amber" ? "bg-amber-400" : "bg-emerald-400"}`} />
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${color === "amber" ? "bg-amber-400" : "bg-emerald-400"}`} style={{ animationDelay: "150ms" }} />
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${color === "amber" ? "bg-amber-400" : "bg-emerald-400"}`} style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      {/* Artifact cards for code blocks */}
      {hasArtifacts && parsed.artifacts.map((artifact, index) => (
        <ArtifactCard
          key={index}
          language={artifact.language}
          title={artifact.title}
          summary={artifact.summary}
          onOpenCode={onOpenCode}
          onPreview={onPreview}
        />
      ))}

      {/* Metrics */}
      {!message.isStreaming && message.content && (
        <div className="flex items-center gap-2 px-1 text-[10px] text-zinc-500">
          {message.tokenCount && <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{message.tokenCount}</span>}
          {tokensPerSec && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{tokensPerSec}/s</span>}
          <button onClick={handleCopy} className="flex items-center gap-0.5 hover:text-zinc-300">
            {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
