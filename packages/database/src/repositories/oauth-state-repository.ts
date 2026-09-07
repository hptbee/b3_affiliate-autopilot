import { eq, lt } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { oauthStates } from '../schema/index.js';
import type * as schema from '../schema/index.js';

export class DrizzleOAuthStateRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(state: string, userId: string, expiresAt: Date): Promise<void> {
    await this.db.insert(oauthStates).values({ state, userId, expiresAt });
  }

  async consume(state: string, now: Date): Promise<string | null> {
    const rows = await this.db
      .select()
      .from(oauthStates)
      .where(eq(oauthStates.state, state))
      .limit(1);
    const row = rows[0];
    if (!row || row.expiresAt.getTime() <= now.getTime()) {
      if (row) {
        await this.db.delete(oauthStates).where(eq(oauthStates.state, state));
      }
      return null;
    }

    await this.db.delete(oauthStates).where(eq(oauthStates.state, state));
    return row.userId;
  }

  async deleteExpired(now: Date): Promise<void> {
    await this.db.delete(oauthStates).where(lt(oauthStates.expiresAt, now));
  }
}
