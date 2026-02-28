import { Provider, CompletionResult, ConnectionStatus, maskKey } from './types';
import { useAirGapStore } from '@/lib/stores/airGapStore';

export class XAIProvider implements Provider {
  name = 'xai';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchModels(): Promise<string[]> {
    return [
      'grok-4-0709',
      'grok-code-fast-1',
      'grok-4-fast-reasoning',
      'grok-4-fast-non-reasoning',
      'grok-4-1-fast-reasoning',
      'grok-4-1-fast-non-reasoning',
      'grok-3',
      'grok-3-mini',
    ];
  }

  async complete(model: string, prompt: string, systemPrompt?: string): Promise<CompletionResult> {
    const startTime = Date.now();

    // Air-Gap check
    const airGapStore = useAirGapStore.getState();
    if (airGapStore.airGapEnabled) {
      airGapStore.blockCloudAttempt('xAI', 'complete');
      return {
        content: '',
        tokens: 0,
        timeMs: Date.now() - startTime,
        error: 'Air-Gap Mode: xAI access blocked',
      };
    }

    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1024,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`xAI error: ${res.status} - ${error}`);
      }

      const data = await res.json();
      const timeMs = Date.now() - startTime;

      return {
        content: data.choices?.[0]?.message?.content || '',
        tokens: data.usage?.completion_tokens || 0,
        timeMs,
      };
    } catch (error: any) {
      return {
        content: '',
        tokens: 0,
        timeMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  async checkConnection(): Promise<ConnectionStatus> {
    if (!this.apiKey) {
      return { connected: false, error: 'No API key' };
    }
    
    const isValidFormat = this.apiKey.startsWith('xai-');
    return {
      connected: isValidFormat,
      masked_key: maskKey(this.apiKey),
      error: isValidFormat ? undefined : 'Invalid key format',
    };
  }
}
