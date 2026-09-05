import { describe, expect, it, vi } from 'vitest';
import type { AIProvider } from '../providers/types.js';
import type { ContentService } from '@social-autopilot/core';
import { ContentAgent } from '../agents/content-agent.js';

function createMockAIProvider(): AIProvider {
  return {
    name: 'mock',
    generateText: vi.fn(),
    generateStructured: vi.fn(async () => ({
      hook: 'Wait for this',
      script: 'Here is the script',
      caption: 'Caption text',
      hashtags: ['fyp'],
      cta: 'Follow for more',
      qualityScore: 0.8,
    })) as AIProvider['generateStructured'],
  };
}

function createMockContentService(): ContentService {
  return {
    create: vi.fn(async (_user, input) => ({
      id: 'content-123',
      userId: _user.userId,
      title: input.title,
      body: input.body,
      status: 'draft' as const,
      contentType: 'video' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  } as unknown as ContentService;
}

describe('ContentAgent', () => {
  it('generates and persists a TikTok draft for the current user', async () => {
    const ai = createMockAIProvider();
    const contentService = createMockContentService();
    const agent = new ContentAgent(ai, contentService);

    const result = await agent.generateDraft({ userId: 'user-1' }, { topic: 'Cloudflare Workers' });

    expect(result.success).toBe(true);
    expect(result.data?.contentId).toBe('content-123');
    expect(result.data?.title).toBe('Wait for this');
    expect(contentService.create).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({ contentType: 'video' }),
    );
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

    const result = await agent.generateDraft({ userId: 'user-1' }, { topic: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('AI unavailable');
  });
});
