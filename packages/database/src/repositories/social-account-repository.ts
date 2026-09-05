import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { SocialAccount, SocialAccountRepository } from '@social-autopilot/core';
import type { SocialPlatform, SocialAccountStatus } from '@social-autopilot/core';
import { socialAccounts } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function mapSocialAccount(row: typeof socialAccounts.$inferSelect): SocialAccount {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform as SocialPlatform,
    externalAccountId: row.externalAccountId,
    displayName: row.displayName,
    accessTokenRef: row.accessTokenRef,
    refreshTokenRef: row.refreshTokenRef,
    tokenExpiresAt: row.tokenExpiresAt,
    metadata: row.metadata ?? {},
    status: row.status as SocialAccountStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleSocialAccountRepository implements SocialAccountRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async findById(id: string): Promise<SocialAccount | null> {
    const rows = await this.db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.id, id))
      .limit(1);
    return rows[0] ? mapSocialAccount(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<SocialAccount[]> {
    const rows = await this.db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, userId));
    return rows.map(mapSocialAccount);
  }
}
