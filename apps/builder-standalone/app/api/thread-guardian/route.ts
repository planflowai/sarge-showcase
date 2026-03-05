/**
 * Thread Guardian API Route
 *
 * Handles requests from the Thread Guardian engine to analyze conversations.
 * Routes requests to the appropriate provider (local Ollama or cloud).
 *
 * Features:
 * - Air-gap mode: Blocks cloud providers when enabled
 * - JSON response mode: Forces structured output when supported
 * - Error handling: Never throws, always returns structured response
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Message, Provider } from '@/lib/types';

// Provider API key environment variables
const PROVIDER_API_KEYS: Record<string, string> = {
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  openai: process.env.OPENAI_API_KEY || '',
  google: process.env.GOOGLE_API_KEY || '',
  deepseek: process.env.DEEPSEEK_API_KEY || '',
  xai: process.env.XAI_API_KEY || '',
};

// Cloud providers that require API keys
const CLOUD_PROVIDERS = ['anthropic', 'openai', 'google', 'deepseek', 'xai'];

interface GuardianRequest {
  tier: 1 | 2 | 3;
  conversationId: string;
  messages: Message[];
  systemPrompt: string;
  model: string;
  provider: string;
  prompt: string;
}

interface GuardianResponse {
  content?: string;
  skipped?: boolean;
  reason?: string;
  error?: boolean;
  message?: string;
  tokens?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse<GuardianResponse>> {
  try {
    const body: GuardianRequest = await req.json();
    const { tier, conversationId, messages, systemPrompt, model, provider, prompt } = body;

    // Validate required fields
    if (!tier || !model || !provider || !prompt) {
      return NextResponse.json({
        error: true,
        message: 'Missing required fields: tier, model, provider, or prompt',
      });
    }

    // Check air-gap mode for cloud providers
    // Note: We check via header since server can't access client-side zustand store
    const airGapHeader = req.headers.get('x-airgap-enabled');
    const isAirGapEnabled = airGapHeader === 'true';

    if (isAirGapEnabled && CLOUD_PROVIDERS.includes(provider)) {
      return NextResponse.json({
        skipped: true,
        reason: 'Air-gap mode enabled - cloud provider blocked',
      });
    }

    // Route to appropriate provider
    let response: GuardianResponse;

    if (provider === 'ollama') {
      response = await callOllama(model, systemPrompt, prompt);
    } else if (provider === 'anthropic') {
      response = await callAnthropic(model, systemPrompt, prompt);
    } else if (provider === 'openai') {
      response = await callOpenAI(model, systemPrompt, prompt);
    } else if (provider === 'google') {
      response = await callGoogle(model, systemPrompt, prompt);
    } else if (provider === 'deepseek') {
      response = await callDeepSeek(model, systemPrompt, prompt);
    } else {
      return NextResponse.json({
        error: true,
        message: `Unsupported provider: ${provider}`,
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('[api/thread-guardian] Error:', err);
    return NextResponse.json({
      error: true,
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

// ============================================================================
// PROVIDER IMPLEMENTATIONS
// ============================================================================

/**
 * Call local Ollama model
 */
async function callOllama(model: string, systemPrompt: string, prompt: string): Promise<GuardianResponse> {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        stream: false,
        format: 'json', // Request JSON output
        options: {
          temperature: 0.3, // Lower temperature for more consistent JSON
          num_predict: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: true,
        message: `Ollama error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
      tokens: data.eval_count || 0,
    };
  } catch (err) {
    return {
      error: true,
      message: `Ollama connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Call Anthropic Claude
 */
async function callAnthropic(model: string, systemPrompt: string, prompt: string): Promise<GuardianResponse> {
  const apiKey = PROVIDER_API_KEYS.anthropic;

  if (!apiKey) {
    return {
      error: true,
      message: 'No Anthropic API key configured',
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2024-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: true,
        message: `Anthropic error: ${errorData.error?.message || response.status}`,
      };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return {
      content,
      tokens: data.usage?.output_tokens || 0,
    };
  } catch (err) {
    return {
      error: true,
      message: `Anthropic request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Call OpenAI GPT
 */
async function callOpenAI(model: string, systemPrompt: string, prompt: string): Promise<GuardianResponse> {
  const apiKey = PROVIDER_API_KEYS.openai;

  if (!apiKey) {
    return {
      error: true,
      message: 'No OpenAI API key configured',
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.3,
        response_format: { type: 'json_object' }, // Force JSON mode
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: true,
        message: `OpenAI error: ${errorData.error?.message || response.status}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      tokens: data.usage?.completion_tokens || 0,
    };
  } catch (err) {
    return {
      error: true,
      message: `OpenAI request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Call Google Gemini
 */
async function callGoogle(model: string, systemPrompt: string, prompt: string): Promise<GuardianResponse> {
  const apiKey = PROVIDER_API_KEYS.google;

  if (!apiKey) {
    return {
      error: true,
      message: 'No Google API key configured',
    };
  }

  try {
    // Map model names if needed
    const geminiModel = model.startsWith('gemini-') ? model : `gemini-${model}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json', // Request JSON output
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: true,
        message: `Google error: ${errorData.error?.message || response.status}`,
      };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content,
      tokens: data.usageMetadata?.candidatesTokenCount || 0,
    };
  } catch (err) {
    return {
      error: true,
      message: `Google request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Call DeepSeek
 */
async function callDeepSeek(model: string, systemPrompt: string, prompt: string): Promise<GuardianResponse> {
  const apiKey = PROVIDER_API_KEYS.deepseek;

  if (!apiKey) {
    return {
      error: true,
      message: 'No DeepSeek API key configured',
    };
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.3,
        response_format: { type: 'json_object' }, // DeepSeek supports JSON mode
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: true,
        message: `DeepSeek error: ${errorData.error?.message || response.status}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      tokens: data.usage?.completion_tokens || 0,
    };
  } catch (err) {
    return {
      error: true,
      message: `DeepSeek request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
