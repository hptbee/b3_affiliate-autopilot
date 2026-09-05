import { AIProviderError } from '@social-autopilot/core';
import { OpenAIProvider } from './openai.js';
import type { AIProvider, AIProviderConfig } from './types.js';
import { WorkersAIProvider } from './workers-ai.js';

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.type) {
    case 'openai':
      if (!config.openaiApiKey) {
        throw new AIProviderError('OpenAI API key is required');
      }
      return new OpenAIProvider(config.openaiApiKey);
    case 'workers-ai':
      if (!config.workersAiBinding) {
        throw new AIProviderError('Workers AI binding is required');
      }
      return new WorkersAIProvider(config.workersAiBinding);
    default:
      throw new AIProviderError(`Unknown AI provider type: ${config.type as string}`);
  }
}

export * from './types.js';
export * from './openai.js';
export * from './workers-ai.js';
