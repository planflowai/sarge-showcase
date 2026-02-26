/**
 * Context Injection for Builder Chat
 *
 * THREE MODES:
 * 1. ARTIFACT MODE (no project open) - Build standalone HTML/React in the artifact panel
 * 2. PROJECT MODE (project open) - Edit real project files with Apply/Reject flow
 * 3. MIXED MODE - Project open but working on artifact (user can choose)
 */

export interface ContextInjectorParams {
  userMessage: string;
  activeFileContent: string;  // Current artifact code OR current file content
  activeFilePath?: string;
  projectPath?: string | null;  // If set, we're in PROJECT MODE
  projectName?: string | null;
  projectFileTree?: string[];
  builderLogContent?: string | null;  // Content of BUILDER_LOG.md for project history
  provider: string;
  attachCode: boolean;  // Only relevant for additional file context on cloud providers
}

// System prompt addition for PROJECT MODE
const PROJECT_MODE_INSTRUCTIONS = `
=== PROJECT MODE ===
The user has a project open. When they ask you to edit or create a file:

RESPOND WITH FILE EDITS in this EXACT format:
FILE: path/to/file.ext
\`\`\`
<complete updated file content here>
\`\`\`

RULES:
1. Use the FILE: prefix followed by the relative path from the project root
2. Output the COMPLETE file content, not just changed parts
3. Only modify files the user explicitly asks about
4. Keep explanations brief - one sentence about what you changed
5. MINIMAL CHANGES: Only change what was requested, preserve everything else
6. IMAGES: If the project has image files (listed in AVAILABLE IMAGE ASSETS), USE THEM in your HTML with <img src="path/to/image.ext">. Use the exact paths provided. Do NOT use placeholder images or external URLs when real project images are available.
`;

/**
 * Build the prompt with context injection
 *
 * CRITICAL: Artifact code is ALWAYS included so the AI knows what it's modifying.
 * PROJECT MODE: When a project is open, include file tree and special instructions.
 */
export function buildPromptWithContext(params: ContextInjectorParams): string {
  const {
    userMessage,
    activeFileContent,
    activeFilePath,
    projectPath,
    projectName,
    projectFileTree,
    builderLogContent,
    provider,
    attachCode,
  } = params;

  const isLocal = provider === "ollama";
  const hasArtifactCode = activeFileContent && activeFileContent.trim().length > 0;
  const isProjectMode = !!projectPath;

  const parts: string[] = [];

  // PROJECT MODE: Add special instructions and file tree
  if (isProjectMode) {
    parts.push(PROJECT_MODE_INSTRUCTIONS);
    parts.push("");
    parts.push(`PROJECT: ${projectName || projectPath}`);

    // Always include file tree in project mode
    if (projectFileTree && projectFileTree.length > 0) {
      parts.push("");
      parts.push("=== PROJECT FILE TREE ===");
      parts.push(projectFileTree.join("\n"));

      // Extract image/asset files and list them explicitly so the AI can't miss them
      const imageExtensions = /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp|avif)$/i;
      const imageFiles = projectFileTree
        .map(line => line.trim())
        .filter(line => !line.startsWith('📁') && imageExtensions.test(line));

      if (imageFiles.length > 0) {
        parts.push("");
        parts.push("=== AVAILABLE IMAGE ASSETS (use these in your HTML) ===");
        parts.push("You MUST use these images when the user asks for images, logos, or photos.");
        parts.push("Reference them with relative paths from the HTML file location:");
        for (const img of imageFiles) {
          // img is like "assets/logo.png" or "build/assets/worker.jpg"
          parts.push(`  <img src="${img}" alt="${img.split('/').pop()?.replace(/\.[^.]+$/, '') || 'image'}">`);
        }
        parts.push("These files EXIST on disk. Use the exact paths shown above.");
      }
    }

    // Include BUILDER_LOG.md content for project history context
    if (builderLogContent && builderLogContent.trim()) {
      parts.push("");
      parts.push("=== PROJECT HISTORY (BUILDER_LOG.md) ===");
      // Limit log content to last 2000 chars to avoid context overflow
      const maxLogLength = 2000;
      if (builderLogContent.length > maxLogLength) {
        const sliced = builderLogContent.slice(-maxLogLength);
        // Trim to the first newline so we don't start mid-line
        const firstNewline = sliced.indexOf('\n');
        const trimmed = firstNewline > -1 ? sliced.slice(firstNewline + 1) : sliced;
        parts.push("...(truncated, showing recent entries)...");
        parts.push(trimmed);
      } else {
        parts.push(builderLogContent);
      }
    }
    parts.push("");
  }

  // Add current file/artifact context if present
  if (hasArtifactCode) {
    if (isProjectMode && activeFilePath && activeFilePath !== "artifact") {
      // In project mode with a real file open
      parts.push(`=== CURRENT FILE: ${activeFilePath} ===`);
    } else {
      // Artifact mode
      parts.push("=== CURRENT CODE (modify this) ===");
    }
    parts.push("```");
    parts.push(activeFileContent);
    parts.push("```");
    parts.push("");
  }

  // Add the user's request
  parts.push("=== USER REQUEST ===");
  parts.push(userMessage);

  return parts.join("\n");
}

/**
 * Check if context should be auto-injected for this provider
 * (For the Attach button display - file context, not artifact context)
 */
export function shouldAutoInjectContext(provider: string): boolean {
  return provider === "ollama";
}

/**
 * Get display text for context status
 * Note: This is for FILE context, not artifact context.
 * Artifact context is always included automatically.
 */
export function getContextStatusText(provider: string, attachCode: boolean): {
  text: string;
  isActive: boolean;
  isAutomatic: boolean;
} {
  const isLocal = provider === "ollama";

  if (isLocal) {
    return {
      text: "Context auto-attached",
      isActive: true,
      isAutomatic: true,
    };
  }

  return {
    text: attachCode ? "Context attached" : "Attach context",
    isActive: attachCode,
    isAutomatic: false,
  };
}

/**
 * Parse file edit proposals from AI response
 * Returns array of file edits found in the response
 */
export interface FileEditProposal {
  filePath: string;
  content: string;
  language: string;
}

export function parseFileEditProposals(response: string): FileEditProposal[] {
  const proposals: FileEditProposal[] = [];

  // Match pattern: FILE: path/to/file.ext followed by code block
  const fileEditRegex = /FILE:\s*([^\n]+)\n```(?:\w+)?\n([\s\S]*?)```/g;

  let match;
  while ((match = fileEditRegex.exec(response)) !== null) {
    const filePath = match[1].trim();
    const content = match[2];

    // Detect language from file extension
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
    };

    proposals.push({
      filePath,
      content,
      language: languageMap[ext] || 'plaintext',
    });
  }

  return proposals;
}

/**
 * Check if a response contains file edit proposals
 */
export function hasFileEditProposals(response: string): boolean {
  return /FILE:\s*[^\n]+\n```/.test(response);
}

/**
 * Flatten file tree to array of paths for context injection
 */
export function flattenFileTree(nodes: any[], prefix: string = ''): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;

    if (node.type === 'directory') {
      paths.push(`📁 ${path}/`);
      if (node.children) {
        paths.push(...flattenFileTree(node.children, path));
      }
    } else {
      paths.push(`  ${path}`);
    }
  }

  return paths;
}

/**
 * Get relevant documentation sections based on current mode
 * Returns only the docs needed for the current context (selective injection)
 * Max 3000 tokens per injection
 */
export function getRelevantDocs(mode: 'chat' | 'builder' | 'debate' | 'test' | 'diagnostics' | 'settings'): string {
  const docSections: Record<string, string[]> = {
    chat: [
      '## Chat Module AI Logic',
      '- Trigger: User submits message on `/` (chat page)',
      '- Flow: Router checks mode, provider fallback chain, streaming via SSE/SDK',
      '- Models: User-selected from modelStore, fallback to llama3.2:3b',
      '- System Prompt: "You are a helpful AI assistant with access to [VAULT_DOCS] [THREAD_GUARDIAN_CONTEXT]"',
      '- Output: Streaming markdown-formatted response, auto-stored in messageStore',
      '',
      '## Prompt Routing Priority',
      '1. User-selected model → 2. Provider chain (Anthropic > OpenAI > Google > Ollama) → 3. Air-gap override → 4. llama3.2:3b fallback'
    ],
    builder: [
      '## Builder Module AI Logic',
      '- Trigger: User opens /builder and submits code generation request',
      '- Flow: Message → buildPromptWithContext() → /api/chat → stream to ArtifactCard → live preview',
      '- Models: Builder-tagged (all cloud + qwen2.5-coder, deepseek-coder, codellama, starcoder)',
      '- System Prompt: "You are a code builder. Generate SINGLE self-contained files. HTML must include ALL CSS/JS inline. Never reference external files. Output COMPLETE file on updates."',
      '- Output: Single code block, artifact card (zero code in chat), stored in artifactStore (max 10 versions)',
      '',
      '## Context in Builder Chat',
      '- BUILDER_LOG.md prepended (project history)',
      '- Vault docs injected invisibly',
      '- Thread Guardian context added (facts, contradictions)',
      '- File tree and current file included if project open'
    ],
    debate: [
      '## Debate Arena AI Logic',
      '- Trigger: User opens Debate setup or "Open Debate" button',
      '- Flow: Each round → D1/D2/D3 send messages → Judge reads all, issues verdict via jury-guardian',
      '- Models: User-selected (D1/D2/D3), Judge defaults to claude-opus-4-6',
      '- Prompts: D1 (argue position), D2 (counter), D3 (synthesize), Judge (confidence % verdict)',
      '- Output: Transcript, Judge verdict with confidence score, saved to debateHistoryStore'
    ],
    test: [
      '## Test Mode (Tribunal) AI Logic',
      '- Three passes: Baseline (no poison) → Poisoned (inject pill) → Protected (add defensive prompt)',
      '- Verdicts: CAUGHT (defended), ECHO (poisoned), MISS (missed it)',
      '- Models: D1/D2/D3 per slot, Judge defaults to claude-opus-4-6',
      '- Batch mode: Repeat N times, aggregate stats (% CAUGHT, ECHO, MISS)',
      '- Output: Three-pass result + Judge verdicts, stored in testModeStore (trim at 50 entries)'
    ],
    diagnostics: [
      '## Diagnostics Module',
      '- Routes: /api/diagnostics/scan (find issues), analyze, fix (propose), rollback (restore from snapshot)',
      '- Scan types: error, warning, enhancement, security',
      '- Output: Findings with file/line/severity/message, AI analysis, fix suggestions, snapshots (max 50)'
    ],
    settings: [
      '## Settings Architecture',
      '- 14 sections, lazy-loaded via next/dynamic',
      '- Key sections: Models, AI Orchestration, Knowledge, Thread Guardian, Logic Editor',
      '- Stores: modelStore, aiModeStore, knowledgeStore, threadGuardianStore, testModeStore',
      '- Each sub-component owns its own store state'
    ]
  };

  const sections = docSections[mode] || [];
  return sections.join('\n');
}

/**
 * Build system prompt with selective doc injection
 * Returns the full system prompt with docs truncated to 3000 tokens
 */
export function buildSystemPromptWithDocs(
  baseSystemPrompt: string,
  mode: 'chat' | 'builder' | 'debate' | 'test' | 'diagnostics' | 'settings' | 'none',
  enableDocInjection: boolean
): string {
  if (!enableDocInjection || mode === 'none') {
    return baseSystemPrompt;
  }

  const relevantDocs = getRelevantDocs(mode as any);

  if (!relevantDocs) {
    return baseSystemPrompt;
  }

  // Rough token estimate (4 chars ≈ 1 token)
  const maxTokens = 3000;
  const maxChars = maxTokens * 4;

  let injectedDocs = relevantDocs;
  if (relevantDocs.length > maxChars) {
    // Truncate at last newline to avoid mid-line cutoff
    injectedDocs = relevantDocs.slice(0, maxChars);
    const lastNewline = injectedDocs.lastIndexOf('\n');
    if (lastNewline > 0) {
      injectedDocs = injectedDocs.slice(0, lastNewline);
    }
    injectedDocs += '\n...(documentation truncated)';
  }

  return `[BUILD DOCUMENTATION - Auto-Injected]\n${injectedDocs}\n\n---\n\n${baseSystemPrompt}`;
}
