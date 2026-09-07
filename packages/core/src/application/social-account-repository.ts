import type { SocialAccount, SocialPlatform, SocialAccountStatus } from '../domain/social-account.js';

export interface UpsertSocialAccountInput {
  userId: string;
  platform: SocialPlatform;
  externalAccountId: string;
  displayName: string;
  accessTokenRef: string;
  refreshTokenRef: string | null;
  tokenExpiresAt: Date | null;
  status?: SocialAccountStatus;
  metadata?: Record<string, unknown>;
}

export interface SocialAccountRepository {
  findById(id: string): Promise<SocialAccount | null>;
  findByUserId(userId: string): Promise<SocialAccount[]>;
  findByUserAndPlatform(userId: string, platform: SocialPlatform): Promise<SocialAccount | null>;
  upsertByUserAndPlatform(input: UpsertSocialAccountInput): Promise<SocialAccount>;
  updateTokens(
    id: string,
    input: {
      accessTokenRef: string;
      refreshTokenRef: string | null;
      tokenExpiresAt: Date | null;
      status?: SocialAccountStatus;
    },
  ): Promise<SocialAccount>;
  disconnect(id: string): Promise<SocialAccount>;
}
