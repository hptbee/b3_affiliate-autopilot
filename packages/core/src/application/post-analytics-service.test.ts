import { describe, expect, it, vi } from 'vitest';
import { PostAnalyticsService } from './post-analytics-service.js';
import type {
  PostMetricSnapshotRepository,
  PostPublicationRepository,
  PublishedPostSourceRepository,
  SocialAccountLookupRepository,
} from './post-analytics-service.js';
import type { ContentRepository } from './content-service.js';
import type { PostAnalyticsProvider } from '../types/post-analytics.js';
import type { PostEngagementMetrics, PostPublication, PostPublicationWithLatestMetrics } from '../domain/post-analytics.js';
import type { Content } from '../domain/content.js';
import type { SocialAccount } from '../domain/social-account.js';
import { createLogger } from '../types/logger.js';

const user = { userId: 'user-1' };

const publication: PostPublication = {
  id: 'pub-1',
  scheduledPostId: 'post-1',
  contentId: 'content-1',
  socialAccountId: 'account-1',
  platform: 'facebook',
  externalPostId: 'fb-post-1',
  productId: 'product-1',
  affiliateOfferId: 'offer-1',
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const content: Content = {
  id: 'content-1',
  userId: 'user-1',
  title: 'Title',
  body: 'Body',
  status: 'approved',
  contentType: 'text',
  metadata: {
    productId: 'product-1',
    affiliateOfferId: 'offer-1',
    affiliateUrl: 'https://shope.ee/x',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const account: SocialAccount = {
  id: 'account-1',
  userId: 'user-1',
  platform: 'facebook',
  externalAccountId: 'page-1',
  displayName: 'Page',
  accessTokenRef: 'token-ref',
  refreshTokenRef: null,
  tokenExpiresAt: null,
  metadata: {},
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createService(options?: {
  fetchError?: boolean;
  providerMissing?: boolean;
  tokenMissing?: boolean;
}) {
  const publications: PostPublication[] = [];
  const snapshots: Array<{
    publicationId: string;
    fetchedAt: Date;
    metrics: PostEngagementMetrics;
    rawMetrics: Record<string, unknown> | null;
    fetchError: string | null;
  }> = [];

  const publicationRepository: PostPublicationRepository = {
    async create(input) {
      const created = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      publications.push(created);
      return created;
    },
    async findById(id) {
      return publications.find((item) => item.id === id) ?? null;
    },
    async findByScheduledPostId(scheduledPostId) {
      return publications.find((item) => item.scheduledPostId === scheduledPostId) ?? null;
    },
    async findByContentId(contentId) {
      return publications
        .filter((item) => item.contentId === contentId)
        .map((item) => ({
          ...item,
          latestSnapshot: snapshots
            .filter((snapshot) => snapshot.publicationId === item.id)
            .map((snapshot, index) => ({
              id: `snap-${index}`,
              publicationId: snapshot.publicationId,
              fetchedAt: snapshot.fetchedAt,
              metrics: snapshot.metrics,
              rawMetrics: snapshot.rawMetrics,
              fetchError: snapshot.fetchError,
              createdAt: new Date(),
            }))
            .at(-1) ?? null,
        }));
    },
    async findByProductId(productId) {
      return publications
        .filter((item) => item.productId === productId)
        .map((item) => ({
          ...item,
          latestSnapshot: null,
        }));
    },
    async findDueForRefresh() {
      return publications;
    },
    async findByUserId() {
      return publications.map((item) => ({ ...item, latestSnapshot: null }));
    },
  };

  const snapshotRepository: PostMetricSnapshotRepository = {
    async create(input) {
      snapshots.push(input);
      return {
        id: crypto.randomUUID(),
        publicationId: input.publicationId,
        fetchedAt: input.fetchedAt,
        metrics: input.metrics,
        rawMetrics: input.rawMetrics,
        fetchError: input.fetchError,
        createdAt: new Date(),
      };
    },
    async findLatestByPublicationId(publicationId) {
      const latest = snapshots.filter((item) => item.publicationId === publicationId).at(-1);
      if (!latest) return null;
      return {
        id: 'snap-latest',
        publicationId: latest.publicationId,
        fetchedAt: latest.fetchedAt,
        metrics: latest.metrics,
        rawMetrics: latest.rawMetrics,
        fetchError: latest.fetchError,
        createdAt: new Date(),
      };
    },
  };

  const publishedPostSourceRepository: PublishedPostSourceRepository = {
    async findPublishedWithoutPublication() {
      return [
        {
          scheduledPost: {
            id: 'post-1',
            contentId: 'content-1',
            socialAccountId: 'account-1',
            scheduledAt: new Date(),
            status: 'published',
            publishedAt: new Date(),
            externalPostId: 'fb-post-1',
            error: null,
            retryCount: 0,
            queuedAt: null,
            publishingStartedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          contentId: 'content-1',
          socialAccountId: 'account-1',
          platform: 'facebook',
          externalPostId: 'fb-post-1',
          publishedAt: new Date(),
          productId: 'product-1',
          affiliateOfferId: 'offer-1',
        },
      ];
    },
  };

  const socialAccountRepository: SocialAccountLookupRepository = {
    async findById() {
      return account;
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

  const fetchMetrics = vi.fn(async () => {
    if (options?.fetchError) {
      throw new Error('provider failed');
    }
    return {
      metrics: {
        impressions: 42,
        reach: null,
        clicks: 4,
        reactions: 7,
        comments: 1,
        shares: 2,
        engagements: 14,
      },
      rawMetrics: { source: 'facebook' },
    };
  });

  const providers = options?.providerMissing
    ? new Map()
    : new Map([['facebook', { platform: 'facebook', fetchMetrics } as PostAnalyticsProvider]]);

  const tokenStore = {
    async get() {
      return options?.tokenMissing ? null : 'page-token';
    },
    async put() {},
    async delete() {},
  };

  const service = new PostAnalyticsService(
    publicationRepository,
    snapshotRepository,
    publishedPostSourceRepository,
    socialAccountRepository,
    contentRepository,
    providers,
    tokenStore,
    createLogger('test'),
  );

  return { service, fetchMetrics, snapshots, publications };
}

describe('PostAnalyticsService', () => {
  it('backfills publications from published scheduled posts', async () => {
    const { service, publications } = createService();
    const created = await service.backfillPublications(10);
    expect(created).toBe(1);
    expect(publications).toHaveLength(1);
    expect(publications[0]?.externalPostId).toBe('fb-post-1');
  });

  it('refreshes metrics and stores a snapshot', async () => {
    const { service, fetchMetrics, snapshots } = createService();
    const outcome = await service.refreshPublication(publication, new Date('2026-01-02T00:00:00Z'));
    expect(outcome).toBe('refreshed');
    expect(fetchMetrics).toHaveBeenCalledOnce();
    expect(snapshots[0]?.metrics.impressions).toBe(42);
    expect(snapshots[0]?.fetchError).toBeNull();
  });

  it('stores fetch errors without throwing', async () => {
    const { service, snapshots } = createService({ fetchError: true });
    const outcome = await service.refreshPublication(publication, new Date());
    expect(outcome).toBe('failed');
    expect(snapshots[0]?.fetchError).toBe('provider failed');
  });

  it('returns content performance summary', async () => {
    const { service, publications } = createService();
    publications.push(publication);
    const summary = await service.getContentPerformance(user, 'content-1');
    expect(summary.contentId).toBe('content-1');
    expect(summary.publicationCount).toBe(1);
  });

  it('returns product performance summary for owned content only', async () => {
    const { service, publications } = createService();
    publications.push(publication);
    const summary = await service.getProductPerformance(user, 'product-1');
    expect(summary.productId).toBe('product-1');
    expect(summary.publicationCount).toBe(1);
  });
});
