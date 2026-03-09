import { NextRequest } from "next/server";
import { MODEL_RATES, getRate } from "@sarge/billing";
import { getCustomRates } from "@sarge/billing/src/rateOverrides";

const EXTRACTION_SYSTEM = `Extract model API pricing from this text. Return ONLY a JSON array. Each element: {"model":"model-id","input":number,"output":number} where input/output are USD per 1M tokens. Omit models not found. No explanation, no markdown, no code fences. Just the raw JSON array.`;

const PROVIDER_SEARCH_QUERIES: Record<string, string> = {
  anthropic: "Anthropic Claude API pricing per million tokens",
  openai: "OpenAI GPT API pricing per million tokens",
  google: "Google Gemini API pricing per million tokens",
  xai: "xAI Grok API pricing per million tokens",
  deepseek: "DeepSeek API pricing per million tokens",
  mistral: "Mistral AI API pricing per million tokens",
};

const PROVIDER_MODEL_PREFIXES: Record<string, string[]> = {
  anthropic: ["claude-"],
  openai: ["gpt-", "o1", "o3", "o4-"],
  google: ["gemini-"],
  xai: ["grok-"],
  deepseek: ["deepseek-"],
  mistral: ["devstral-", "mistral-", "codestral-"],
};

function getModelsForProvider(provider: string): string[] {
  const prefixes = PROVIDER_MODEL_PREFIXES[provider] || [];
  const custom = getCustomRates();
  const allRates = { ...MODEL_RATES, ...custom };
  const seen = new Set<string>();
  const models: string[] = [];
  for (const key of Object.keys(allRates)) {
    if (key.includes(":") || key.includes("*")) continue;
    if (prefixes.some(p => key.startsWith(p)) && !seen.has(key)) {
      seen.add(key);
      models.push(key);
    }
  }
  return models;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { extractionProvider, model: extractionModel } = body as {
      extractionProvider: string;
      model: string;
    };

    if (!extractionProvider || !extractionModel) {
      return new Response(
        JSON.stringify({ error: "extractionProvider and model are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const baseUrl = `http://localhost:3101`;
    const providers = Object.keys(PROVIDER_SEARCH_QUERIES);
    const custom = getCustomRates();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };

        let totalChecked = 0;
        let totalChanged = 0;
        let totalErrors = 0;

        for (const provider of providers) {
          const modelIds = getModelsForProvider(provider);
          if (modelIds.length === 0) {
            emit({ event: "status", provider, message: "No models to check" });
            continue;
          }

          // Step 1: Tavily search
          emit({ event: "status", provider, message: `Searching ${provider} pricing...` });

          let searchContext = "";
          try {
            const searchRes = await fetch(`${baseUrl}/api/search/tavily`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: PROVIDER_SEARCH_QUERIES[provider] }),
              signal: AbortSignal.timeout(15000),
            });
            if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
            const searchData = await searchRes.json();
            searchContext = searchData.context || "";
          } catch (err) {
            emit({ event: "error", provider, message: `Search failed: ${err instanceof Error ? err.message : "Unknown"}` });
            totalErrors++;
            continue;
          }

          if (!searchContext || searchContext.length < 50) {
            emit({ event: "error", provider, message: "No useful search results found" });
            totalErrors++;
            continue;
          }

          // Step 2: Model extraction
          emit({ event: "status", provider, message: `Extracting prices (${modelIds.length} models)...` });

          let extracted: Array<{ model: string; input: number; output: number }> = [];
          try {
            const chatRes = await fetch(`${baseUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [
                  { role: "system", content: EXTRACTION_SYSTEM },
                  { role: "user", content: `Provider: ${provider}. Models to find: ${modelIds.join(", ")}.\nText:\n${searchContext}` },
                ],
                provider: extractionProvider,
                model: extractionModel,
              }),
              signal: AbortSignal.timeout(30000),
            });
            if (!chatRes.ok) throw new Error(`Chat failed: ${chatRes.status}`);
            const chatData = await chatRes.json();
            const content = (chatData.content || "").trim();

            // Parse JSON — handle code fences
            let jsonStr = content;
            const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (fenceMatch) jsonStr = fenceMatch[1].trim();

            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
              extracted = parsed.filter(
                (e: unknown) =>
                  e && typeof e === "object" &&
                  typeof (e as Record<string, unknown>).model === "string" &&
                  typeof (e as Record<string, unknown>).input === "number" &&
                  typeof (e as Record<string, unknown>).output === "number"
              );
            }
          } catch (err) {
            emit({ event: "error", provider, message: `Extraction failed: ${err instanceof Error ? err.message : "Unknown"}` });
            totalErrors++;
            continue;
          }

          // Step 3: Compare
          const results: Array<{
            model: string;
            current: { input: number; output: number };
            found: { input: number; output: number };
            changed: boolean;
          }> = [];

          for (const found of extracted) {
            // Get current rate (check custom overrides first, then hardcoded)
            const currentCustom = custom[found.model];
            const currentHardcoded = MODEL_RATES[found.model];
            const current = currentCustom || currentHardcoded || getRate(found.model, provider);

            const changed =
              Math.abs(current.input - found.input) > 0.005 ||
              Math.abs(current.output - found.output) > 0.005;

            results.push({
              model: found.model,
              current: { input: current.input, output: current.output },
              found: { input: found.input, output: found.output },
              changed,
            });
          }

          const changedCount = results.filter(r => r.changed).length;
          totalChecked += results.length;
          totalChanged += changedCount;

          emit({
            event: "result",
            provider,
            models: results,
            checked: results.length,
            changed: changedCount,
          });
        }

        emit({
          event: "done",
          summary: { checked: totalChecked, changed: totalChanged, errors: totalErrors },
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[check-prices] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
