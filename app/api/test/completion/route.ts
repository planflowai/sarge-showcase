import { NextRequest, NextResponse } from 'next/server';
import { completionWithFallback } from '@/lib/fallback/providerWrapper';
import type { Provider } from '@/lib/types';

function getProviderFromModel(model: string): Provider {
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gpt')) return 'openai';
  if (model.includes('gemini')) return 'google';
  if (model.includes('grok')) return 'xai';
  throw new Error(`Unknown cloud model: ${model}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, prompt, systemPrompt, source, sessionId } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: 'Missing model or prompt' }, { status: 400 });
    }

    // Determine cloud provider from model name
    const cloudProvider = source === 'cloud' ? getProviderFromModel(model) : undefined;

    // Use fallback wrapper - automatically handles errors and retries
    const result = await completionWithFallback(
      model,
      prompt,
      systemPrompt,
      source,
      cloudProvider,
      sessionId
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
