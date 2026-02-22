import { Provider, CompletionResult, ConnectionStatus, maskKey } from './types';
import { useAirGapStore } from '@/lib/stores/airGapStore';

export class GoogleProvider implements Provider {
  name = 'google';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchModels(): Promise<string[]> {
    return [
      'gemini-2.0-flash',
    ];
  }

  async complete(model: string, prompt: string, systemPrompt?: string): Promise<CompletionResult> {
    const startTime = Date.now();

    // Air-Gap check
    const airGapStore = useAirGapStore.getState();
    if (airGapStore.airGapEnabled) {
      airGapStore.blockCloudAttempt('Google', 'complete');
      return {
        content: '',
        tokens: 0,
        timeMs: Date.now() - startTime,
        error: 'Air-Gap Mode: Google access blocked',
      };
    }

    try {
      const contents = [];
      
      if (systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: systemPrompt }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: 'Understood. I will follow these instructions.' }]
        });
      }
      
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
        }
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Google error: ${res.status} - ${error}`);
      }

      const data = await res.json();
      const timeMs = Date.now() - startTime;

      return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        tokens: data.usageMetadata?.candidatesTokenCount || 0,
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
    
    // Google keys don't have a standard prefix, just check length
    const isValidFormat = this.apiKey.length > 20;
    return {
      connected: isValidFormat,
      masked_key: maskKey(this.apiKey),
      error: isValidFormat ? undefined : 'Invalid key format',
    };
  }
}
