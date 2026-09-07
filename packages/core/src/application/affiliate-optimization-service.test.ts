import { describe, expect, it, vi } from 'vitest';
import { AffiliateOptimizationService } from './affiliate-optimization-service.js';
import type { OptimizationRecommendationRepository } from './affiliate-optimization-service.js';
import type { PostPublicationRepository } from './post-analytics-service.js';
import type { ContentRepository } from './content-service.js';
import type { ProductService } from './product-service.js';
import type { OptimizationReasoningProvider } from '../types/optimization.js';
import type { OptimizationRecommendation } from '../domain/optimization.js';
import type { PostPublicationWithLatestMetrics } from '../domain/post-analytics.js';
import type { Content } from '../domain/content.js';
import type { Product } from '../domain/product.js';
import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import { createLogger } from '../types/logger.js';

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
  rating: 4,
  salesCount: 500,
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
  commissionRate: '8',
  createdAt: new Date(),
  expiresAt: null,
};

const content: Content = {
  id: 'c1',
  userId: 'user-1',
  title: 'Hook',
  body: 'Body',
  status: 'approved',
  contentType: 'text',
  metadata: {
    productId: 'p1',
    affiliateOfferId: 'o1',
    affiliateUrl: 'https://shope.ee/w',
    tone: 'energetic',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const publication: PostPublicationWithLatestMetrics = {
  id: 'pub-1',
  scheduledPostId: 'post-1',
  contentId: 'c1',
  socialAccountId: 'account-1',
  platform: 'facebook',
  externalPostId: 'fb-1',
  productId: 'p1',
  affiliateOfferId: 'o1',
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  latestSnapshot: {
    id: 'snap-1',
    publicationId: 'pub-1',
    fetchedAt: new Date(),
    metrics: {
      impressions: 1000,
      reach: null,
      clicks: 80,
      reactions: 40,
      comments: 8,
      shares: 4,
      engagements: 132,
    },
    rawMetrics: null,
    fetchError: null,
    createdAt: new Date(),
  },
};

function createService(options?: { includeReasoning?: boolean }) {
  const stored: OptimizationRecommendation[] = [];

  const recommendationRepository: OptimizationRecommendationRepository = {
    async create(input) {
      const created: OptimizationRecommendation = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedAt: null,
      };
      stored.push(created);
      return created;
    },
    async findById(id) {
      return stored.find((item) => item.id === id) ?? null;
    },
    async findByUserId(userId, status) {
      return stored.filter(
        (item) => item.userId === userId && (!status || item.status === status),
      );
    },
    async updateStatus(id, status, reviewedAt) {
      const item = stored.find((entry) => entry.id === id);
      if (!item) throw new Error('missing');
      item.status = status;
      item.reviewedAt = reviewedAt;
      item.updatedAt = new Date();
      return item;
    },
    async findPendingDuplicate() {
      return null;
    },
  };

  const publicationRepository: PostPublicationRepository = {
    async create() {
      throw new Error('not implemented');
    },
    async findById() {
      return null;
    },
    async findByScheduledPostId() {
      return null;
    },
    async findByContentId() {
      return [publication];
    },
    async findByProductId() {
      return [publication];
    },
    async findByUserId() {
      return [publication];
    },
    async findDueForRefresh() {
      return [];
    },
  };

  const contentRepository: ContentRepository = {
    async findById(id) {
      return id === content.id ? content : null;
    },
    async findByUserId() {
      return [content];
    },
    async findRecentByAffiliateOffer() {
      return [];
    },
    async create() {
      throw new Error('not implemented');
    },
    async update() {
      throw new Error('not implemented');
    },
    async updateStatus() {
      throw new Error('not implemented');
    },
    async delete() {
      throw new Error('not implemented');
    },
  };

  const productService = {
    async list() {
      return [product];
    },
    async listOffers() {
      return [offer];
    },
  } as unknown as ProductService;

  const reasoningProvider: OptimizationReasoningProvider | null = options?.includeReasoning
    ? {
        summarize: vi.fn(async () => ({ reasoning: 'Mock AI summary for reviewer.' })),
      }
    : null;

  const service = new AffiliateOptimizationService(
    recommendationRepository,
    publicationRepository,
    contentRepository,
    productService,
    reasoningProvider,
    createLogger('test'),
  );

  return { service, stored, reasoningProvider };
}

describe('AffiliateOptimizationService', () => {
  it('generates pending recommendations with evidence', async () => {
    const { service, stored } = createService();
    const result = await service.generateRecommendations(user);
    expect(result.created).toBeGreaterThan(0);
    expect(stored.every((item) => item.status === 'pending')).toBe(true);
    expect(stored[0]?.evidence.metrics).toBeDefined();
  });

  it('supports human approval workflow without auto-apply', async () => {
    const { service, stored } = createService();
    await service.generateRecommendations(user);
    const pending = stored[0]!;

    await expect(service.applyRecommendation(user, pending.id)).rejects.toThrow(
      /must be approved/i,
    );

    const approved = await service.approveRecommendation(user, pending.id);
    expect(approved.status).toBe('approved');

    const applied = await service.applyRecommendation(user, pending.id);
    expect(applied.status).toBe('applied');
  });

  it('rejects recommendations without applying them', async () => {
    const { service, stored } = createService();
    await service.generateRecommendations(user);
    const pending = stored[0]!;

    const rejected = await service.rejectRecommendation(user, pending.id);
    expect(rejected.status).toBe('rejected');
  });

  it('optionally attaches AI reasoning without changing recommendations', async () => {
    const { service, stored, reasoningProvider } = createService({ includeReasoning: true });
    await service.generateRecommendations(user, { includeAiReasoning: true });
    expect(reasoningProvider?.summarize).toHaveBeenCalled();
    expect(stored[0]?.aiReasoning).toContain('Mock AI summary');
  });
});
