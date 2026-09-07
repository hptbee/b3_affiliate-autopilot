import { describe, expect, it, vi } from 'vitest';
import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import type { Product } from '../domain/product.js';
import type { Content } from '../domain/content.js';
import type { AffiliateContentGenerator, GeneratedAffiliateContentDraft } from '../types/affiliate-content.js';
import { AIProviderError, ValidationError } from '../types/errors.js';
import { AffiliateContentService } from './affiliate-content-service.js';
import type { ContentService } from './content-service.js';
import type { ProductService } from './product-service.js';

const user = { userId: 'user-1' };

const product: Product = {
  id: 'p1',
  userId: 'user-1',
  provider: 'shopee',
  externalProductId: '11',
  title: 'Widget',
  description: null,
  price: '1000',
  originalPrice: null,
  rating: null,
  salesCount: null,
  images: [],
  productUrl: 'https://shopee.vn/widget-i.1.11',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const offer: AffiliateOffer = {
  id: 'o1',
  userId: 'user-1',
  productId: 'p1',
  provider: 'shopee',
  affiliateUrl: 'https://shope.ee/w',
  trackingCode: null,
  commissionRate: '0.05',
  createdAt: new Date(),
  expiresAt: null,
};

const draft: GeneratedAffiliateContentDraft = {
  copy: {
    hook: 'You need this',
    script: 'Full script',
    caption: 'Caption here',
    cta: 'Shop: https://shope.ee/w',
    hashtags: ['deal'],
  },
  qualityScore: 0.85,
};

function createMocks(options?: { offers?: AffiliateOffer[] }) {
  const productService = {
    getById: vi.fn(async () => product),
    getOfferById: vi.fn(async () => offer),
    listOffers: vi.fn(async () => options?.offers ?? [offer]),
  } as unknown as ProductService;

  const createdContent: Content = {
    id: 'c1',
    userId: 'user-1',
    title: draft.copy.hook,
    body: 'persisted body',
    status: 'draft',
    contentType: 'video',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const contentService = {
    create: vi.fn(async () => createdContent),
  } as unknown as ContentService;

  const generator: AffiliateContentGenerator = {
    generate: vi.fn(async () => draft),
  };

  return { productService, contentService, generator, createdContent };
}

describe('AffiliateContentService', () => {
  it('generates and persists draft content from product + offer', async () => {
    const { productService, contentService, generator } = createMocks();
    const service = new AffiliateContentService(productService, contentService, generator);

    const result = await service.generateDraft(user, { productId: 'p1' });

    expect(productService.getById).toHaveBeenCalledWith(user, 'p1');
    expect(generator.generate).toHaveBeenCalledWith({
      product,
      offer,
      tone: undefined,
      language: undefined,
    });
    expect(contentService.create).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        title: 'You need this',
        contentType: 'video',
        metadata: {
          productId: 'p1',
          affiliateOfferId: 'o1',
          affiliateUrl: 'https://shope.ee/w',
        },
      }),
    );
    expect(result.content.status).toBe('draft');
    expect(result.affiliateOfferId).toBe('o1');
    expect(result.draft.copy.cta).toContain('shope.ee');
  });

  it('uses a specific affiliate offer when provided', async () => {
    const { productService, contentService, generator } = createMocks();
    const service = new AffiliateContentService(productService, contentService, generator);

    await service.generateDraft(user, { productId: 'p1', affiliateOfferId: 'o1', tone: 'casual' });

    expect(productService.getOfferById).toHaveBeenCalledWith(user, 'p1', 'o1');
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'casual' }),
    );
  });

  it('rejects when the product has no affiliate offers', async () => {
    const { productService, contentService, generator } = createMocks({ offers: [] });
    const service = new AffiliateContentService(productService, contentService, generator);

    await expect(service.generateDraft(user, { productId: 'p1' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(contentService.create).not.toHaveBeenCalled();
  });

  it('propagates AI provider failures', async () => {
    const { productService, contentService } = createMocks();
    const generator: AffiliateContentGenerator = {
      generate: vi.fn(async () => {
        throw new AIProviderError('AI unavailable');
      }),
    };
    const service = new AffiliateContentService(productService, contentService, generator);

    await expect(service.generateDraft(user, { productId: 'p1' })).rejects.toBeInstanceOf(
      AIProviderError,
    );
    expect(contentService.create).not.toHaveBeenCalled();
  });
});
