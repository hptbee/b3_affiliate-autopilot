function generateId(): string {
  return crypto.randomUUID();
}
import { and, eq, inArray, lte, or } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  ScheduledPost,
  ScheduledPostStatus,
  CreateScheduledPostInput,
  ScheduledPostRepository,
} from '@social-autopilot/core';
import { scheduledPosts } from '../schema/index.js';
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

  async findAll(): Promise<ScheduledPost[]> {
    const rows = await this.db.select().from(scheduledPosts);
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

  async acquirePublishingLock(id: string): Promise<boolean> {
    const now = new Date();
    const result = await this.db
      .update(scheduledPosts)
      .set({ status: 'publishing', updatedAt: now })
      .where(
        and(
          eq(scheduledPosts.id, id),
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
    const now = new Date();
    const existing = await this.findById(id);
    if (!existing) throw new Error(`ScheduledPost not found: ${id}`);

    await this.db
      .update(scheduledPosts)
      .set({
        status: 'failed',
        error,
        retryCount: existing.retryCount + 1,
        updatedAt: now,
      })
      .where(eq(scheduledPosts.id, id));

    const updated = await this.findById(id);
    if (!updated) throw new Error(`ScheduledPost not found after failure: ${id}`);
    return updated;
  }
}
