import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";

const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";

// Classification prompt template
const CLASSIFICATION_PROMPT = `You are a model classification assistant. Based on the model name, determine its purpose and capabilities.

Model to classify: {{MODEL_ID}}

Analyze the model name and respond with EXACTLY this JSON format (no markdown, no extra text):
{
  "category": "CATEGORY",
  "strength": "STRENGTH",
  "pools": ["POOL1", "POOL2"],
  "reason": "Brief explanation"
}

CATEGORY must be one of:
- "general" - Text Q&A, reasoning, conversation (most LLMs)
- "vision" - Image understanding, visual Q&A (llava, minicpm-v, etc.)
- "code" - Specialized for programming (codellama, deepseek-coder, etc.)
- "image_gen" - Creates images (stable-diffusion, dall-e, etc.)
- "video_gen" - Creates videos
- "audio" - Speech, music
- "embedding" - Vector embeddings only
- "toy" - Under 500MB, not useful for real tasks
- "unknown" - Cannot determine

STRENGTH must be one of (for reasoning/debate ability):
- "strong" - 7B+ params, good reasoning (llama3.1:8b, qwen3:8b, deepseek-r1, etc.)
- "medium" - 3-7B params, decent (gemma3:4b, phi3:mini, etc.)
- "weak" - Under 3B params (gemma2:2b, llama3.2:1b, etc.)
- "none" - Not applicable (vision, image_gen, etc.)

POOLS array - which SARGE debate roles this model can fill:
- "d1" - Debater 1 (answers questions)
- "d2" - Debater 2 (challenges D1)
- "d3" - Debater 3 (mediates)
- "judge" - Final arbiter (needs strong reasoning)
- [] - Empty array if model shouldn't be in SARGE

Guidelines:
- Vision models (llava, minicpm-v, etc.) get pools: []
- Strong general models get pools: ["d1", "d2", "d3", "judge"]
- Medium models get pools: ["d1", "d2", "d3"]
- Weak models get pools: ["d1", "d2"]
- Code models can do ["d1", "d2"] for code-related debates
- Toy/embedding/image_gen models get pools: []

Model name patterns to recognize:
- "r1" or "reasoning" = strong reasoning model
- "coder" or "code" = code specialist
- "-v" suffix or "vision" or "llava" = vision model
- "mini" or small size = weaker
- "smol" or under 1B = toy

Respond with ONLY the JSON object, nothing else.`;

interface ClassificationResult {
  modelId: string;
  category: string;
  strength: string;
  pools: string[];
  reason: string;
}

export async function POST(req: NextRequest) {
  try {
    const { modelIds, classifierModel } = await req.json();

    if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
      return NextResponse.json({ error: "modelIds array required" }, { status: 400 });
    }

    if (!classifierModel) {
      return NextResponse.json({ error: "classifierModel required" }, { status: 400 });
    }

    const client = new Ollama({ host: OLLAMA_URL });
    const classifications: ClassificationResult[] = [];

    for (const modelId of modelIds) {
      try {
        const prompt = CLASSIFICATION_PROMPT.replace("{{MODEL_ID}}", modelId);

        const response = await client.chat({
          model: classifierModel,
          messages: [{ role: "user", content: prompt }],
          options: {
            temperature: 0.1,  // Low temp for consistent classification
            num_predict: 256,  // Short response expected
          },
        });

        const content = response.message?.content ?? "";

        // Parse JSON from response
        let parsed: any;
        try {
          // Try to extract JSON from response (in case there's extra text)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found in response");
          }
        } catch (parseErr) {
          console.warn(`Failed to parse classification for ${modelId}:`, content);
          // Default classification
          parsed = {
            category: "unknown",
            strength: "medium",
            pools: ["d1", "d2"],
            reason: "Classification parsing failed - using defaults"
          };
        }

        classifications.push({
          modelId,
          category: parsed.category || "unknown",
          strength: parsed.strength || "medium",
          pools: Array.isArray(parsed.pools) ? parsed.pools : ["d1", "d2"],
          reason: parsed.reason || "No reason provided",
        });

      } catch (modelErr: any) {
        console.error(`Error classifying ${modelId}:`, modelErr);
        classifications.push({
          modelId,
          category: "unknown",
          strength: "medium",
          pools: ["d1", "d2"],
          reason: `Classification failed: ${modelErr.message}`,
        });
      }
    }

    return NextResponse.json({ classifications });

  } catch (error: any) {
    console.error("Classification API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
