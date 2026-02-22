export * from './types';
export { OllamaProvider } from './ollama';
export { AnthropicProvider } from './anthropic';
export { OpenAIProvider } from './openai';
export { GoogleProvider } from './google';
export { XAIProvider } from './xai';

import { Provider } from './types';
import { OllamaProvider } from './ollama';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';
import { XAIProvider } from './xai';

export function getProvider(source: 'local' | 'cloud', cloudProvider?: string): Provider {
  if (source === 'local') {
    return new OllamaProvider(process.env.OLLAMA_URL || 'http://localhost:11434');
  }

  switch (cloudProvider) {
    case 'anthropic':
      return new AnthropicProvider(process.env.ANTHROPIC_API_KEY || '');
    case 'openai':
      return new OpenAIProvider(process.env.OPENAI_API_KEY || '');
    case 'google':
      return new GoogleProvider(process.env.GOOGLE_API_KEY || '');
    case 'xai':
      return new XAIProvider(process.env.XAI_API_KEY || '');
    default:
      throw new Error(`Unknown cloud provider: ${cloudProvider}`);
  }
}

// Determine which cloud provider a model belongs to
export function getCloudProviderForModel(model: string): string {
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gpt')) return 'openai';
  if (model.includes('gemini')) return 'google';
  if (model.includes('grok')) return 'xai';
  return 'openai'; // default
}
