import type { SocialAccount, SocialPlatform } from '../domain/social-account.js';
import { isSocialPlatform } from '../domain/social-account.js';
import type { UserContext } from '../types/user-context.js';
import { NotFoundError, ValidationError } from '../types/errors.js';
import type { TokenStore } from '../types/token-store.js';
import type { SocialAccountRepository, UpsertSocialAccountInput } from './scheduled-post-service.js';

export interface ConnectPlatformAccountInput {
  platform: SocialPlatform;
  externalAccountId: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export class SocialAccountService {
  constructor(
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly tokenStore: TokenStore,
  ) {}

  async list(user: UserContext): Promise<SocialAccount[]> {
    return this.socialAccountRepository.findByUserId(user.userId);
  }

  async getById(user: UserContext, id: string): Promise<SocialAccount> {
    const account = await this.socialAccountRepository.findById(id);
    if (!account || account.userId !== user.userId) {
      throw new NotFoundError('SocialAccount', id);
    }
    return account;
  }

  async connectPlatformAccount(
    user: UserContext,
    input: ConnectPlatformAccountInput,
  ): Promise<SocialAccount> {
    if (!isSocialPlatform(input.platform)) {
      throw new ValidationError(`Unsupported distribution channel: ${input.platform}`);
    }

    const accessTokenRef = buildTokenRef(input.platform, user.userId, input.externalAccountId);
    await this.tokenStore.put(accessTokenRef, input.accessToken);

    let refreshTokenRef: string | null = null;
    if (input.refreshToken) {
      refreshTokenRef = `${accessTokenRef}:refresh`;
      await this.tokenStore.put(refreshTokenRef, input.refreshToken);
    }

    return this.socialAccountRepository.upsert({
      userId: user.userId,
      platform: input.platform,
      externalAccountId: input.externalAccountId,
      displayName: input.displayName,
      accessTokenRef,
      refreshTokenRef,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      metadata: input.metadata ?? {},
      status: 'active',
    });
  }

  async disconnect(user: UserContext, id: string): Promise<void> {
    const account = await this.getById(user, id);
    await this.tokenStore.delete(account.accessTokenRef);
    if (account.refreshTokenRef) {
      await this.tokenStore.delete(account.refreshTokenRef);
    }
    await this.socialAccountRepository.delete(account.id);
  }
}

export function buildTokenRef(
  platform: SocialPlatform,
  userId: string,
  externalAccountId: string,
): string {
  return `${platform}:${userId}:${externalAccountId}`;
}
