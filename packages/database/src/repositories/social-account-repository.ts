import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  SocialAccount,
  SocialAccountRepository,
  UpsertSocialAccountInput,
} from '@social-autopilot/core';
import type { SocialPlatform, SocialAccountStatus } from '@social-autopilot/core';
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

  async findByUserAndPlatform(userId: string, platform: SocialPlatform): Promise<SocialAccount | null> {
    const rows = await this.db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, userId))
      .limit(50);
    const match = rows.find((row) => row.platform === platform);
    return match ? mapSocialAccount(match) : null;
  }

  async upsertByUserAndPlatform(input: UpsertSocialAccountInput): Promise<SocialAccount> {
    const existing = await this.findByUserAndPlatform(input.userId, input.platform);
    const now = new Date();

    if (existing) {
      await this.db
        .update(socialAccounts)
        .set({
          externalAccountId: input.externalAccountId,
          displayName: input.displayName,
          accessTokenRef: input.accessTokenRef,
          refreshTokenRef: input.refreshTokenRef,
          tokenExpiresAt: input.tokenExpiresAt,
          metadata: input.metadata ?? existing.metadata,
          status: input.status ?? 'active',
          updatedAt: now,
        })
        .where(eq(socialAccounts.id, existing.id));
      const updated = await this.findById(existing.id);
      if (!updated) throw new Error('Social account not found after update');
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
      metadata: input.metadata ?? {},
      status: input.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(socialAccounts).values(row);
    return mapSocialAccount(row);
  }

  async updateTokens(
    id: string,
    input: {
      accessTokenRef: string;
      refreshTokenRef: string | null;
      tokenExpiresAt: Date | null;
      status?: SocialAccountStatus;
    },
  ): Promise<SocialAccount> {
    const now = new Date();
    await this.db
      .update(socialAccounts)
      .set({
        accessTokenRef: input.accessTokenRef,
        refreshTokenRef: input.refreshTokenRef,
        tokenExpiresAt: input.tokenExpiresAt,
        status: input.status ?? 'active',
        updatedAt: now,
      })
      .where(eq(socialAccounts.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error('Social account not found after token update');
    return updated;
  }

  async disconnect(id: string): Promise<SocialAccount> {
    const now = new Date();
    await this.db
      .update(socialAccounts)
      .set({ status: 'disconnected', updatedAt: now })
      .where(eq(socialAccounts.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error('Social account not found after disconnect');
    return updated;
  }
}
