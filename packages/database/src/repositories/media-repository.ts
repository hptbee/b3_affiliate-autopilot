import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Media, MediaRepository } from '@social-autopilot/core';
import type { MediaType } from '@social-autopilot/core';
import { media } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function generateId(): string {
  return crypto.randomUUID();
}

function mapMedia(row: typeof media.$inferSelect): Media {
  return {
    id: row.id,
    contentId: row.contentId,
    bucket: row.bucket,
    key: row.key,
    mediaType: row.mediaType as MediaType,
    mimeType: row.mimeType,
    size: row.size,
    duration: row.duration,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt,
  };
}

export class DrizzleMediaRepository implements MediaRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async findByContentId(contentId: string): Promise<Media | null> {
    const rows = await this.db.select().from(media).where(eq(media.contentId, contentId)).limit(1);
    return rows[0] ? mapMedia(rows[0]) : null;
  }

  async create(input: {
    contentId: string;
    bucket: string;
    key: string;
    mimeType: string;
    size: number;
    duration?: number | null;
  }): Promise<Media> {
    const row = {
      id: generateId(),
      contentId: input.contentId,
      bucket: input.bucket,
      key: input.key,
      mediaType: 'video' as const,
      mimeType: input.mimeType,
      size: input.size,
      duration: input.duration ?? null,
      metadata: {},
      createdAt: new Date(),
    };
    await this.db.insert(media).values(row);
    return mapMedia(row);
  }

  async deleteByContentId(contentId: string): Promise<void> {
    await this.db.delete(media).where(eq(media.contentId, contentId));
  }
}
