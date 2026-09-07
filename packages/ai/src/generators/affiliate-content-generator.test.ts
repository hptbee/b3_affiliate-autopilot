import { describe, expect, it, vi } from 'vitest';
import { AIProviderError } from '@social-autopilot/core';
import type { AIProvider } from '../providers/types.js';
import {
  AiAffiliateContentGenerator,
  DEFAULT_AFFILIATE_CONTENT_TIMEOUT_MS,
} from './affiliate-content-generator.js';

const product = {
  id: 'p1',
  userId: 'user-1',
  provider: 'shopee' as const,
  externalProductId: '11',
  title: 'Wireless earbuds',
  description: 'Noise cancelling',
  price: '500000',
  originalPrice: null,
  rating: 4.5,
  salesCount: 100,
  images: [],
  productUrl: 'https://shopee.vn/earbuds-i.1.11',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const offer = {
  id: 'o1',
  userId: 'user-1',
  productId: 'p1',
  provider: 'shopee' as const,
  affiliateUrl: 'https://shope.ee/offer',
  trackingCode: null,
  commissionRate: '0.05',
  createdAt: new Date(),
  expiresAt: null,
};

function mockProvider(result: unknown): AIProvider {
  return {
    name: 'mock',
    generateText: vi.fn(),
    generateStructured: vi.fn(async () => result) as AIProvider['generateStructured'],
  };
}

describe('AiAffiliateContentGenerator', () => {
  it('generates structured affiliate copy from product and offer', async () => {
    const generator = new AiAffiliateContentGenerator(
      mockProvider({
        hook: 'Wait for this',
        script: 'Script body',
        caption: 'Caption text',
        hashtags: ['deal'],
        cta: 'Shop now: https://shope.ee/offer',
        qualityScore: 0.9,
      }),
    );

    const draft = await generator.generate({ product, offer });

    expect(draft.copy.hook).toBe('Wait for this');
    expect(draft.copy.cta).toContain('shope.ee');
    expect(draft.qualityScore).toBe(0.9);
  });

  it('includes affiliate URL in the AI prompt, not product URL as CTA', async () => {
    const ai = mockProvider({
      hook: 'Hook',
      script: 'Script',
      caption: 'Caption',
      hashtags: [],
      cta: 'Buy',
      qualityScore: 0.5,
    });
    const generator = new AiAffiliateContentGenerator(ai);

    await generator.generate({ product, offer, tone: 'friendly', language: 'vi' });

    const call = vi.mocked(ai.generateStructured).mock.calls[0]?.[0];
    expect(call?.prompt).toContain('Affiliate URL (use in CTA): https://shope.ee/offer');
    expect(call?.prompt).toContain('Product URL (reference only');
    expect(call?.prompt).toContain('Tone: friendly');
    expect(call?.prompt).toContain('Language: vi');
  });

  it('maps AI provider errors', async () => {
    const ai: AIProvider = {
      name: 'mock',
      generateText: vi.fn(),
      generateStructured: vi.fn(async () => {
        throw new AIProviderError('upstream failed');
      }),
    };
    const generator = new AiAffiliateContentGenerator(ai);

    await expect(generator.generate({ product, offer })).rejects.toBeInstanceOf(AIProviderError);
  });

  it('maps timeouts to AIProviderError', async () => {
    const ai: AIProvider = {
      name: 'mock',
      generateText: vi.fn(),
      generateStructured: vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  hook: 'late',
                  script: 's',
                  caption: 'c',
                  hashtags: [],
                  cta: 'cta',
                  qualityScore: 0.1,
                }),
              50,
            );
          }),
      ) as AIProvider['generateStructured'],
    };
    const generator = new AiAffiliateContentGenerator(ai, 10);

    await expect(generator.generate({ product, offer })).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
      message: 'AI content generation timed out',
    });
    expect(DEFAULT_AFFILIATE_CONTENT_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
