import { AIProviderError } from '@social-autopilot/core';
import type { AIProvider, GenerateStructuredInput, GenerateTextInput, GenerateTextResult } from './types.js';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  constructor(private readonly apiKey: string) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          ...(input.systemPrompt ? [{ role: 'system', content: input.systemPrompt }] : []),
          { role: 'user', content: input.prompt },
        ],
        max_tokens: input.maxTokens ?? 1024,
        temperature: input.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AIProviderError(`OpenAI API error: ${response.status}`, {
        status: response.status,
        body: errorBody.slice(0, 200),
      });
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      text: data.choices[0]?.message?.content ?? '',
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
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
