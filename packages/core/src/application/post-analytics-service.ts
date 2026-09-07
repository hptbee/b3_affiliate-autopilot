import {
  EMPTY_POST_ENGAGEMENT_METRICS,
  type ContentPerformanceSummary,
  type PostEngagementMetrics,
  type PostMetricSnapshot,
  type PostPublication,
  type PostPublicationWithLatestMetrics,
  type ProductPerformanceSummary,
  sumEngagementMetrics,
} from '../domain/post-analytics.js';
import { parseAffiliateContentMetadata } from '../domain/content.js';
import type { ScheduledPost } from '../domain/scheduled-post.js';
import type { SocialAccount, SocialPlatform } from '../domain/social-account.js';
import { NotFoundError } from '../types/errors.js';
import type { Logger } from '../types/logger.js';
import type { PostAnalyticsProvider } from '../types/post-analytics.js';
import type { TokenStore } from '../types/token-store.js';
import type { UserContext } from '../types/user-context.js';
import type { ContentRepository } from './content-service.js';

export interface PublishedScheduledPostCandidate {
  scheduledPost: ScheduledPost;
  contentId: string;
  socialAccountId: string;
  platform: SocialPlatform;
  externalPostId: string;
  publishedAt: Date;
  productId: string | null;
  affiliateOfferId: string | null;
}

export interface PostPublicationRepository {
  create(input: Omit<PostPublication, 'id' | 'createdAt' | 'updatedAt'>): Promise<PostPublication>;
  findById(id: string): Promise<PostPublication | null>;
  findByScheduledPostId(scheduledPostId: string): Promise<PostPublication | null>;
  findByContentId(contentId: string): Promise<PostPublicationWithLatestMetrics[]>;
  findByProductId(productId: string): Promise<PostPublicationWithLatestMetrics[]>;
  findByUserId(userId: string): Promise<PostPublicationWithLatestMetrics[]>;
  findDueForRefresh(now: Date, staleAfterMs: number, limit: number): Promise<PostPublication[]>;
}

export interface PostMetricSnapshotRepository {
  create(input: {
    publicationId: string;
    fetchedAt: Date;
    metrics: PostEngagementMetrics;
    rawMetrics: Record<string, unknown> | null;
    fetchError: string | null;
  }): Promise<PostMetricSnapshot>;
  findLatestByPublicationId(publicationId: string): Promise<PostMetricSnapshot | null>;
}

export interface PublishedPostSourceRepository {
  findPublishedWithoutPublication(limit: number): Promise<PublishedScheduledPostCandidate[]>;
}

export interface SocialAccountLookupRepository {
  findById(id: string): Promise<SocialAccount | null>;
}

export interface PostAnalyticsRefreshResult {
  backfilled: number;
  refreshed: number;
  failed: number;
  skipped: number;
}

export class PostAnalyticsService {
  constructor(
    private readonly publicationRepository: PostPublicationRepository,
    private readonly snapshotRepository: PostMetricSnapshotRepository,
    private readonly publishedPostSourceRepository: PublishedPostSourceRepository,
    private readonly socialAccountRepository: SocialAccountLookupRepository,
    private readonly contentRepository: ContentRepository,
    private readonly providers: Map<SocialPlatform, PostAnalyticsProvider>,
    private readonly tokenStore: TokenStore,
    private readonly logger: Logger,
  ) {}

  async backfillPublications(limit: number): Promise<number> {
    const candidates = await this.publishedPostSourceRepository.findPublishedWithoutPublication(limit);
    let created = 0;

    for (const candidate of candidates) {
      const existing = await this.publicationRepository.findByScheduledPostId(
        candidate.scheduledPost.id,
      );
      if (existing) continue;

      await this.publicationRepository.create({
        scheduledPostId: candidate.scheduledPost.id,
        contentId: candidate.contentId,
        socialAccountId: candidate.socialAccountId,
        platform: candidate.platform,
        externalPostId: candidate.externalPostId,
        productId: candidate.productId,
        affiliateOfferId: candidate.affiliateOfferId,
        publishedAt: candidate.publishedAt,
      });
      created += 1;
    }

    return created;
  }

  async refreshPublication(publication: PostPublication, now: Date): Promise<'refreshed' | 'failed' | 'skipped'> {
    const account = await this.socialAccountRepository.findById(publication.socialAccountId);
    if (!account || account.status !== 'active') {
      this.logger.warn('Skipping analytics refresh for inactive social account', {
        operation: 'postAnalytics.refreshPublication',
        entityId: publication.id,
        socialAccountId: publication.socialAccountId,
      });
      return 'skipped';
    }

    const provider = this.providers.get(publication.platform);
    if (!provider) {
      await this.snapshotRepository.create({
        publicationId: publication.id,
        fetchedAt: now,
        metrics: EMPTY_POST_ENGAGEMENT_METRICS,
        rawMetrics: null,
        fetchError: `No analytics provider configured for platform: ${publication.platform}`,
      });
      return 'failed';
    }

    const accessToken = await this.tokenStore.get(account.accessTokenRef);
    if (!accessToken) {
      await this.snapshotRepository.create({
        publicationId: publication.id,
        fetchedAt: now,
        metrics: EMPTY_POST_ENGAGEMENT_METRICS,
        rawMetrics: null,
        fetchError: 'Social account access token is missing or expired',
      });
      return 'failed';
    }

    try {
      const result = await provider.fetchMetrics({
        externalPostId: publication.externalPostId,
        pageId: account.externalAccountId,
        accessToken,
      });

      await this.snapshotRepository.create({
        publicationId: publication.id,
        fetchedAt: now,
        metrics: result.metrics,
        rawMetrics: result.rawMetrics,
        fetchError: null,
      });

      return 'refreshed';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch post analytics';
      await this.snapshotRepository.create({
        publicationId: publication.id,
        fetchedAt: now,
        metrics: EMPTY_POST_ENGAGEMENT_METRICS,
        rawMetrics: null,
        fetchError: message,
      });

      this.logger.error('Failed to refresh post analytics', {
        operation: 'postAnalytics.refreshPublication',
        entityId: publication.id,
        errorCode: 'POST_ANALYTICS_FETCH_ERROR',
        error: message,
      });

      return 'failed';
    }
  }

  async refreshDuePublications(
    now: Date,
    options: { staleAfterMs: number; limit: number },
  ): Promise<PostAnalyticsRefreshResult> {
    const backfilled = await this.backfillPublications(options.limit);
    const due = await this.publicationRepository.findDueForRefresh(
      now,
      options.staleAfterMs,
      options.limit,
    );

    let refreshed = 0;
    let failed = 0;
    let skipped = 0;

    for (const publication of due) {
      const outcome = await this.refreshPublication(publication, now);
      if (outcome === 'refreshed') refreshed += 1;
      else if (outcome === 'failed') failed += 1;
      else skipped += 1;
    }

    return { backfilled, refreshed, failed, skipped };
  }

  async getContentPerformance(
    user: UserContext,
    contentId: string,
  ): Promise<ContentPerformanceSummary> {
    const content = await this.contentRepository.findById(contentId);
    if (!content || content.userId !== user.userId) {
      throw new NotFoundError('Content', contentId);
    }

    const publications = await this.publicationRepository.findByContentId(contentId);
    const latestMetrics = sumEngagementMetrics(
      publications
        .map((publication) => publication.latestSnapshot?.metrics)
        .filter((metrics): metrics is PostEngagementMetrics => metrics !== undefined && metrics !== null),
    );

    return {
      contentId,
      publicationCount: publications.length,
      latestMetrics,
      publications,
    };
  }

  async getProductPerformance(
    user: UserContext,
    productId: string,
  ): Promise<ProductPerformanceSummary> {
    const publications = await this.publicationRepository.findByProductId(productId);
    const ownedPublications = await this.filterOwnedPublications(user, publications);

    const latestMetrics = sumEngagementMetrics(
      ownedPublications
        .map((publication) => publication.latestSnapshot?.metrics)
        .filter((metrics): metrics is PostEngagementMetrics => metrics !== undefined && metrics !== null),
    );

    return {
      productId,
      publicationCount: ownedPublications.length,
      latestMetrics,
      publications: ownedPublications,
    };
  }

  async resolveAffiliateContext(contentId: string): Promise<{
    productId: string | null;
    affiliateOfferId: string | null;
  }> {
    const content = await this.contentRepository.findById(contentId);
    if (!content) {
      return { productId: null, affiliateOfferId: null };
    }

    const affiliateMeta = parseAffiliateContentMetadata(content.metadata);
    return {
      productId: affiliateMeta?.productId ?? null,
      affiliateOfferId: affiliateMeta?.affiliateOfferId ?? null,
    };
  }

  private async filterOwnedPublications(
    user: UserContext,
    publications: PostPublicationWithLatestMetrics[],
  ): Promise<PostPublicationWithLatestMetrics[]> {
    const owned: PostPublicationWithLatestMetrics[] = [];

    for (const publication of publications) {
      const content = await this.contentRepository.findById(publication.contentId);
      if (content?.userId === user.userId) {
        owned.push(publication);
      }
    }

    return owned;
  }
}
