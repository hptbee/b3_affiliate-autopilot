function generateId(): string {
  return crypto.randomUUID();
}
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  ScheduledPost,
  ScheduledPostStatus,
  CreateScheduledPostInput,
  ScheduledPostRepository,
} from '@social-autopilot/core';
import { contents, scheduledPosts } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function mapScheduledPost(row: typeof scheduledPosts.$inferSelect): ScheduledPost {
  return {
    id: row.id,
    contentId: row.contentId,
    socialAccountId: row.socialAccountId,
    scheduledAt: row.scheduledAt,
    status: row.status as ScheduledPostStatus,
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

export class DrizzleScheduledPostRepository implements ScheduledPostRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(input: CreateScheduledPostInput): Promise<ScheduledPost> {
    const now = new Date();
    const row = {
      id: generateId(),
      contentId: input.contentId,
      socialAccountId: input.socialAccountId,
      scheduledAt: input.scheduledAt,
      status: 'scheduled' as const,
      publishedAt: null,
      externalPostId: null,
      error: null,
      retryCount: 0,
      queuedAt: null,
      publishingStartedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(scheduledPosts).values(row);
    return mapScheduledPost(row);
  }

  async findById(id: string): Promise<ScheduledPost | null> {
    const rows = await this.db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, id))
      .limit(1);
    return rows[0] ? mapScheduledPost(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<ScheduledPost[]> {
    const rows = await this.db
      .select({ post: scheduledPosts })
      .from(scheduledPosts)
      .innerJoin(contents, eq(scheduledPosts.contentId, contents.id))
      .where(eq(contents.userId, userId));
    return rows.map((row) => mapScheduledPost(row.post));
  }

  async findByContentId(contentId: string): Promise<ScheduledPost[]> {
    const rows = await this.db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.contentId, contentId));
    return rows.map(mapScheduledPost);
  }

  async findDue(now: Date): Promise<ScheduledPost[]> {
    const rows = await this.db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          inArray(scheduledPosts.status, ['scheduled', 'failed']),
          lte(scheduledPosts.scheduledAt, now),
        ),
      );
    return rows.map(mapScheduledPost);
  }

  async cancel(id: string): Promise<ScheduledPost> {
    const now = new Date();
    await this.db
      .update(scheduledPosts)
      .set({ status: 'cancelled', updatedAt: now })
      .where(eq(scheduledPosts.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`ScheduledPost not found after cancel: ${id}`);
    return updated;
  }

  async claimForQueue(id: string, now: Date): Promise<boolean> {
    const result = await this.db
      .update(scheduledPosts)
      .set({ queuedAt: now, updatedAt: now })
      .where(
        and(
          eq(scheduledPosts.id, id),
          inArray(scheduledPosts.status, ['scheduled', 'failed']),
        ),
      );
    return (result.meta?.changes ?? 0) > 0;
  }

  async acquirePublishingLock(id: string, now: Date): Promise<boolean> {
    const result = await this.db
      .update(scheduledPosts)
      .set({
        status: 'publishing',
        publishingStartedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(scheduledPosts.id, id),
          isNull(scheduledPosts.externalPostId),
          or(eq(scheduledPosts.status, 'scheduled'), eq(scheduledPosts.status, 'failed')),
        ),
      );
    return (result.meta?.changes ?? 0) > 0;
  }

  async markPublished(id: string, externalPostId: string): Promise<ScheduledPost> {
    const now = new Date();
    await this.db
      .update(scheduledPosts)
      .set({
        status: 'published',
        externalPostId,
        publishedAt: now,
        error: null,
        updatedAt: now,
      })
      .where(eq(scheduledPosts.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`ScheduledPost not found after publish: ${id}`);
    return updated;
  }

  async markFailed(id: string, error: string): Promise<ScheduledPost> {
    return this.setStatus(id, 'failed', error, true);
  }

  async markUncertain(id: string, error: string): Promise<ScheduledPost> {
    return this.setStatus(id, 'uncertain', error, false);
  }

  async markDead(id: string, error: string): Promise<ScheduledPost> {
    return this.setStatus(id, 'dead', error, false);
  }

  async reclaimStalePublishing(now: Date, leaseMs: number): Promise<number> {
    const cutoff = new Date(now.getTime() - leaseMs);
    const result = await this.db
      .update(scheduledPosts)
      .set({
        status: 'failed',
        error: 'Publishing lease expired',
        retryCount: sql`${scheduledPosts.retryCount} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(scheduledPosts.status, 'publishing'),
          isNull(scheduledPosts.externalPostId),
          or(
            isNull(scheduledPosts.publishingStartedAt),
            lte(scheduledPosts.publishingStartedAt, cutoff),
          ),
        ),
      );
    return result.meta?.changes ?? 0;
  }

  private async setStatus(
    id: string,
    status: ScheduledPostStatus,
    error: string,
    incrementRetry: boolean,
  ): Promise<ScheduledPost> {
    const now = new Date();
    const existing = await this.findById(id);
    if (!existing) throw new Error(`ScheduledPost not found: ${id}`);

    await this.db
      .update(scheduledPosts)
      .set({
        status,
        error,
        retryCount: incrementRetry ? existing.retryCount + 1 : existing.retryCount,
        updatedAt: now,
      })
      .where(eq(scheduledPosts.id, id));

    const updated = await this.findById(id);
    if (!updated) throw new Error(`ScheduledPost not found after status change: ${id}`);
    return updated;
  }
}
