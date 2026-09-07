import type {
  PostEngagementMetrics,
  PostMetricSnapshot,
  PostPublication,
  PostPublicationWithLatestMetrics,
} from '@social-autopilot/core';
import type {
  PostMetricSnapshotRepository,
  PostPublicationRepository,
  PublishedPostSourceRepository,
  PublishedScheduledPostCandidate,
} from '@social-autopilot/core';
import { parseAffiliateContentMetadata } from '@social-autopilot/core';
import type { ScheduledPost, SocialPlatform } from '@social-autopilot/core';
import {
  contents,
  postMetricSnapshots,
  postPublications,
  scheduledPosts,
  socialAccounts,
} from '../schema/index.js';
import type * as schema from '../schema/index.js';
import { and, desc, eq, isNotNull, lt, notExists, or, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

function mapPublication(row: typeof postPublications.$inferSelect): PostPublication {
  return {
    id: row.id,
    scheduledPostId: row.scheduledPostId,
    contentId: row.contentId,
    socialAccountId: row.socialAccountId,
    platform: row.platform as SocialPlatform,
    externalPostId: row.externalPostId,
    productId: row.productId,
    affiliateOfferId: row.affiliateOfferId,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMetrics(row: typeof postMetricSnapshots.$inferSelect): PostEngagementMetrics {
  return {
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    reactions: row.reactions,
    comments: row.comments,
    shares: row.shares,
    engagements: row.engagements,
  };
}

function mapSnapshot(row: typeof postMetricSnapshots.$inferSelect): PostMetricSnapshot {
  return {
    id: row.id,
    publicationId: row.publicationId,
    fetchedAt: row.fetchedAt,
    metrics: mapMetrics(row),
    rawMetrics: row.rawMetrics ?? null,
    fetchError: row.fetchError,
    createdAt: row.createdAt,
  };
}

function mapScheduledPost(row: typeof scheduledPosts.$inferSelect): ScheduledPost {
  return {
    id: row.id,
    contentId: row.contentId,
    socialAccountId: row.socialAccountId,
    scheduledAt: row.scheduledAt,
    status: row.status as ScheduledPost['status'],
    publishedAt: row.publishedAt,
    externalPostId: row.externalPostId,
    error: row.error,
    retryCount: row.retryCount,
    queuedAt: row.queuedAt,
    publishingStartedAt: row.publishingStartedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePostPublicationRepository implements PostPublicationRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(
    input: Omit<PostPublication, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PostPublication> {
    const now = new Date();
    const id = crypto.randomUUID();

    await this.db.insert(postPublications).values({
      id,
      scheduledPostId: input.scheduledPostId,
      contentId: input.contentId,
      socialAccountId: input.socialAccountId,
      platform: input.platform,
      externalPostId: input.externalPostId,
      productId: input.productId,
      affiliateOfferId: input.affiliateOfferId,
      publishedAt: input.publishedAt,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create post publication');
    }
    return created;
  }

  async findById(id: string): Promise<PostPublication | null> {
    const rows = await this.db
      .select()
      .from(postPublications)
      .where(eq(postPublications.id, id))
      .limit(1);
    return rows[0] ? mapPublication(rows[0]) : null;
  }

  async findByScheduledPostId(scheduledPostId: string): Promise<PostPublication | null> {
    const rows = await this.db
      .select()
      .from(postPublications)
      .where(eq(postPublications.scheduledPostId, scheduledPostId))
      .limit(1);
    return rows[0] ? mapPublication(rows[0]) : null;
  }

  async findByContentId(contentId: string): Promise<PostPublicationWithLatestMetrics[]> {
    const rows = await this.db
      .select()
      .from(postPublications)
      .where(eq(postPublications.contentId, contentId))
      .orderBy(desc(postPublications.publishedAt));

    return Promise.all(rows.map((row) => this.withLatestSnapshot(mapPublication(row))));
  }

  async findByProductId(productId: string): Promise<PostPublicationWithLatestMetrics[]> {
    const rows = await this.db
      .select()
      .from(postPublications)
      .where(eq(postPublications.productId, productId))
      .orderBy(desc(postPublications.publishedAt));

    return Promise.all(rows.map((row) => this.withLatestSnapshot(mapPublication(row))));
  }

  async findByUserId(userId: string): Promise<PostPublicationWithLatestMetrics[]> {
    const rows = await this.db
      .select({ publication: postPublications })
      .from(postPublications)
      .innerJoin(contents, eq(postPublications.contentId, contents.id))
      .where(eq(contents.userId, userId))
      .orderBy(desc(postPublications.publishedAt));

    return Promise.all(
      rows.map((row) => this.withLatestSnapshot(mapPublication(row.publication))),
    );
  }

  async findDueForRefresh(now: Date, staleAfterMs: number, limit: number): Promise<PostPublication[]> {
    const staleBefore = new Date(now.getTime() - staleAfterMs);

    const rows = await this.db
      .select({
        publication: postPublications,
        latestFetchedAt: sql<Date | null>`(
          SELECT MAX(${postMetricSnapshots.fetchedAt})
          FROM ${postMetricSnapshots}
          WHERE ${postMetricSnapshots.publicationId} = ${postPublications.id}
        )`,
      })
      .from(postPublications)
      .where(
        or(
          sql`(
            SELECT MAX(${postMetricSnapshots.fetchedAt})
            FROM ${postMetricSnapshots}
            WHERE ${postMetricSnapshots.publicationId} = ${postPublications.id}
          ) IS NULL`,
          lt(
            sql`(
              SELECT MAX(${postMetricSnapshots.fetchedAt})
              FROM ${postMetricSnapshots}
              WHERE ${postMetricSnapshots.publicationId} = ${postPublications.id}
            )`,
            staleBefore,
          ),
        ),
      )
      .orderBy(desc(postPublications.publishedAt))
      .limit(limit);

    return rows.map((row) => mapPublication(row.publication));
  }

  private async withLatestSnapshot(
    publication: PostPublication,
  ): Promise<PostPublicationWithLatestMetrics> {
    const rows = await this.db
      .select()
      .from(postMetricSnapshots)
      .where(eq(postMetricSnapshots.publicationId, publication.id))
      .orderBy(desc(postMetricSnapshots.fetchedAt))
      .limit(1);

    return {
      ...publication,
      latestSnapshot: rows[0] ? mapSnapshot(rows[0]) : null,
    };
  }
}

export class DrizzlePostMetricSnapshotRepository implements PostMetricSnapshotRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(input: {
    publicationId: string;
    fetchedAt: Date;
    metrics: PostEngagementMetrics;
    rawMetrics: Record<string, unknown> | null;
    fetchError: string | null;
  }): Promise<PostMetricSnapshot> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.db.insert(postMetricSnapshots).values({
      id,
      publicationId: input.publicationId,
      fetchedAt: input.fetchedAt,
      impressions: input.metrics.impressions,
      reach: input.metrics.reach,
      clicks: input.metrics.clicks,
      reactions: input.metrics.reactions,
      comments: input.metrics.comments,
      shares: input.metrics.shares,
      engagements: input.metrics.engagements,
      rawMetrics: input.rawMetrics,
      fetchError: input.fetchError,
      createdAt: now,
    });

    const rows = await this.db
      .select()
      .from(postMetricSnapshots)
      .where(eq(postMetricSnapshots.id, id))
      .limit(1);

    if (!rows[0]) {
      throw new Error('Failed to create post metric snapshot');
    }

    return mapSnapshot(rows[0]);
  }

  async findLatestByPublicationId(publicationId: string): Promise<PostMetricSnapshot | null> {
    const rows = await this.db
      .select()
      .from(postMetricSnapshots)
      .where(eq(postMetricSnapshots.publicationId, publicationId))
      .orderBy(desc(postMetricSnapshots.fetchedAt))
      .limit(1);

    return rows[0] ? mapSnapshot(rows[0]) : null;
  }
}

export class DrizzlePublishedPostSourceRepository implements PublishedPostSourceRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async findPublishedWithoutPublication(limit: number): Promise<PublishedScheduledPostCandidate[]> {
    const rows = await this.db
      .select({
        scheduledPost: scheduledPosts,
        content: contents,
        socialAccount: socialAccounts,
      })
      .from(scheduledPosts)
      .innerJoin(contents, eq(scheduledPosts.contentId, contents.id))
      .innerJoin(socialAccounts, eq(scheduledPosts.socialAccountId, socialAccounts.id))
      .where(
        and(
          eq(scheduledPosts.status, 'published'),
          isNotNull(scheduledPosts.externalPostId),
          notExists(
            this.db
              .select({ id: postPublications.id })
              .from(postPublications)
              .where(eq(postPublications.scheduledPostId, scheduledPosts.id)),
          ),
        ),
      )
      .orderBy(desc(scheduledPosts.publishedAt))
      .limit(limit);

    return rows.map((row) => {
      const affiliateMeta = parseAffiliateContentMetadata(row.content.metadata);
      const scheduledPost = mapScheduledPost(row.scheduledPost);

      return {
        scheduledPost,
        contentId: row.scheduledPost.contentId,
        socialAccountId: row.scheduledPost.socialAccountId,
        platform: row.socialAccount.platform as SocialPlatform,
        externalPostId: row.scheduledPost.externalPostId!,
        publishedAt: row.scheduledPost.publishedAt ?? row.scheduledPost.updatedAt,
        productId: affiliateMeta?.productId ?? null,
        affiliateOfferId: affiliateMeta?.affiliateOfferId ?? null,
      };
    });
  }
}
