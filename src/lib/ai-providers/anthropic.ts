import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from '../types';
import { PATCHNOTE_SYSTEM_PROMPT } from '../patchnote-template';

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.AI_MODEL || 'claude-haiku-4.5';
  }

  async generatePatchnote(diffJson: string, context: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: PATCHNOTE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Contexte : ${context}\n\nDiff JSON :\n${diffJson}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock ? textBlock.text : '';
  }
}
