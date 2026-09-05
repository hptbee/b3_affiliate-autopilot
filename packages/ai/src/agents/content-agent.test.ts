import { describe, expect, it, vi } from 'vitest';
import type { AIProvider } from '../providers/types.js';
import type { ContentService } from '@social-autopilot/core';
import { ContentAgent } from '../agents/content-agent.js';

function createMockAIProvider(response: { title: string; body: string }): AIProvider {
  return {
    name: 'mock',
    generateText: vi.fn(),
    generateStructured: vi.fn(
      async <T,>(_input: unknown) => response as T,
    ) as AIProvider['generateStructured'],
  };
}

function createMockContentService(): ContentService {
  return {
    create: vi.fn(async (input) => ({
      id: 'content-123',
      userId: input.userId,
      title: input.title,
      body: input.body,
      status: 'draft' as const,
      contentType: 'text' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  } as unknown as ContentService;
}

describe('ContentAgent', () => {
  it('generates and persists a draft', async () => {
    const ai = createMockAIProvider({ title: 'Test Title', body: 'Test Body' });
    const contentService = createMockContentService();
    const agent = new ContentAgent(ai, contentService);

    const result = await agent.generateDraft(
      { userId: 'user-1' },
      { topic: 'Cloudflare Workers' },
    );

    expect(result.success).toBe(true);
    expect(result.data?.contentId).toBe('content-123');
    expect(result.data?.title).toBe('Test Title');
    expect(ai.generateStructured).toHaveBeenCalledOnce();
    expect(contentService.create).toHaveBeenCalledOnce();
  });

  it('returns error on AI failure', async () => {
    const ai: AIProvider = {
      name: 'mock',
      generateText: vi.fn(),
      generateStructured: vi.fn(async () => {
        throw new Error('AI unavailable');
      }),
    };
    const agent = new ContentAgent(ai, createMockContentService());

    const result = await agent.generateDraft(
      { userId: 'user-1' },
      { topic: 'Test' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('AI unavailable');
  });
});
