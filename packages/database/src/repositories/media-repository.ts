import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { MediaAsset, MediaRepository } from '@social-autopilot/core';
import { media } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function mapMedia(row: typeof media.$inferSelect): MediaAsset {
  return {
    id: row.id,
    contentId: row.contentId,
    bucket: row.bucket,
    key: row.key,
    mediaType: row.mediaType as MediaAsset['mediaType'],
    mimeType: row.mimeType,
    size: row.size,
    duration: row.duration,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt,
  };
}

export class DrizzleMediaRepository implements MediaRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(input: Omit<MediaAsset, 'createdAt'>): Promise<MediaAsset> {
    const row = {
      ...input,
      createdAt: new Date(),
    };
    await this.db.insert(media).values(row);
    return mapMedia(row);
  }

  async findById(id: string): Promise<MediaAsset | null> {
    const rows = await this.db.select().from(media).where(eq(media.id, id)).limit(1);
    return rows[0] ? mapMedia(rows[0]) : null;
  }

  async findByContentId(contentId: string): Promise<MediaAsset[]> {
    const rows = await this.db.select().from(media).where(eq(media.contentId, contentId));
    return rows.map(mapMedia);
  }
}
