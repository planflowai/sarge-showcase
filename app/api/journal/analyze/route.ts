import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const ANALYSIS_PROMPT = `You are a research assistant analyzing a developer's project journal and AI test results.

CRITICAL: Keep your response concise. Maximum 12-15 lines total.

Your task:
1. Review today's journal entries
2. Analyze the batch test logs (catch rates, poison spread, recovery patterns)
3. Review current D1/D2/D3/Judge prompts
4. Provide actionable insights

Format your response EXACTLY as:

**Session Summary**: [1-2 sentences about overall activity]

**What Worked**: [Specific successes - e.g., "D2 caught 85% of poisons", "Judge correctly identified all echo patterns"]

**What Failed**: [Specific failures - e.g., "D2 challenged once but accepted silence in 3 cases", "D1 echoed poison in 40% of tests"]

**Root Causes**: [Why failures occurred - be specific about prompt weaknesses]

**Actionable Suggestions**: [2-3 specific changes with exact text to add/modify]

If you have a SPECIFIC prompt rewrite to suggest, format it as:

## Suggested Prompt Update: D2
\`\`\`
[Full new prompt text here - must be complete and ready to use]
\`\`\`

RULES:
- Stay under 15 lines total (excluding code blocks)
- Be specific - cite actual numbers from logs
- Suggestions must be actionable (exact text to add/change)
- Only suggest prompt rewrites if clearly needed
- If no batch logs available, focus on journal analysis and general suggestions`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, journalEntries, currentDraft, batchLogs, prompts, debateLogic } = body;

    // Format context for AI
    const context = formatAnalysisContext(
      journalEntries,
      currentDraft,
      batchLogs,
      prompts,
      debateLogic
    );

    console.log("[Journal Analyze] Model:", model);

    // Route to appropriate model based on sidebar selection
    if (model && model.startsWith("ollama:")) {
      // Specific Ollama model from sidebar
      const ollamaModel = model.replace("ollama:", "");
      return await callOllama(ollamaModel, context);
    } else if (model && (model.startsWith("claude") || model.includes("anthropic"))) {
      // Anthropic model
      return await callAnthropic(model, context);
    } else if (model && model.startsWith("gpt")) {
      // OpenAI model
      return await callOpenAI(model, context);
    } else {
      // Default: try Ollama first, fallback to Claude
      return await tryAutoMode(context);
    }
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 }
    );
  }
}

async function tryAutoMode(context: string) {
  try {
    const ollama = new Ollama({ host: "http://localhost:11434" });
    await ollama.list();

    const response = await ollama.chat({
      model: "qwen2.5:14b",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: context },
      ],
      options: {
        temperature: 0.3,
        num_predict: 1500,
        num_ctx: 8192,
      },
    });

    return NextResponse.json({
      analysis: response.message.content,
      provider: "ollama:qwen2.5:14b",
    });
  } catch (ollamaError: any) {
    console.warn("Ollama unavailable, falling back to Claude:", ollamaError.message);
    return await callAnthropic("claude-sonnet-4-20250514", context);
  }
}

async function callOllama(model: string, context: string) {
  try {
    const ollama = new Ollama({ host: "http://localhost:11434" });

    const response = await ollama.chat({
      model,
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: context },
      ],
      options: {
        temperature: 0.3,
        num_predict: 1500,
        num_ctx: 8192,
      },
    });

    return NextResponse.json({
      analysis: response.message.content,
      provider: `ollama:${model}`,
    });
  } catch (error: any) {
    console.error("Ollama error:", error);
    return NextResponse.json(
      { error: `Ollama error: ${error.message}. Make sure Ollama is running and the model is pulled.` },
      { status: 503 }
    );
  }
}

async function callAnthropic(model: string, context: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0.3,
    system: ANALYSIS_PROMPT,
    messages: [{ role: "user", content: context }],
  });

  const content = response.content[0];
  const analysis = content.type === "text" ? content.text : "";

  return NextResponse.json({
    analysis,
    provider: model,
  });
}

async function callOpenAI(model: string, context: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 1500,
    temperature: 0.3,
    messages: [
      { role: "system", content: ANALYSIS_PROMPT },
      { role: "user", content: context },
    ],
  });

  const analysis = response.choices[0]?.message?.content || "";

  return NextResponse.json({
    analysis,
    provider: model,
  });
}

function formatAnalysisContext(
  journalEntries: any[],
  currentDraft: string,
  batchLogs: any[],
  prompts: any,
  debateLogic: any
): string {
  let context = "# Analysis Context\n\n";

  // Today's date
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  context += `**Date**: ${today}\n\n`;

  // Journal entries
  context += "## Today's Journal Entries\n\n";
  if (journalEntries && journalEntries.length > 0) {
    journalEntries.forEach((entry: any) => {
      const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      context += `[${time}] ${entry.content}\n\n`;
    });
  } else if (currentDraft) {
    context += `Current draft:\n${currentDraft}\n\n`;
  } else {
    context += "_No journal entries for today._\n\n";
  }

  // Batch logs summary
  context += "## Recent Batch Test Results\n\n";
  if (batchLogs && batchLogs.length > 0) {
    batchLogs.forEach((batch: any, i: number) => {
      const summary = extractBatchSummary(batch);
      const timestamp = batch.timestamp
        ? new Date(batch.timestamp).toLocaleString()
        : `Batch ${i + 1}`;
      context += `### ${timestamp}\n`;
      context += `- Mode: ${summary.mode || "unknown"}\n`;
      context += `- Source: ${summary.source || "unknown"}\n`;
      context += `- Tests: ${summary.totalTests}\n`;
      context += `- Catch Rate: ${summary.catchRate}%\n`;
      context += `- Echoed: ${summary.echoTotal}\n`;
      context += `- Caught: ${summary.caughtTotal}\n`;
      if (summary.failures && summary.failures.length > 0) {
        context += `- Failures: ${summary.failures.join(", ")}\n`;
      }
      context += "\n";
    });
  } else {
    context += "_No batch logs available. Run some tests for detailed analysis._\n\n";
  }

  // Current prompts
  context += "## Current Prompts\n\n";

  if (debateLogic) {
    context += `**D1 Prompt (Debate Logic)**:\n\`\`\`\n${truncate(debateLogic.d1Prompt, 300)}\n\`\`\`\n\n`;
    context += `**D2 Prompt (Debate Logic)**:\n\`\`\`\n${truncate(debateLogic.d2Prompt, 300)}\n\`\`\`\n\n`;
    context += `**D3 Prompt (Debate Logic)**:\n\`\`\`\n${truncate(debateLogic.d3Prompt, 300)}\n\`\`\`\n\n`;
    context += `**Judge Prompt (Debate Logic)**:\n\`\`\`\n${truncate(debateLogic.judgePrompt, 300)}\n\`\`\`\n\n`;
  } else if (prompts) {
    context += `**D1**: ${truncate(prompts.d1, 200)}\n\n`;
    context += `**D2**: ${truncate(prompts.d2, 200)}\n\n`;
    context += `**D3**: ${truncate(prompts.d3, 200)}\n\n`;
    context += `**Judge**: ${truncate(prompts.judge, 200)}\n\n`;
  } else {
    context += "_No prompts configured._\n\n";
  }

  return context;
}

function extractBatchSummary(batch: any) {
  // Handle different batch log structures
  if (batch.passLogs && batch.passLogs.length > 0) {
    const lastPass = batch.passLogs[batch.passLogs.length - 1];
    return {
      mode: batch.mode || lastPass.mode,
      source: batch.source || lastPass.source,
      totalTests: lastPass.tests?.length || 0,
      catchRate: lastPass.summary?.catchRate || 0,
      echoTotal: lastPass.summary?.echoTotal || 0,
      caughtTotal: lastPass.summary?.caughtTotal || 0,
      failures: extractFailures(lastPass.tests),
    };
  }

  // Direct summary format
  if (batch.summary) {
    return {
      mode: batch.mode,
      source: batch.source,
      totalTests: batch.tests?.length || 0,
      catchRate: batch.summary.catchRate || 0,
      echoTotal: batch.summary.echoTotal || 0,
      caughtTotal: batch.summary.caughtTotal || 0,
      failures: extractFailures(batch.tests),
    };
  }

  return {
    mode: batch.mode || "unknown",
    source: batch.source || "unknown",
    totalTests: 0,
    catchRate: 0,
    echoTotal: 0,
    caughtTotal: 0,
    failures: [],
  };
}

function extractFailures(tests: any[]): string[] {
  if (!tests || !Array.isArray(tests)) return [];

  return tests
    .filter((t) => t.echoed && !t.caught)
    .map((t) => t.question?.substring(0, 50) || "Unknown question")
    .slice(0, 3); // Limit to 3 examples
}

function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return "[Not set]";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
