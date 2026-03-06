import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/models/classify
 * Uses DeepSeek (cheap, fast) to classify a batch of model names by capability.
 * Body: { modelIds: string[] }
 * Returns: { classifications: Record<string, { category, strength }> }
 */
export async function POST(req: NextRequest) {
  const { modelIds } = await req.json();
  if (!Array.isArray(modelIds) || modelIds.length === 0) {
    return NextResponse.json({ error: "modelIds required" }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY not set" }, { status: 500 });
  }

  const prompt = `Classify each AI model by its primary capability and strength.

Categories (pick exactly one per model):
- general = reasoning/chat (GPT, Claude, Llama, Qwen, Gemma, Phi, DeepSeek-R1, Mistral, etc.)
- code = programming specialist (CodeLlama, DeepSeek-Coder, StarCoder, Qwen2.5-Coder, etc.)
- vision = image understanding (LLaVA, BakLLaVA, moondream, etc.)
- image_gen = image generation (stable-diffusion, DALL-E, etc.)
- embedding = embedding/vector models (nomic-embed, all-minilm, mxbai-embed, etc.)
- audio = speech/music models
- video_gen = video generation
- toy = too small to be useful (<1B params, tinyllama, etc.)
- unknown = can't determine

Strength:
- strong = flagship/large (70B+, or known strong like deepseek-r1, qwen3:32b)
- medium = capable mid-size (7B-32B)
- weak = small/limited (<7B)

Models to classify:
${modelIds.map((id, i) => `${i + 1}. ${id}`).join("\n")}

Reply with ONLY valid JSON, no markdown:
{"classifications":{"model-id":{"category":"general","strength":"medium"},...}}`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json({ error: `DeepSeek ${res.status}: ${errText}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    // Extract JSON from response (handle markdown code fences)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No JSON in response", raw: content }, { status: 502 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
