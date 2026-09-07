function generateId(): string {
  return crypto.randomUUID();
}
import { and, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { AffiliateOffer, AffiliateOfferRepository } from '@social-autopilot/core';
import { affiliateOffers } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function mapOffer(row: typeof affiliateOffers.$inferSelect): AffiliateOffer {
  return {
    id: row.id,
    userId: row.userId,
    productId: row.productId,
    provider: row.provider as AffiliateOffer['provider'],
    affiliateUrl: row.affiliateUrl,
    trackingCode: row.trackingCode,
    commissionRate: row.commissionRate,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export class DrizzleAffiliateOfferRepository implements AffiliateOfferRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(input: Omit<AffiliateOffer, 'id' | 'createdAt'>): Promise<AffiliateOffer> {
    const row = {
      id: generateId(),
      userId: input.userId,
      productId: input.productId,
      provider: input.provider,
      affiliateUrl: input.affiliateUrl,
      trackingCode: input.trackingCode,
      commissionRate: input.commissionRate,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
    };
    await this.db.insert(affiliateOffers).values(row);
    return mapOffer(row);
  }

  async findById(id: string): Promise<AffiliateOffer | null> {
    const rows = await this.db
      .select()
      .from(affiliateOffers)
      .where(eq(affiliateOffers.id, id))
      .limit(1);
    return rows[0] ? mapOffer(rows[0]) : null;
  }

  async findByProductId(productId: string): Promise<AffiliateOffer[]> {
    const rows = await this.db
      .select()
      .from(affiliateOffers)
      .where(eq(affiliateOffers.productId, productId));
    return rows.map(mapOffer);
  }

  async findByUserId(userId: string): Promise<AffiliateOffer[]> {
    const rows = await this.db
      .select()
      .from(affiliateOffers)
      .where(eq(affiliateOffers.userId, userId));
    return rows.map(mapOffer);
  }

  async findByProductAndUrl(productId: string, affiliateUrl: string): Promise<AffiliateOffer | null> {
    const rows = await this.db
      .select()
      .from(affiliateOffers)
      .where(
        and(eq(affiliateOffers.productId, productId), eq(affiliateOffers.affiliateUrl, affiliateUrl)),
      )
      .limit(1);
    return rows[0] ? mapOffer(rows[0]) : null;
  }
}
