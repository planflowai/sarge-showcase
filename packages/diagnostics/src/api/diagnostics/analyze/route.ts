import { NextRequest, NextResponse } from "next/server";
import { readFileContent } from "../../../lib/scanner";
import type { Finding } from "../../../stores/diagnosticsStore";
import type { Provider } from "@sarge/core";
import * as path from "path";

// Provider imports
import { chat as anthropicChat } from "@sarge/core/providers/anthropic";
import { chat as openaiChat } from "@sarge/core/providers/openai";
import { chat as googleChat } from "@sarge/core/providers/google";
import { chat as xaiChat } from "@sarge/core/providers/xai";
import { chat as ollamaChat } from "@sarge/core/providers/ollama";
import { chat as deepseekChat } from "@sarge/core/providers/deepseek";

const PROJECT_ROOT = process.cwd();
const CONTEXT_FILE = path.join(PROJECT_ROOT, "PROJECT_CONTEXT.md");

// Load project context for AI analysis
function loadProjectContext(): string {
  try {
    const content = readFileContent(CONTEXT_FILE);
    return content || "";
  } catch {
    return "";
  }
}

function getApiKey(provider: Provider): string {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? "";
    case "openai":
      return process.env.OPENAI_API_KEY ?? "";
    case "google":
      return process.env.GOOGLE_API_KEY ?? "";
    case "xai":
      return process.env.XAI_API_KEY ?? "";
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY ?? "";
    default:
      return "";
  }
}

const CLOUD_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

function isConnectionError(err: any): boolean {
  const msg = (err?.message || err?.cause?.message || '').toLowerCase();
  return (
    err?.code === 'ECONNREFUSED' ||
    err?.cause?.code === 'ECONNREFUSED' ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('connect refused') ||
    msg.includes('failed to connect')
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { finding, provider, model, airGapMode = false } = body as {
      finding: Finding;
      provider: Provider;
      model: string;
      airGapMode?: boolean;
    };

    // Validate provider and model are provided
    if (!provider || (provider as string) === "undefined") {
      return NextResponse.json(
        { error: "No model selected for analysis. Please select a provider and model in the Diagnostics sidebar." },
        { status: 400 }
      );
    }

    if (!model || model === "undefined") {
      return NextResponse.json(
        { error: "No model selected for analysis. Please select a model in the Diagnostics sidebar." },
        { status: 400 }
      );
    }

    console.log(`[api/diagnostics/analyze] Request received: ${provider}/${model} for ${finding.file}:${finding.line}`);
    console.log(`[api/diagnostics/analyze] PROJECT_ROOT: ${PROJECT_ROOT}`);

    // Read full file content for context
    const fullPath = path.join(PROJECT_ROOT, finding.file);
    console.log(`[api/diagnostics/analyze] Full path: ${fullPath}`);

    let fileContent = readFileContent(fullPath);

    if (!fileContent) {
      console.error(`[api/diagnostics/analyze] Could not read file: ${fullPath}`);
      // Try alternative paths
      const altPaths = [
        finding.file, // Maybe it's already correct
        path.resolve(PROJECT_ROOT, finding.file),
        path.join(PROJECT_ROOT, finding.file.replace(/\//g, path.sep)),
      ];

      for (const altPath of altPaths) {
        console.log(`[api/diagnostics/analyze] Trying: ${altPath}`);
        fileContent = readFileContent(altPath);
        if (fileContent) {
          console.log(`[api/diagnostics/analyze] Found at: ${altPath}`);
          break;
        }
      }

      if (!fileContent) {
        return NextResponse.json(
          { error: `Could not read file: ${fullPath}` },
          { status: 400 }
        );
      }
    }

    // Extract relevant code context (surrounding lines)
    const lines = fileContent.split("\n");
    const startLine = Math.max(0, finding.line - 10);
    const endLine = Math.min(lines.length, finding.line + 10);
    const codeContext = lines.slice(startLine, endLine).join("\n");

    // Load project context (truncate for smaller models)
    let projectContext = loadProjectContext();
    if (projectContext.length > 2000) {
      // For smaller models, only include the "Intentional Patterns" section
      const intentionalStart = projectContext.indexOf("## Intentional Patterns");
      const architectureStart = projectContext.indexOf("## Architecture");
      if (intentionalStart !== -1 && architectureStart !== -1) {
        projectContext = projectContext.substring(intentionalStart, architectureStart);
      } else if (projectContext.length > 3000) {
        projectContext = projectContext.substring(0, 3000) + "\n...(truncated)";
      }
    }

    // Build analysis prompt
    const systemPrompt = `You are analyzing code for SARGE (an AI workbench).

${projectContext ? `KNOWN INTENTIONAL PATTERNS:\n${projectContext}\n` : ""}

Rules:
1. If pattern is listed as intentional above, say "This is intentional" and explain why
2. If it's a real bug, explain and suggest a fix
3. Keep response under 150 words`;

    const userPrompt = `Analyze this code issue:

**File:** ${finding.file}
**Line:** ${finding.line}
**Issue Type:** ${finding.type}
**Severity:** ${finding.severity}
**Message:** ${finding.message}

**Code Context (lines ${startLine + 1}-${endLine}):**
\`\`\`typescript
${codeContext}
\`\`\`

**The specific issue is on line ${finding.line}:**
\`\`\`
${finding.code}
\`\`\`

Provide:
1. A brief explanation of the issue
2. The suggested fix (show the corrected code)`;

    // Call the AI provider
    const messages = [
      { id: "1", conversationId: "analyze", role: "user" as const, content: userPrompt, provider, model, timestamp: new Date() },
    ];

    const apiKey = getApiKey(provider);
    let response;
    let usedCloudFallback = false;
    let fallbackModel = model;
    let fallbackProvider: Provider = provider;

    switch (provider) {
      case "anthropic":
        response = await anthropicChat(messages, model, apiKey, { systemPrompt });
        break;
      case "openai":
        response = await openaiChat(messages, model, apiKey);
        break;
      case "google":
        response = await googleChat(messages, model, apiKey);
        break;
      case "xai":
        response = await xaiChat(messages, model, apiKey);
        break;
      case "ollama": {
        try {
          response = await ollamaChat(messages, model);
        } catch (ollamaErr: any) {
          if (isConnectionError(ollamaErr)) {
            if (airGapMode) {
              return NextResponse.json(
                { error: "Ollama connection failed. Cloud fallback is blocked in air-gap mode." },
                { status: 503 }
              );
            }
            // Retry with Anthropic Haiku as cloud fallback
            const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
            if (!anthropicKey) {
              return NextResponse.json(
                { error: "Ollama is not running and no ANTHROPIC_API_KEY is set for cloud fallback." },
                { status: 503 }
              );
            }
            console.log('[api/diagnostics/analyze] Ollama unreachable, falling back to Anthropic Haiku');
            const fallbackMessages = messages.map(m => ({ ...m, provider: 'anthropic' as Provider, model: CLOUD_FALLBACK_MODEL }));
            response = await anthropicChat(fallbackMessages, CLOUD_FALLBACK_MODEL, anthropicKey, { systemPrompt });
            usedCloudFallback = true;
            fallbackModel = CLOUD_FALLBACK_MODEL;
            fallbackProvider = 'anthropic';
          } else {
            throw ollamaErr;
          }
        }
        break;
      }
      case "deepseek":
        response = await deepseekChat(messages, model, apiKey);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported provider: ${provider}. Supported providers: anthropic, openai, google, xai, ollama, deepseek` },
          { status: 400 }
        );
    }

    // Parse the response to extract explanation and suggested fix
    const content = response.content;

    console.log("[api/diagnostics/analyze] Raw AI response:", content?.substring(0, 500));

    if (!content) {
      return NextResponse.json(
        { error: "AI returned empty response" },
        { status: 500 }
      );
    }

    // Try to extract code block as suggested fix
    const codeBlockMatch = content.match(/```(?:typescript|javascript|tsx|jsx)?\n([\s\S]*?)```/);
    const suggestedFix = codeBlockMatch ? codeBlockMatch[1].trim() : undefined;

    // Everything before the code block is the explanation
    const explanation = codeBlockMatch
      ? content.substring(0, content.indexOf("```")).trim()
      : content;

    console.log("[api/diagnostics/analyze] Parsed explanation:", explanation?.substring(0, 200));

    return NextResponse.json({
      success: true,
      explanation,
      suggestedFix,
      model: fallbackModel,
      provider: fallbackProvider,
      cloudFallback: usedCloudFallback,
    });
  } catch (error) {
    console.error("[api/diagnostics/analyze] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
