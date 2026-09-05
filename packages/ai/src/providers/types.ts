import type { ZodSchema } from 'zod';

export interface GenerateTextInput {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateStructuredInput<T> {
  prompt: string;
  systemPrompt?: string;
  schema: ZodSchema<T>;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  readonly name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
}

export type AIProviderType = 'openai' | 'workers-ai';

export interface AIProviderConfig {
  type: AIProviderType;
  openaiApiKey?: string;
  workersAiBinding?: Ai;
}
