import type { AIProvider } from './types';
import { OpenAIProvider } from './ai-providers/openai';
import { AnthropicProvider } from './ai-providers/anthropic';

/** True si une clé API IA est configurée pour le provider courant */
export function isAiConfigured(): boolean {
  const provider = process.env.AI_PROVIDER || 'openai';
  if (provider === 'anthropic') {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'openai';

  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider();
    case 'openai':
    default:
      return new OpenAIProvider();
  }
}
