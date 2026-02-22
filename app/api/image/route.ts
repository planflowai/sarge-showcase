import { NextRequest, NextResponse } from "next/server";
import type { Provider } from "@/lib/types";

function getApiKey(provider: Provider): string {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY ?? "";
    case "google":
      return process.env.GOOGLE_API_KEY ?? "";
    case "xai":
      return process.env.XAI_API_KEY ?? "";
    default:
      return "";
  }
}

async function generateOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI image error: ${res.status}`);
  }
  return data.data[0].url;
}

async function generateXAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-2-image",
      prompt,
      n: 1,
      response_format: "url",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `xAI image error: ${res.status}`);
  }
  return data.data[0].url;
}

async function generateGoogle(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
        },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error?.message || `Google image error: ${res.status}`
    );
  }

  // Imagen returns base64 encoded images
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) {
    throw new Error("No image returned from Imagen");
  }
  return `data:image/png;base64,${b64}`;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, provider } = (await req.json()) as {
      prompt: string;
      provider: Provider;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const supported = ["openai", "xai", "google"];
    if (!supported.includes(provider)) {
      return NextResponse.json(
        { error: `Image generation not supported for ${provider}` },
        { status: 400 }
      );
    }

    const apiKey = getApiKey(provider);
    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for ${provider}` },
        { status: 400 }
      );
    }

    let imageUrl: string;
    switch (provider) {
      case "openai":
        imageUrl = await generateOpenAI(prompt, apiKey);
        break;
      case "xai":
        imageUrl = await generateXAI(prompt, apiKey);
        break;
      case "google":
        imageUrl = await generateGoogle(prompt, apiKey);
        break;
      default:
        return NextResponse.json({ error: "Unsupported" }, { status: 400 });
    }

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("[api/image] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
