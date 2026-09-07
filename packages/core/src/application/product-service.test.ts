import { describe, expect, it } from 'vitest';
import type { DiscoveredProduct, Product } from '../domain/product.js';
import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import type { AffiliateNetwork } from '../types/affiliate.js';
import { ProductService } from './product-service.js';
import type { AffiliateOfferRepository, ProductRepository } from './product-service.js';
import { AffiliateProviderError } from '../types/errors.js';

const user = { userId: 'user-1' };
const other = { userId: 'user-2' };

function discovered(overrides: Partial<DiscoveredProduct> = {}): DiscoveredProduct {
  return {
    provider: 'shopee',
    externalProductId: '11',
    title: 'Widget',
    description: null,
    price: '1000',
    originalPrice: null,
    rating: 4.5,
    salesCount: 10,
    images: ['https://cf.shopee.vn/file/w.jpg'],
    productUrl: 'https://shopee.vn/widget-i.1.11',
    affiliateUrl: 'https://shope.ee/offer',
    commissionRate: '0.05',
    offerExpiresAt: null,
    metadata: { shopId: '1' },
    ...overrides,
  };
}

function createRepos() {
  const products = new Map<string, Product>();
  const offers = new Map<string, AffiliateOffer>();
  let n = 0;

  const productRepository: ProductRepository = {
    async create(input) {
      const row: Product = {
        ...input,
        id: `p-${++n}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      products.set(row.id, row);
      return row;
    },
    async update(id, input) {
      const existing = products.get(id)!;
      const updated = { ...existing, ...input, updatedAt: new Date() };
      products.set(id, updated);
      return updated;
    },
    async findById(id) {
      return products.get(id) ?? null;
    },
    async findByUserId(userId) {
      return [...products.values()].filter((p) => p.userId === userId);
    },
    async findByProviderExternalId(userId, provider, externalProductId) {
      return (
        [...products.values()].find(
          (p) =>
            p.userId === userId &&
            p.provider === provider &&
            p.externalProductId === externalProductId,
        ) ?? null
      );
    },
  };

  const offerRepository: AffiliateOfferRepository = {
    async create(input) {
      const row: AffiliateOffer = {
        ...input,
        id: `o-${++n}`,
        createdAt: new Date(),
      };
      offers.set(row.id, row);
      return row;
    },
    async findById(id) {
      return offers.get(id) ?? null;
    },
    async findByProductId(productId) {
      return [...offers.values()].filter((o) => o.productId === productId);
    },
    async findByUserId(userId) {
      return [...offers.values()].filter((o) => o.userId === userId);
    },
    async findByProductAndUrl(productId, affiliateUrl) {
      return (
        [...offers.values()].find(
          (o) => o.productId === productId && o.affiliateUrl === affiliateUrl,
        ) ?? null
      );
    },
  };

  return { productRepository, offerRepository, products, offers };
}

function mockNetwork(items: DiscoveredProduct[]): AffiliateNetwork {
  return {
    provider: 'shopee',
    async searchProducts() {
      return items;
    },
    async createAffiliateLink(input) {
      return {
        affiliateUrl: `https://shope.ee/generated?u=${encodeURIComponent(input.productUrl)}`,
        trackingCode: input.trackingCodes?.join(',') ?? null,
      };
    },
  };
}

describe('ProductService', () => {
  it('imports a discovered product and persists a separate affiliate offer', async () => {
    const { productRepository, offerRepository } = createRepos();
    const service = new ProductService(productRepository, offerRepository, mockNetwork([discovered()]));
    const result = await service.importProduct(user, { keyword: 'widget' });
    expect(result.product.externalProductId).toBe('11');
    expect(result.product.productUrl).toContain('shopee.vn');
    expect(result.offer?.affiliateUrl).toBe('https://shope.ee/offer');
    expect(result.offer?.affiliateUrl).not.toBe(result.product.productUrl);
    expect(result.offer?.commissionRate).toBe('0.05');
  });

  it('upserts on provider + externalProductId for the same owner', async () => {
    const { productRepository, offerRepository } = createRepos();
    const service = new ProductService(productRepository, offerRepository, mockNetwork([discovered()]));
    const first = await service.importProduct(user, { externalProductId: '11' });
    const second = await service.importProduct(
      user,
      { externalProductId: '11' },
    );
    expect(second.product.id).toBe(first.product.id);
    const listed = await service.list(user);
    expect(listed).toHaveLength(1);
    const offers = await service.listOffers(user, first.product.id);
    expect(offers).toHaveLength(1);
    expect(offers[0].affiliateUrl).not.toBe(first.product.productUrl);
  });

  it('scopes products to the owner', async () => {
    const { productRepository, offerRepository } = createRepos();
    const service = new ProductService(productRepository, offerRepository, mockNetwork([discovered()]));
    const imported = await service.importProduct(user, { keyword: 'widget' });
    await expect(service.getById(other, imported.product.id)).rejects.toThrow('Product not found');
    expect(await service.list(other)).toHaveLength(0);
  });

  it('does not reuse another user product identity', async () => {
    const { productRepository, offerRepository } = createRepos();
    const service = new ProductService(productRepository, offerRepository, mockNetwork([discovered()]));
    const first = await service.importProduct(user, { externalProductId: '11' });
    const second = await service.importProduct(other, { externalProductId: '11' });
    expect(second.product.id).not.toBe(first.product.id);
    expect(second.product.userId).toBe(other.userId);
  });

  it('creates an additional tracked offer without replacing productUrl', async () => {
    const { productRepository, offerRepository } = createRepos();
    const service = new ProductService(productRepository, offerRepository, mockNetwork([discovered()]));
    const imported = await service.importProduct(user, { keyword: 'widget' });
    const extra = await service.createOffer(user, imported.product.id, ['fb']);
    expect(extra.trackingCode).toBe('fb');
    expect(extra.affiliateUrl).not.toBe(imported.product.productUrl);
    const offers = await service.listOffers(user, imported.product.id);
    expect(offers.length).toBeGreaterThanOrEqual(2);
  });

  it('fails when the provider finds nothing', async () => {
    const { productRepository, offerRepository } = createRepos();
    const service = new ProductService(productRepository, offerRepository, mockNetwork([]));
    await expect(service.importProduct(user, { keyword: 'nope' })).rejects.toBeInstanceOf(
      AffiliateProviderError,
    );
  });
});
