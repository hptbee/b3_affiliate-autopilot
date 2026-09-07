/**
 * Distribution channels. Facebook is the first target.
 * TikTok is PENDING / FUTURE. Instagram and YouTube are later and not in the union yet.
 */
export const SOCIAL_PLATFORMS = ['facebook', 'tiktok'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const PRIMARY_DISTRIBUTION_CHANNEL = 'facebook' as const;

export const FUTURE_DISTRIBUTION_CHANNELS = ['instagram', 'youtube'] as const;

export type FutureDistributionChannel = (typeof FUTURE_DISTRIBUTION_CHANNELS)[number];

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export const SOCIAL_ACCOUNT_STATUSES = ['active', 'disconnected', 'expired', 'error'] as const;

export type SocialAccountStatus = (typeof SOCIAL_ACCOUNT_STATUSES)[number];

export interface SocialAccount {
  id: string;
  userId: string;
  platform: SocialPlatform;
  externalAccountId: string;
  displayName: string;
  accessTokenRef: string;
  refreshTokenRef: string | null;
  tokenExpiresAt: Date | null;
  metadata: Record<string, unknown>;
  status: SocialAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}
