export const SCHEDULED_POST_STATUSES = [
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled',
] as const;

export type ScheduledPostStatus = (typeof SCHEDULED_POST_STATUSES)[number];

export interface ScheduledPost {
  id: string;
  contentId: string;
  socialAccountId: string;
  scheduledAt: Date;
  status: ScheduledPostStatus;
  publishedAt: Date | null;
  externalPostId: string | null;
  error: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_PUBLISH_RETRIES = 3;

export function canCancelScheduledPost(status: ScheduledPostStatus): boolean {
  return status === 'scheduled' || status === 'failed';
}

export function isPublishable(status: ScheduledPostStatus): boolean {
  return status === 'scheduled' || status === 'failed';
}

export function isDue(scheduledAt: Date, now: Date): boolean {
  return scheduledAt.getTime() <= now.getTime();
}
