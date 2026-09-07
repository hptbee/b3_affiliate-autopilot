import { and, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  SocialAccount,
  SocialAccountRepository,
  SocialPlatform,
  SocialAccountStatus,
  UpsertSocialAccountInput,
} from '@social-autopilot/core';
import { socialAccounts } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function generateId(): string {
  return crypto.randomUUID();
}

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

  async findByUserPlatformExternal(
    userId: string,
    platform: SocialPlatform,
    externalAccountId: string,
  ): Promise<SocialAccount | null> {
    const rows = await this.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.userId, userId),
          eq(socialAccounts.platform, platform),
          eq(socialAccounts.externalAccountId, externalAccountId),
        ),
      )
      .limit(1);
    return rows[0] ? mapSocialAccount(rows[0]) : null;
  }

  async upsert(input: UpsertSocialAccountInput): Promise<SocialAccount> {
    const existing = await this.findByUserPlatformExternal(
      input.userId,
      input.platform,
      input.externalAccountId,
    );
    const now = new Date();

    if (existing) {
      await this.db
        .update(socialAccounts)
        .set({
          displayName: input.displayName,
          accessTokenRef: input.accessTokenRef,
          refreshTokenRef: input.refreshTokenRef,
          tokenExpiresAt: input.tokenExpiresAt,
          metadata: input.metadata,
          status: input.status,
          updatedAt: now,
        })
        .where(eq(socialAccounts.id, existing.id));
      const updated = await this.findById(existing.id);
      if (!updated) throw new Error(`SocialAccount not found after update: ${existing.id}`);
      return updated;
    }

    const row = {
      id: generateId(),
      userId: input.userId,
      platform: input.platform,
      externalAccountId: input.externalAccountId,
      displayName: input.displayName,
      accessTokenRef: input.accessTokenRef,
      refreshTokenRef: input.refreshTokenRef,
      tokenExpiresAt: input.tokenExpiresAt,
      metadata: input.metadata,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(socialAccounts).values(row);
    return mapSocialAccount(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(socialAccounts).where(eq(socialAccounts.id, id));
  }
}
