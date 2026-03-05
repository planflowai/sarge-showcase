/**
 * Assess API — Calls Gemini 2.5 Flash for plain-English hybrid chain assessment.
 * Accepts the final HTML, per-step results, and scenario context.
 * Returns a structured text assessment (not JSON).
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { html, stepResults, scenario } = await request.json();

    if (!html || !stepResults || !scenario) {
      return NextResponse.json(
        { error: "html, stepResults, and scenario are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "No GOOGLE_API_KEY configured for AI assessment" },
        { status: 500 }
      );
    }

    // Build step summary for the prompt
    const stepSummary = stepResults
      .map(
        (s: { stepIndex: number; modelId: string; role: string; score: number; timeMs: number; cost: number }) =>
          `Step ${s.stepIndex + 1} (${s.role}) — ${s.modelId}: Score ${s.score}/100, ${(s.timeMs / 1000).toFixed(1)}s, $${s.cost.toFixed(4)}`
      )
      .join("\n");

    const assessPrompt = `You are an expert web developer reviewing the output of a multi-step AI build chain.

SCENARIO: ${scenario}

CHAIN RESULTS:
${stepSummary}

FINAL HTML (truncated to 8000 chars):
\`\`\`html
${html.slice(0, 8000)}
\`\`\`

Give a concise assessment in this exact format (use these exact headings):

## What Worked
- bullet points on strengths

## What Didn't
- bullet points on weaknesses or missing elements

## Biggest Improvement
Which step made the biggest score jump and why (1-2 sentences)

## One More Step
If you could add one more step to this chain, what model and role would you use? (1-2 sentences)

## Model Swap Suggestion
Which step would benefit most from swapping to a different model, and which model? (1-2 sentences)

Keep the entire response under 300 words. Be specific, not generic.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: assessPrompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Assess] Gemini error:", errText);
      return NextResponse.json(
        { error: `Gemini API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const assessment =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No assessment generated.";

    return NextResponse.json({ assessment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
