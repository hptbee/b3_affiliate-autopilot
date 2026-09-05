export const SOCIAL_PLATFORMS = [
  'linkedin',
  'x',
  'facebook',
  'instagram',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

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
