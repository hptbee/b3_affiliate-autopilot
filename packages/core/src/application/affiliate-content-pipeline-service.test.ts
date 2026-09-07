import { describe, expect, it, vi } from 'vitest';
import type { Content } from '../domain/content.js';
import type { MediaAsset } from '../domain/media.js';
import { AffiliateContentPipelineService } from './affiliate-content-pipeline-service.js';
import type { AffiliateContentService } from './affiliate-content-service.js';
import type { AffiliateProductSelectionService } from './affiliate-product-selection-service.js';
import type { MediaService } from './media-service.js';
import type { EligibleAffiliateProduct } from './affiliate-product-selection-service.js';
import type { Product } from '../domain/product.js';
import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import { MediaGenerationError } from '../types/errors.js';

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
  productUrl: 'https://shopee.vn/widget',
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
  commissionRate: null,
  createdAt: new Date(),
  expiresAt: null,
};

const candidate: EligibleAffiliateProduct = { product, offer };

const content: Content = {
  id: 'c1',
  userId: 'user-1',
  title: 'Hook',
  body: 'Body https://shope.ee/w',
  status: 'draft',
  contentType: 'video',
  metadata: {
    productId: 'p1',
    affiliateOfferId: 'o1',
    affiliateUrl: 'https://shope.ee/w',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const media: MediaAsset = {
  id: 'm1',
  contentId: 'c1',
  bucket: 'b',
  key: 'k',
  mediaType: 'image',
  mimeType: 'image/svg+xml',
  size: 10,
  duration: null,
  metadata: {},
  createdAt: new Date(),
};

function createPipeline(options?: {
  duplicate?: boolean;
  mediaError?: boolean;
  contentError?: boolean;
}) {
  const selectionService = {
    selectEligible: vi.fn(async () => (options?.duplicate ? [] : [candidate])),
    hasRecentContent: vi.fn(async () => options?.duplicate ?? false),
  } as unknown as AffiliateProductSelectionService;

  const affiliateContentService = {
    generateDraft: vi.fn(async () => {
      if (options?.contentError) throw new Error('AI failed');
      return {
        content,
        draft: { copy: { hook: 'h', script: 's', caption: 'c', cta: 'cta', hashtags: [] }, qualityScore: 1 },
        productId: 'p1',
        affiliateOfferId: 'o1',
      };
    }),
  } as unknown as AffiliateContentService;

  const mediaService = {
    generateForContent: vi.fn(async () => {
      if (options?.mediaError) throw new MediaGenerationError('Media failed', 'generation');
      return media;
    }),
  } as unknown as MediaService;

  const pipeline = new AffiliateContentPipelineService(
    selectionService,
    affiliateContentService,
    mediaService,
  );

  return { pipeline, selectionService, affiliateContentService, mediaService };
}

describe('AffiliateContentPipelineService', () => {
  it('creates draft content and media for selected products', async () => {
    const { pipeline, affiliateContentService, mediaService } = createPipeline();
    const result = await pipeline.run(user, { limit: 1 });

    expect(result.created).toBe(1);
    expect(result.items[0]).toMatchObject({
      status: 'created',
      contentId: 'c1',
      mediaId: 'm1',
    });
    expect(affiliateContentService.generateDraft).toHaveBeenCalledOnce();
    expect(mediaService.generateForContent).toHaveBeenCalledOnce();
  });

  it('records failures without aborting the whole run', async () => {
    const { pipeline } = createPipeline({ contentError: true });
    const result = await pipeline.run(user, { limit: 1 });

    expect(result.created).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.items[0].status).toBe('failed');
  });

  it('can skip media generation when disabled', async () => {
    const { pipeline, mediaService } = createPipeline();
    const result = await pipeline.run(user, { limit: 1, generateMedia: false });

    expect(result.created).toBe(1);
    expect(result.items[0].mediaId).toBeUndefined();
    expect(mediaService.generateForContent).not.toHaveBeenCalled();
  });
});
