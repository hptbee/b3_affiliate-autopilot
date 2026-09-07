import { describe, expect, it, vi } from 'vitest';
import { MediaGenerationError } from '@social-autopilot/core';
import type { AIProvider } from '../providers/types.js';
import { AiSvgCoverMediaGenerator } from './affiliate-cover-media-generator.js';

const content = {
  id: 'c1',
  userId: 'user-1',
  title: 'You need this gadget',
  body: 'Script\n\nCaption\n\nCTA',
  status: 'draft' as const,
  contentType: 'video' as const,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

function mockProvider(): AIProvider {
  return {
    name: 'mock',
    generateText: vi.fn(),
    generateStructured: vi.fn(async () => ({
      headline: 'You need this gadget',
      subtitle: 'Affiliate pick of the week',
      backgroundColor: '#1A1A2E',
      textColor: '#FFFFFF',
    })) as AIProvider['generateStructured'],
  };
}

describe('AiSvgCoverMediaGenerator', () => {
  it('generates an SVG image from content context', async () => {
    const generator = new AiSvgCoverMediaGenerator(mockProvider());
    const result = await generator.generate({ content });

    expect(result.mediaType).toBe('image');
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.body.byteLength).toBeGreaterThan(0);
    const text = new TextDecoder().decode(result.body);
    expect(text).toContain('<svg');
    expect(text).toContain('You need this gadget');
  });

  it('includes product context in the AI prompt', async () => {
    const ai = mockProvider();
    const generator = new AiSvgCoverMediaGenerator(ai);
    await generator.generate({
      content,
      productTitle: 'Wireless earbuds',
      productImageUrl: 'https://example.com/p.jpg',
    });

    const call = vi.mocked(ai.generateStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('Wireless earbuds');
    expect(call?.prompt).toContain('https://example.com/p.jpg');
  });

  it('maps timeouts to MediaGenerationError', async () => {
    const ai: AIProvider = {
      name: 'mock',
      generateText: vi.fn(),
      generateStructured: vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  headline: 'late',
                  subtitle: 'late',
                  backgroundColor: '#000000',
                  textColor: '#FFFFFF',
                }),
              50,
            );
          }),
      ) as AIProvider['generateStructured'],
    };
    const generator = new AiSvgCoverMediaGenerator(ai, 10);
    await expect(generator.generate({ content })).rejects.toMatchObject({
      kind: 'timeout',
    });
  });

  it('maps invalid AI output', async () => {
    const ai: AIProvider = {
      name: 'mock',
      generateText: vi.fn(),
      generateStructured: vi.fn(async () => {
        throw new MediaGenerationError('bad', 'invalid');
      }),
    };
    const generator = new AiSvgCoverMediaGenerator(ai);
    await expect(generator.generate({ content })).rejects.toBeInstanceOf(MediaGenerationError);
  });
});
