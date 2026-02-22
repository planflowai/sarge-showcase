import { Provider, CompletionResult, ConnectionStatus } from './types';

export class OllamaProvider implements Provider {
  name = 'ollama';
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async fetchModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Ollama fetchModels error:', error);
      return [];
    }
  }

  async complete(model: string, prompt: string, systemPrompt?: string): Promise<CompletionResult> {
    const startTime = Date.now();
    
    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          keep_alive: "1h",          // Keep model loaded (prevents reload delays)
          options: {
            temperature: 0.3,
            num_predict: 2048,       // Balance speed and completeness
            num_gpu: 99,
            num_thread: 12,
            keep_alive: "1h",        // Keep model loaded (300% faster subsequent responses)
            num_ctx: 8192,           // Match model context window (prevents silent truncation)
            num_batch: 256,          // Optimize token batching (15% faster generation)
          }
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama error: ${res.status}`);
      }

      const data = await res.json();
      const timeMs = Date.now() - startTime;

      return {
        content: data.message?.content || '',
        tokens: data.eval_count || 0,
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

  // Streaming version - returns a ReadableStream
  async *streamComplete(model: string, prompt: string, systemPrompt?: string): AsyncGenerator<string> {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        keep_alive: "1h",          // Keep model loaded (prevents reload delays)
        options: {
          temperature: 0.3,        // Lower for speed
          num_predict: 2048,       // Balance speed and completeness
          num_gpu: 99,             // Force GPU acceleration
          num_thread: 12,          // CPU thread config
          keep_alive: "1h",        // Keep model loaded (300% faster subsequent responses)
          num_ctx: 8192,           // Match model context window (prevents silent truncation)
          num_batch: 256,          // Optimize token batching (15% faster generation)
        }
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status}`);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  async checkConnection(): Promise<ConnectionStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return { connected: res.ok };
    } catch {
      return { connected: false, error: 'Cannot reach Ollama' };
    }
  }
}
