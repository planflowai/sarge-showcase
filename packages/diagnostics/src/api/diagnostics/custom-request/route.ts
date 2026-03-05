import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// Project root - use current working directory
const PROJECT_ROOT = process.cwd();

// Common file mappings for user-friendly requests
const FILE_MAPPINGS: Record<string, string> = {
  "header": "components/layout/Header.tsx",
  "navigation": "components/layout/Header.tsx",
  "nav": "components/layout/Header.tsx",
  "navbar": "components/layout/Header.tsx",
  "sidebar": "components/layout/Sidebar.tsx",
  "chat": "app/page.tsx",
  "home": "app/page.tsx",
  "settings": "app/settings/page.tsx",
  "debate": "app/debate/page.tsx",
  "journal": "app/journal/page.tsx",
  "library": "app/library/page.tsx",
  "diagnostics": "app/diagnostics/page.tsx",
};

// Read file content
function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// Guess target file from request text
function guessTargetFile(request: string): string | null {
  const lower = request.toLowerCase();
  for (const [keyword, file] of Object.entries(FILE_MAPPINGS)) {
    if (lower.includes(keyword)) {
      return file;
    }
  }
  return null;
}

// Build prompt for AI - focused and clear for small models
function buildPrompt(request: string, targetFile: string, fileContent: string): string {
  // Add line numbers to help AI reference specific lines
  const numberedContent = fileContent
    .split("\n")
    .map((line, i) => `${i + 1}: ${line}`)
    .join("\n");

  return `You are a code editor. Modify this file based on the user's request.

FILE: ${targetFile}

USER REQUEST: ${request}

CURRENT CODE (with line numbers):
\`\`\`tsx
${numberedContent}
\`\`\`

RESPOND WITH ONLY THIS JSON FORMAT - NO OTHER TEXT:
{
  "explanation": "What you changed and why",
  "line": <starting line number of the change>,
  "originalCode": "<exact original code to replace - copy exactly from above>",
  "suggestedFix": "<new code to replace it with>"
}

RULES:
1. originalCode MUST be copied EXACTLY from the file (without line numbers)
2. Keep changes minimal - only change what's needed
3. Preserve indentation and formatting
4. Return ONLY the JSON, nothing else`;
}

// Call AI provider
async function callAI(prompt: string, provider: string, model: string): Promise<string> {
  console.log(`[custom-request] Calling ${provider}/${model}`);

  switch (provider) {
    case "anthropic": {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text || "";
    }

    case "openai": {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || "";
    }

    case "google": {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY || ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    case "xai": {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.XAI_API_KEY || ""}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || "";
    }

    case "ollama": {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temp for more predictable JSON
            num_predict: 2048,
          },
        }),
      });
      const data = await response.json();
      return data.response || "";
    }

    case "deepseek": {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ""}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || "";
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Extract JSON from AI response
function extractJSON(text: string): any {
  console.log("[custom-request] Raw AI response:", text.substring(0, 500));

  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*?\}(?=\s*$|\s*\n|$)/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log("[custom-request] JSON parse failed, trying cleanup");
      // Try to clean up common issues
      let cleaned = jsonMatch[0]
        .replace(/[\x00-\x1F\x7F]/g, " ") // Remove control characters
        .replace(/,\s*}/g, "}") // Remove trailing commas
        .replace(/,\s*]/g, "]")
        .replace(/\n/g, "\\n") // Escape newlines in strings
        .replace(/\t/g, "\\t"); // Escape tabs

      try {
        return JSON.parse(cleaned);
      } catch {
        // Try finding JSON more aggressively
        const lastBrace = text.lastIndexOf("}");
        const firstBrace = text.indexOf("{");
        if (firstBrace !== -1 && lastBrace !== -1) {
          const jsonStr = text.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonStr);
        }
      }
    }
  }
  throw new Error("Could not parse AI response as JSON. Response: " + text.substring(0, 200));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { request, targetFile, provider, model } = body;

    if (!request) {
      return NextResponse.json(
        { error: "Request is required" },
        { status: 400 }
      );
    }

    // Determine target file
    let resolvedFile = targetFile;
    if (!resolvedFile) {
      resolvedFile = guessTargetFile(request);
    }

    if (!resolvedFile) {
      return NextResponse.json(
        { error: "Please specify a target file (e.g., components/layout/Header.tsx) or mention a component (header, sidebar, settings, etc.)" },
        { status: 400 }
      );
    }

    console.log("[custom-request] Processing:", { request, targetFile: resolvedFile, provider, model });

    // Read the target file
    const fullPath = path.join(PROJECT_ROOT, resolvedFile);
    const fileContent = readFileContent(fullPath);

    if (!fileContent) {
      return NextResponse.json(
        { error: `Could not read file: ${resolvedFile}` },
        { status: 400 }
      );
    }

    console.log("[custom-request] File loaded, length:", fileContent.length);

    // Build prompt with full file content
    const prompt = buildPrompt(request, resolvedFile, fileContent);

    console.log("[custom-request] Calling AI...");
    const aiResponse = await callAI(prompt, provider, model);

    console.log("[custom-request] AI response received, parsing...");
    const result = extractJSON(aiResponse);

    // Validate the result
    if (!result.suggestedFix) {
      throw new Error("AI response missing suggestedFix");
    }

    if (!result.originalCode) {
      throw new Error("AI response missing originalCode");
    }

    // Verify the original code exists in the file
    if (!fileContent.includes(result.originalCode.trim())) {
      console.log("[custom-request] Warning: originalCode not found exactly in file");
      // Try to find a close match
      const lines = fileContent.split("\n");
      const searchLine = result.originalCode.trim().split("\n")[0];
      const matchIndex = lines.findIndex(l => l.trim().includes(searchLine.trim()));
      if (matchIndex !== -1) {
        result.line = matchIndex + 1;
      }
    }

    console.log("[custom-request] Success:", {
      file: resolvedFile,
      line: result.line,
      explanation: result.explanation
    });

    return NextResponse.json({
      explanation: result.explanation || "Changes ready to apply",
      file: resolvedFile,
      line: result.line || 1,
      originalCode: result.originalCode,
      suggestedFix: result.suggestedFix,
    });
  } catch (error) {
    console.error("[custom-request] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}
