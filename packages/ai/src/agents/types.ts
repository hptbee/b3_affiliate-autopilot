import type { ZodSchema } from 'zod';

export interface AgentTool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TInput>;
  execute(input: TInput): Promise<TOutput>;
}

export interface AgentContext {
  userId: string;
  requestId?: string;
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
