export const SCHEDULED_POST_STATUSES = [
  'scheduled',
  'publishing',
  'published',
  'failed',
  'uncertain',
  'dead',
  'cancelled',
] as const;

export type ScheduledPostStatus = (typeof SCHEDULED_POST_STATUSES)[number];

export const SCHEDULED_POST_PRIVACY_LEVELS = ['self_only', 'public'] as const;

export type ScheduledPostPrivacyLevel = (typeof SCHEDULED_POST_PRIVACY_LEVELS)[number];

export interface ScheduledPost {
  id: string;
  contentId: string;
  socialAccountId: string;
  scheduledAt: Date;
  privacyLevel: ScheduledPostPrivacyLevel;
  status: ScheduledPostStatus;
  publishedAt: Date | null;
  externalPostId: string | null;
  error: string | null;
  retryCount: number;
  queuedAt: Date | null;
  publishingStartedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_PUBLISH_RETRIES = 3;
export const PUBLISHING_LEASE_MS = 10 * 60 * 1000;
export const QUEUE_CLAIM_TTL_MS = 4 * 60 * 1000;

export function canCancelScheduledPost(status: ScheduledPostStatus): boolean {
  return status === 'scheduled' || status === 'failed';
}

export function isPublishable(status: ScheduledPostStatus): boolean {
  return status === 'scheduled' || status === 'failed';
}

export function isDue(scheduledAt: Date, now: Date): boolean {
  return scheduledAt.getTime() <= now.getTime();
}

export function isStalePublishing(post: ScheduledPost, now: Date): boolean {
  if (post.status !== 'publishing' || post.externalPostId) {
    return false;
  }
  if (!post.publishingStartedAt) {
    return true;
  }
  return now.getTime() - post.publishingStartedAt.getTime() >= PUBLISHING_LEASE_MS;
}
