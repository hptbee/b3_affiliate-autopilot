import { AIProviderError } from '@social-autopilot/core';
import type { AIProvider, GenerateStructuredInput, GenerateTextInput, GenerateTextResult } from './types.js';

export class WorkersAIProvider implements AIProvider {
  readonly name = 'workers-ai';

  constructor(private readonly ai: Ai) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const messages: Array<{ role: string; content: string }> = [];
    if (input.systemPrompt) {
      messages.push({ role: 'system', content: input.systemPrompt });
    }
    messages.push({ role: 'user', content: input.prompt });

    const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
      max_tokens: input.maxTokens ?? 1024,
      temperature: input.temperature ?? 0.7,
    });

    const text =
      typeof response === 'object' && response !== null && 'response' in response
        ? String((response as { response: string }).response)
        : String(response);

    return {
      text,
      model: '@cf/meta/llama-3.1-8b-instruct',
    };
  }

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T> {
    const result = await this.generateText({
      ...input,
      systemPrompt: [
        input.systemPrompt,
        'Respond with valid JSON only. No markdown, no explanation.',
      ]
        .filter(Boolean)
        .join('\n'),
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      throw new AIProviderError('Failed to parse structured AI response as JSON');
    }

    return input.schema.parse(parsed);
  }
}
