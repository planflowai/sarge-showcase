import { NextResponse } from 'next/server';
import { OllamaProvider } from '@/lib/test-providers/ollama';
import { maskKey } from '@/lib/test-providers/types';

export async function GET() {
  const status: Record<string, { connected: boolean; masked_key?: string; error?: string }> = {};

  // Check Ollama
  try {
    const ollama = new OllamaProvider(process.env.OLLAMA_URL || 'http://localhost:11434');
    const ollamaStatus = await ollama.checkConnection();
    status.ollama = ollamaStatus;
  } catch {
    status.ollama = { connected: false, error: 'Cannot reach Ollama' };
  }

  // Check Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  status.supabase = {
    connected: !!(supabaseUrl && supabaseKey),
    masked_key: maskKey(supabaseKey),
  };

  // Check Anthropic (Claude)
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  status.anthropic = {
    connected: !!(anthropicKey && anthropicKey.startsWith('sk-ant-')),
    masked_key: maskKey(anthropicKey),
  };

  // Check OpenAI (GPT)
  const openaiKey = process.env.OPENAI_API_KEY;
  status.openai = {
    connected: !!(openaiKey && openaiKey.startsWith('sk-')),
    masked_key: maskKey(openaiKey),
  };

  // Check Google (Gemini)
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  status.google = {
    connected: !!(googleKey && googleKey.length > 20),
    masked_key: maskKey(googleKey),
  };

  // Check xAI (Grok)
  const xaiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  status.xai = {
    connected: !!(xaiKey && xaiKey.startsWith('xai-')),
    masked_key: maskKey(xaiKey),
  };

  return NextResponse.json(status);
}
