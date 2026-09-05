function generateId(): string {
  return crypto.randomUUID();
}
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  Content,
  ContentStatus,
  ContentType,
  ContentRepository,
} from '@social-autopilot/core';
import { contents } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function mapContent(row: typeof contents.$inferSelect): Content {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    body: row.body,
    status: row.status as ContentStatus,
    contentType: row.contentType as ContentType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleContentRepository implements ContentRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(input: {
    userId: string;
    title: string;
    body: string;
    contentType?: ContentType;
  }): Promise<Content> {
    const now = new Date();
    const row = {
      id: generateId(),
      userId: input.userId,
      title: input.title,
      body: input.body,
      status: 'draft' as const,
      contentType: input.contentType ?? 'video',
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(contents).values(row);
    return mapContent(row);
  }

  async findById(id: string): Promise<Content | null> {
    const rows = await this.db.select().from(contents).where(eq(contents.id, id)).limit(1);
    return rows[0] ? mapContent(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Content[]> {
    const rows = await this.db.select().from(contents).where(eq(contents.userId, userId));
    return rows.map(mapContent);
  }

  async update(
    id: string,
    input: { title?: string; body?: string; contentType?: ContentType; status?: ContentStatus },
  ): Promise<Content> {
    const now = new Date();
    await this.db
      .update(contents)
      .set({ ...input, updatedAt: now })
      .where(eq(contents.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Content not found after update: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(contents).where(eq(contents.id, id));
  }
}
