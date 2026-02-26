import { Provider, CompletionResult, ConnectionStatus, maskKey } from './types';
import { useAirGapStore } from "../../stores/airGapStore";

export class AnthropicProvider implements Provider {
  name = 'anthropic';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchModels(): Promise<string[]> {
    // Anthropic doesn't have a list models endpoint, return known models
    return [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
    ];
  }

  async complete(model: string, prompt: string, systemPrompt?: string): Promise<CompletionResult> {
    const startTime = Date.now();

    // Air-Gap check
    const airGapStore = useAirGapStore.getState();
    if (airGapStore.airGapEnabled) {
      airGapStore.blockCloudAttempt('Anthropic', 'complete');
      return {
        content: '',
        tokens: 0,
        timeMs: Date.now() - startTime,
        error: 'Air-Gap Mode: Anthropic access blocked',
      };
    }

    try {
      const body: any = {
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      };

      if (systemPrompt) {
        body.system = systemPrompt;
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Anthropic error: ${res.status} - ${error}`);
      }

      const data = await res.json();
      const timeMs = Date.now() - startTime;

      return {
        content: data.content?.[0]?.text || '',
        tokens: data.usage?.output_tokens || 0,
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
    
    // Just verify key format, don't make unnecessary API calls
    const isValidFormat = this.apiKey.startsWith('sk-ant-');
    return {
      connected: isValidFormat,
      masked_key: maskKey(this.apiKey),
      error: isValidFormat ? undefined : 'Invalid key format',
    };
  }
}
