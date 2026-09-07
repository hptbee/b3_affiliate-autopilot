import type {
  OptimizationReasoningInput,
  OptimizationReasoningProvider,
  OptimizationReasoningResult,
} from '@social-autopilot/core';
import type { AIProvider } from '../providers/types.js';

export class AiOptimizationReasoningProvider implements OptimizationReasoningProvider {
  constructor(private readonly aiProvider: AIProvider) {}

  async summarize(input: OptimizationReasoningInput): Promise<OptimizationReasoningResult> {
    const prompt = [
      'Summarize the following affiliate optimization recommendations for a human reviewer.',
      'Explain the metrics-backed rationale in plain language.',
      'Do not propose automatic changes or publishing actions.',
      '',
      input.summary,
      '',
      JSON.stringify(input.recommendations, null, 2),
    ].join('\n');

    const result = await this.aiProvider.generateText({
      prompt,
      systemPrompt:
        'You are an affiliate content analyst. Provide concise, explainable reasoning only. Human approval is required before any action.',
      maxTokens: 500,
      temperature: 0.2,
    });

    return { reasoning: result.text.trim() };
  }
}

export function createOptimizationReasoningProvider(
  aiProvider: AIProvider,
): OptimizationReasoningProvider {
  return new AiOptimizationReasoningProvider(aiProvider);
}
