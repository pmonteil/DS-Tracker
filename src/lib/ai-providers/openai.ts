import OpenAI from 'openai';
import type { AIProvider } from '../types';
import { PATCHNOTE_SYSTEM_PROMPT } from '../patchnote-template';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.AI_MODEL || 'gpt-4o-mini';
  }

  async generatePatchnote(diffJson: string, context: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: PATCHNOTE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Contexte : ${context}\n\nDiff JSON :\n${diffJson}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  async analyzeScreenshots(
    beforeUrl: string | null,
    afterUrl: string | null,
    componentName: string
  ): Promise<string> {
    const images: OpenAI.ChatCompletionContentPart[] = [];

    if (beforeUrl) {
      images.push({ type: 'image_url', image_url: { url: beforeUrl, detail: 'low' } });
    }
    if (afterUrl) {
      images.push({ type: 'image_url', image_url: { url: afterUrl, detail: 'low' } });
    }

    if (images.length === 0) return '';

    const prompt = images.length === 2
      ? `Compare ces deux images du composant "${componentName}" (avant/après). Décris en 1-2 phrases les différences visuelles notables (couleurs, espacements, tailles, bordures, ombres, textes). Réponds en français, sois concis.`
      : `Décris brièvement ce composant "${componentName}" en 1 phrase. Réponds en français.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images,
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
