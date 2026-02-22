import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a helpful AI assistant for a researcher working on AI safety testing. You are part of the "Journal" feature in SARGE (Synthetic Adversarial Reasoning & Guarding Engine).

CRITICAL: You have AUTOMATIC access to the Analysis panel's content. The user does NOT need to copy-paste anything. Whatever is shown in the Analysis panel is already available in your context data below.

Your role is to help the researcher:
1. Analyze their batch test results (poison pill detection rates, catch rates, echo patterns)
2. Discuss and refine their D1/D2/D3/Judge prompts
3. Answer questions about their test patterns and results
4. Suggest improvements based on the data
5. Help troubleshoot issues with their testing approach

WHEN SUGGESTING PROMPT CHANGES:
- Format your suggestions so they can be applied with one click
- Use this exact format for prompt rewrites:

## Suggested Prompt Update: D2
\`\`\`
[Your complete new prompt text here]
\`\`\`

This format triggers an Apply/Discard button in the UI.

RESPONSE STYLE:
- Be conversational and helpful
- Be concise - avoid long explanations unless asked
- When suggesting prompt changes, be specific about what to add/change
- Reference actual data from their tests when possible (catch rates, specific failures)
- NEVER ask the user to copy-paste data - you already have it in your context

If the context section shows "No data available" for a category, let the user know you don't have that specific data yet.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, model, conversationHistory, context } = body;

    // Build messages array
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    const contextSummary = formatContext(context);

    console.log("[Journal Chat] Model:", model, "Context length:", contextSummary.length);

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current message with context prefix for first message
    if (messages.length === 0) {
      messages.push({
        role: "user",
        content: `[YOUR CONTEXT DATA - USE THIS TO ANSWER QUESTIONS]\n${contextSummary}\n\n---\n\n[USER'S QUESTION]\n${message}`,
      });
    } else {
      messages.push({
        role: "user",
        content: message,
      });
    }

    // Route to appropriate model
    console.log("[Journal Chat] Routing model:", model, "Type:", typeof model);

    if (model === "auto" || !model) {
      // Auto mode: try Ollama first, fallback to Claude
      console.log("[Journal Chat] Using auto mode");
      return await tryAutoMode(messages);
    } else if (model.startsWith("ollama:")) {
      console.log("[Journal Chat] Using specific Ollama model:", model.replace("ollama:", ""));
      // Specific Ollama model
      const ollamaModel = model.replace("ollama:", "");
      return await callOllama(ollamaModel, messages);
    } else if (model.startsWith("claude") || model.includes("anthropic")) {
      // Anthropic model
      return await callAnthropic(model, messages);
    } else if (model.startsWith("gpt")) {
      // OpenAI model
      return await callOpenAI(model, messages);
    } else {
      // Default to auto
      return await tryAutoMode(messages);
    }
  } catch (error: any) {
    console.error("Journal chat error:", error);
    return NextResponse.json(
      { error: error.message || "Chat failed" },
      { status: 500 }
    );
  }
}

async function tryAutoMode(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  try {
    const ollama = new Ollama({ host: "http://localhost:11434" });
    await ollama.list();

    const response = await ollama.chat({
      model: "qwen2.5:14b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      options: {
        temperature: 0.7,
        num_predict: 2000,
        num_ctx: 8192,
      },
    });

    return NextResponse.json({
      response: response.message.content,
      provider: "ollama:qwen2.5:14b",
    });
  } catch (ollamaError: any) {
    console.warn("Ollama unavailable, falling back to Claude:", ollamaError.message);
    return await callAnthropic("claude-sonnet-4-20250514", messages);
  }
}

async function callOllama(model: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  try {
    const ollama = new Ollama({ host: "http://localhost:11434" });

    const response = await ollama.chat({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      options: {
        temperature: 0.7,
        num_predict: 2000,
        num_ctx: 8192,
      },
    });

    return NextResponse.json({
      response: response.message.content,
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

async function callAnthropic(model: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
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
    max_tokens: 2000,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages,
  });

  const content = response.content[0];
  const responseText = content.type === "text" ? content.text : "";

  return NextResponse.json({
    response: responseText,
    provider: model,
  });
}

async function callOpenAI(model: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
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
    max_tokens: 2000,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
  });

  const responseText = response.choices[0]?.message?.content || "";

  return NextResponse.json({
    response: responseText,
    provider: model,
  });
}

function formatContext(context: any): string {
  if (!context) {
    return "No context provided.";
  }

  let summary = "";

  // Journal entries
  if (context.journalEntries && context.journalEntries.length > 0) {
    summary += "## JOURNAL ENTRIES (Today)\n";
    context.journalEntries.forEach((entry: any) => {
      const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      summary += `[${time}] ${entry.content.substring(0, 500)}\n`;
    });
    summary += "\n";
  } else if (context.currentDraft && context.currentDraft.trim()) {
    summary += "## CURRENT JOURNAL DRAFT\n";
    summary += context.currentDraft.substring(0, 1500) + "\n\n";
  } else {
    summary += "## JOURNAL: No entries today\n\n";
  }

  // Batch logs - improved extraction
  if (context.batchLogs && context.batchLogs.length > 0) {
    summary += "## RECENT BATCH TEST RESULTS\n";
    context.batchLogs.forEach((batch: any, i: number) => {
      const stats = extractBatchStats(batch);
      const savedAt = batch.savedAt ? new Date(batch.savedAt).toLocaleString() : "Unknown time";
      summary += `\n### Batch ${i + 1} (${savedAt})\n`;
      summary += `- Tests run: ${stats.totalTests}\n`;
      summary += `- Catch rate: ${stats.catchRate}%\n`;
      summary += `- Echo total: ${stats.echoTotal}\n`;

      if (batch.passLogs && batch.passLogs.length > 0) {
        summary += `- Passes completed: ${batch.passLogs.length}\n`;
        batch.passLogs.forEach((pass: any, j: number) => {
          if (pass.summary) {
            summary += `  - Pass ${j + 1}: ${pass.summary.catchRate || 0}% catch, ${pass.summary.passed || 0} passed, ${pass.summary.failed || 0} failed\n`;
          }
        });
      }
    });
    summary += "\n";
  } else {
    summary += "## BATCH RESULTS: No recent batches available\n\n";
  }

  // Current Analysis (from Analysis panel - shared context)
  if (context.currentAnalysis) {
    summary += "## CURRENT ANALYSIS (from Analysis panel - LIVE)\n";
    summary += `Provider: ${context.currentAnalysisProvider || "unknown"}\n\n`;
    summary += context.currentAnalysis + "\n\n";
  }

  // Selected batch log (if user clicked one)
  if (context.selectedBatchLog) {
    summary += "## SELECTED BATCH LOG (user selected this in Analysis)\n";
    summary += JSON.stringify(context.selectedBatchLog, null, 2).substring(0, 2000) + "\n\n";
  }

  // Current prompts
  if (context.prompts) {
    const hasPrompts = context.prompts.d1 || context.prompts.d2 || context.prompts.d3 || context.prompts.judge;
    if (hasPrompts) {
      summary += "## CURRENT PROMPTS\n";
      if (context.prompts.d1) {
        summary += `\n### D1 (Responder):\n${context.prompts.d1.substring(0, 300)}${context.prompts.d1.length > 300 ? '...' : ''}\n`;
      }
      if (context.prompts.d2) {
        summary += `\n### D2 (Checker):\n${context.prompts.d2.substring(0, 300)}${context.prompts.d2.length > 300 ? '...' : ''}\n`;
      }
      if (context.prompts.d3) {
        summary += `\n### D3 (Verifier):\n${context.prompts.d3.substring(0, 300)}${context.prompts.d3.length > 300 ? '...' : ''}\n`;
      }
      if (context.prompts.judge) {
        summary += `\n### Judge:\n${context.prompts.judge.substring(0, 300)}${context.prompts.judge.length > 300 ? '...' : ''}\n`;
      }
    } else {
      summary += "## PROMPTS: No custom prompts configured\n\n";
    }
  } else {
    summary += "## PROMPTS: Not available\n\n";
  }

  return summary;
}

function extractBatchStats(batch: any) {
  if (batch.passLogs && batch.passLogs.length > 0) {
    const lastPass = batch.passLogs[batch.passLogs.length - 1];
    if (lastPass.summary) {
      return {
        catchRate: lastPass.summary.catchRate ?? lastPass.summary.catchRatePercent ?? 0,
        echoTotal: lastPass.summary.echoTotal ?? lastPass.summary.totalEchoes ?? 0,
        totalTests: lastPass.summary.total ?? lastPass.tests?.length ?? batch.testCount ?? 0,
      };
    }
  }

  if (batch.summary) {
    return {
      catchRate: batch.summary.catchRate ?? batch.summary.catchRatePercent ?? 0,
      echoTotal: batch.summary.echoTotal ?? batch.summary.totalEchoes ?? 0,
      totalTests: batch.summary.total ?? batch.testCount ?? 0,
    };
  }

  return {
    catchRate: 0,
    echoTotal: 0,
    totalTests: batch.testCount || 0
  };
}
