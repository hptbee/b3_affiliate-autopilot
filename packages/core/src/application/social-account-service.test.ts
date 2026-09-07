import { describe, expect, it, vi } from 'vitest';
import { SocialAccountService, toPublicAccount } from '../application/social-account-service.js';
import type { SocialAccount } from '../domain/social-account.js';
import type { SocialAccountRepository } from '../application/social-account-repository.js';
import type { OAuthStateStore, TikTokOAuthClient } from '../application/social-account-service.js';

function createAccount(): SocialAccount {
  return {
    id: 'account-1',
    userId: 'user-1',
    platform: 'tiktok',
    externalAccountId: 'open-1',
    displayName: 'TikTok User',
    accessTokenRef: 'access-ref',
    refreshTokenRef: 'refresh-ref',
    tokenExpiresAt: new Date(Date.now() + 3600_000),
    metadata: {},
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('SocialAccountService', () => {
  it('returns public account DTO without token refs', () => {
    const publicAccount = toPublicAccount(createAccount());
    expect(publicAccount).toEqual({
      id: 'account-1',
      platform: 'tiktok',
      displayName: 'TikTok User',
      status: 'active',
      createdAt: publicAccount.createdAt,
    });
    expect(publicAccount).not.toHaveProperty('accessTokenRef');
  });

  it('rejects invalid oauth state', async () => {
    const repository: SocialAccountRepository = {
      async findById() {
        return null;
      },
      async findByUserId() {
        return [];
      },
      async findByUserAndPlatform() {
        return null;
      },
      async upsertByUserAndPlatform() {
        return createAccount();
      },
      async updateTokens() {
        return createAccount();
      },
      async disconnect() {
        return createAccount();
      },
    };

    const tokenStore = {
      createRef: () => 'ref-1',
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const oauthStateStore: OAuthStateStore = {
      create: vi.fn(),
      consume: vi.fn(async () => null),
    };

    const tiktokOAuth: TikTokOAuthClient = {
      buildAuthorizeUrl: () => 'https://tiktok.test/auth',
      exchangeCode: vi.fn(),
      refreshToken: vi.fn(),
    };

    const service = new SocialAccountService(repository, tokenStore, oauthStateStore, tiktokOAuth);
    await expect(service.completeOAuth('code', 'bad-state')).rejects.toThrow('OAuth state');
  });
});
