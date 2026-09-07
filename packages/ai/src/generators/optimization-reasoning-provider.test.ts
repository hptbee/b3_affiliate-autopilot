import { describe, expect, it, vi } from 'vitest';
import { AiOptimizationReasoningProvider } from './optimization-reasoning-provider.js';
import type { AIProvider } from '../providers/types.js';

describe('AiOptimizationReasoningProvider', () => {
  it('summarizes recommendations using the AI provider', async () => {
    const aiProvider: AIProvider = {
      name: 'mock',
      generateText: vi.fn(async () => ({
        text: 'Top product performance is driven by stronger click-through rates.',
        model: 'mock',
      })),
      generateStructured: vi.fn(),
    };

    const provider = new AiOptimizationReasoningProvider(aiProvider);
    const result = await provider.summarize({
      summary: 'Analyzed 2 publications.',
      recommendations: [
        {
          type: 'product_priority',
          title: 'Prioritize Widget',
          summary: 'High performer',
          priority: 'high',
          evidence: {
            performanceScore: 0.12,
            publicationCount: 2,
          },
        },
      ],
    });

    expect(result.reasoning).toContain('click-through');
    expect(aiProvider.generateText).toHaveBeenCalledOnce();
  });
});
