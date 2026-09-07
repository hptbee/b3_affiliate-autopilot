import { describe, expect, it, vi } from 'vitest';
import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import type { Product } from '../domain/product.js';
import type { Content } from '../domain/content.js';
import { AffiliateProductSelectionService } from './affiliate-product-selection-service.js';
import type { ContentRepository } from './content-service.js';
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
  rating: 4.8,
  salesCount: 100,
  images: [],
  productUrl: 'https://shopee.vn/widget',
  metadata: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

const offer: AffiliateOffer = {
  id: 'o1',
  userId: 'user-1',
  productId: 'p1',
  provider: 'shopee',
  affiliateUrl: 'https://shope.ee/w',
  trackingCode: null,
  commissionRate: '0.1',
  createdAt: new Date(),
  expiresAt: null,
};

function createMocks(options?: { recent?: Content[] }) {
  const productService = {
    list: vi.fn(async () => [product]),
    listOffers: vi.fn(async () => [offer]),
    search: vi.fn(async () => []),
    importProduct: vi.fn(async () => ({ product, offer })),
  } as unknown as ProductService;

  const contentRepository = {
    findRecentByAffiliateOffer: vi.fn(async () => options?.recent ?? []),
  } as unknown as ContentRepository;

  return { productService, contentRepository };
}

describe('AffiliateProductSelectionService', () => {
  it('selects existing products with offers sorted by commission', async () => {
    const { productService, contentRepository } = createMocks();
    const service = new AffiliateProductSelectionService(productService, contentRepository);

    const selected = await service.selectEligible(user, { limit: 1 });

    expect(selected).toHaveLength(1);
    expect(selected[0].product.id).toBe('p1');
    expect(selected[0].offer.id).toBe('o1');
  });

  it('skips products with recent drafts for the same offer', async () => {
    const recent: Content = {
      id: 'c1',
      userId: 'user-1',
      title: 'Old',
      body: 'https://shope.ee/w',
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
    const { productService, contentRepository } = createMocks({ recent: [recent] });
    const service = new AffiliateProductSelectionService(productService, contentRepository);

    const selected = await service.selectEligible(user, { limit: 1 });

    expect(selected).toHaveLength(0);
  });

  it('imports products from keyword search when provided', async () => {
    const { productService, contentRepository } = createMocks();
    vi.mocked(productService.search).mockResolvedValue([
      {
        provider: 'shopee',
        externalProductId: '22',
        title: 'Found',
        description: null,
        price: '10',
        originalPrice: null,
        rating: null,
        salesCount: null,
        images: [],
        productUrl: 'https://shopee.vn/found',
        affiliateUrl: 'https://shope.ee/found',
        commissionRate: null,
        offerExpiresAt: null,
        metadata: {},
      },
    ]);

    const service = new AffiliateProductSelectionService(productService, contentRepository);
    const selected = await service.selectEligible(user, { limit: 1, keyword: 'widget' });

    expect(productService.search).toHaveBeenCalled();
    expect(productService.importProduct).toHaveBeenCalled();
    expect(selected).toHaveLength(1);
  });
});
