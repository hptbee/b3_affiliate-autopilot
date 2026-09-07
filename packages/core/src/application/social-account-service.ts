import type { SocialAccount } from '../domain/social-account.js';
import type { UserContext } from '../types/user-context.js';
import { NotFoundError, ValidationError } from '../types/errors.js';
import type { TokenStore } from '../types/token-store.js';
import type { SocialAccountRepository } from './social-account-repository.js';

export interface OAuthStateStore {
  create(state: string, userId: string, expiresAt: Date): Promise<void>;
  consume(state: string, now: Date): Promise<string | null>;
}

export interface TikTokOAuthClient {
  buildAuthorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number | null;
    openId: string;
    displayName: string;
  }>;
  refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number | null;
  }>;
}

export interface SocialAccountPublic {
  id: string;
  platform: string;
  displayName: string;
  status: string;
  createdAt: Date;
}

export class SocialAccountService {
  private static readonly OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
  private static readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;

  constructor(
    private readonly repository: SocialAccountRepository,
    private readonly tokenStore: TokenStore & { createRef(): string },
    private readonly oauthStateStore: OAuthStateStore,
    private readonly tiktokOAuth: TikTokOAuthClient,
  ) {}

  async startOAuth(user: UserContext): Promise<{ authorizeUrl: string }> {
    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SocialAccountService.OAUTH_STATE_TTL_MS);
    await this.oauthStateStore.create(state, user.userId, expiresAt);
    return { authorizeUrl: this.tiktokOAuth.buildAuthorizeUrl(state) };
  }

  async completeOAuth(
    code: string,
    state: string,
    now = new Date(),
  ): Promise<{ account: SocialAccountPublic; userId: string }> {
    const userId = await this.oauthStateStore.consume(state, now);
    if (!userId) {
      throw new ValidationError('Invalid or expired OAuth state');
    }

    const tokenResponse = await this.tiktokOAuth.exchangeCode(code);
    const accessTokenRef = this.tokenStore.createRef();
    const refreshTokenRef = tokenResponse.refreshToken ? this.tokenStore.createRef() : null;

    await this.tokenStore.put(accessTokenRef, tokenResponse.accessToken);
    if (refreshTokenRef && tokenResponse.refreshToken) {
      await this.tokenStore.put(refreshTokenRef, tokenResponse.refreshToken);
    }

    const tokenExpiresAt =
      tokenResponse.expiresIn != null
        ? new Date(now.getTime() + tokenResponse.expiresIn * 1000)
        : null;

    const account = await this.repository.upsertByUserAndPlatform({
      userId,
      platform: 'tiktok',
      externalAccountId: tokenResponse.openId,
      displayName: tokenResponse.displayName,
      accessTokenRef,
      refreshTokenRef,
      tokenExpiresAt,
      status: 'active',
    });

    return { account: toPublicAccount(account), userId };
  }

  async refreshIfNeeded(account: SocialAccount, now = new Date()): Promise<string> {
    const accessToken = await this.tokenStore.get(account.accessTokenRef);
    if (!accessToken) {
      throw new NotFoundError('SocialAccount', account.id);
    }

    const needsRefresh =
      account.tokenExpiresAt != null &&
      account.tokenExpiresAt.getTime() - now.getTime() <= SocialAccountService.REFRESH_BUFFER_MS;

    if (!needsRefresh) {
      return accessToken;
    }

    if (!account.refreshTokenRef) {
      return accessToken;
    }

    const refreshToken = await this.tokenStore.get(account.refreshTokenRef);
    if (!refreshToken) {
      throw new NotFoundError('SocialAccount', account.id);
    }

    const refreshed = await this.tiktokOAuth.refreshToken(refreshToken);
    await this.tokenStore.put(account.accessTokenRef, refreshed.accessToken);

    let refreshTokenRef = account.refreshTokenRef;
    if (refreshed.refreshToken) {
      if (!refreshTokenRef) {
        refreshTokenRef = this.tokenStore.createRef();
      }
      await this.tokenStore.put(refreshTokenRef, refreshed.refreshToken);
    }

    const tokenExpiresAt =
      refreshed.expiresIn != null
        ? new Date(now.getTime() + refreshed.expiresIn * 1000)
        : account.tokenExpiresAt;

    await this.repository.updateTokens(account.id, {
      accessTokenRef: account.accessTokenRef,
      refreshTokenRef,
      tokenExpiresAt,
      status: 'active',
    });

    return refreshed.accessToken;
  }

  async listForUser(user: UserContext): Promise<SocialAccountPublic[]> {
    const accounts = await this.repository.findByUserId(user.userId);
    return accounts
      .filter((account) => account.platform === 'tiktok')
      .map(toPublicAccount);
  }

  async disconnect(user: UserContext, accountId: string): Promise<SocialAccountPublic> {
    const account = await this.repository.findById(accountId);
    if (!account || account.userId !== user.userId) {
      throw new NotFoundError('SocialAccount', accountId);
    }

    await this.tokenStore.delete(account.accessTokenRef);
    if (account.refreshTokenRef) {
      await this.tokenStore.delete(account.refreshTokenRef);
    }

    const disconnected = await this.repository.disconnect(account.id);
    return toPublicAccount(disconnected);
  }
}

export function toPublicAccount(account: SocialAccount): SocialAccountPublic {
  return {
    id: account.id,
    platform: account.platform,
    displayName: account.displayName,
    status: account.status,
    createdAt: account.createdAt,
  };
}
