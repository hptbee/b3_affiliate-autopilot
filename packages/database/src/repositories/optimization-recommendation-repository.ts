import type {
  OptimizationRecommendation,
  OptimizationRecommendationEvidence,
  OptimizationRecommendationStatus,
} from '@social-autopilot/core';
import type { OptimizationRecommendationRepository } from '@social-autopilot/core';
import { optimizationRecommendations } from '../schema/index.js';
import type * as schema from '../schema/index.js';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

function mapRecommendation(
  row: typeof optimizationRecommendations.$inferSelect,
): OptimizationRecommendation {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as OptimizationRecommendation['type'],
    status: row.status as OptimizationRecommendationStatus,
    title: row.title,
    summary: row.summary,
    rationale: row.rationale,
    priority: row.priority as OptimizationRecommendation['priority'],
    productId: row.productId,
    contentId: row.contentId,
    affiliateOfferId: row.affiliateOfferId,
    evidence: row.evidence as OptimizationRecommendationEvidence,
    aiReasoning: row.aiReasoning,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reviewedAt: row.reviewedAt,
  };
}

export class DrizzleOptimizationRecommendationRepository
  implements OptimizationRecommendationRepository
{
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(
    input: Omit<OptimizationRecommendation, 'id' | 'createdAt' | 'updatedAt' | 'reviewedAt'>,
  ): Promise<OptimizationRecommendation> {
    const now = new Date();
    const id = crypto.randomUUID();

    await this.db.insert(optimizationRecommendations).values({
      id,
      userId: input.userId,
      type: input.type,
      status: input.status,
      title: input.title,
      summary: input.summary,
      rationale: input.rationale,
      priority: input.priority,
      productId: input.productId,
      contentId: input.contentId,
      affiliateOfferId: input.affiliateOfferId,
      evidence: input.evidence as Record<string, unknown>,
      aiReasoning: input.aiReasoning,
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
    });

    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create optimization recommendation');
    }
    return created;
  }

  async findById(id: string): Promise<OptimizationRecommendation | null> {
    const rows = await this.db
      .select()
      .from(optimizationRecommendations)
      .where(eq(optimizationRecommendations.id, id))
      .limit(1);
    return rows[0] ? mapRecommendation(rows[0]) : null;
  }

  async findByUserId(
    userId: string,
    status?: OptimizationRecommendationStatus,
  ): Promise<OptimizationRecommendation[]> {
    const rows = await this.db
      .select()
      .from(optimizationRecommendations)
      .where(
        status
          ? and(
              eq(optimizationRecommendations.userId, userId),
              eq(optimizationRecommendations.status, status),
            )
          : eq(optimizationRecommendations.userId, userId),
      )
      .orderBy(desc(optimizationRecommendations.createdAt));

    return rows.map(mapRecommendation);
  }

  async updateStatus(
    id: string,
    status: OptimizationRecommendationStatus,
    reviewedAt: Date | null,
  ): Promise<OptimizationRecommendation> {
    const now = new Date();
    await this.db
      .update(optimizationRecommendations)
      .set({
        status,
        reviewedAt,
        updatedAt: now,
      })
      .where(eq(optimizationRecommendations.id, id));

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to update optimization recommendation');
    }
    return updated;
  }

  async findPendingDuplicate(input: {
    userId: string;
    type: OptimizationRecommendation['type'];
    productId: string | null;
    contentId: string | null;
    title: string;
  }): Promise<OptimizationRecommendation | null> {
    const rows = await this.db
      .select()
      .from(optimizationRecommendations)
      .where(
        and(
          eq(optimizationRecommendations.userId, input.userId),
          eq(optimizationRecommendations.status, 'pending'),
          eq(optimizationRecommendations.type, input.type),
          eq(optimizationRecommendations.title, input.title),
          input.productId
            ? eq(optimizationRecommendations.productId, input.productId)
            : isNull(optimizationRecommendations.productId),
          input.contentId
            ? eq(optimizationRecommendations.contentId, input.contentId)
            : isNull(optimizationRecommendations.contentId),
        ),
      )
      .limit(1);

    return rows[0] ? mapRecommendation(rows[0]) : null;
  }
}
