import { NextResponse } from 'next/server';
import { OllamaProvider } from '@/lib/test-providers/ollama';
import { AnthropicProvider } from '@/lib/test-providers/anthropic';
import { OpenAIProvider } from '@/lib/test-providers/openai';
import { GoogleProvider } from '@/lib/test-providers/google';
import { XAIProvider } from '@/lib/test-providers/xai';

export async function GET() {
  try {
    // Fetch Ollama models
    const ollama = new OllamaProvider(process.env.OLLAMA_URL || 'http://localhost:11434');
    const localModels = await ollama.fetchModels();

    // Get cloud models (static lists)
    const anthropic = new AnthropicProvider(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '');
    const openai = new OpenAIProvider(process.env.OPENAI_API_KEY || '');
    const google = new GoogleProvider(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '');
    const xai = new XAIProvider(process.env.XAI_API_KEY || process.env.GROK_API_KEY || '');

    const cloudModels = [
      ...await anthropic.fetchModels(),
      ...await openai.fetchModels(),
      ...await google.fetchModels(),
      ...await xai.fetchModels(),
    ];

    return NextResponse.json({
      local: localModels,
      cloud: cloudModels,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
