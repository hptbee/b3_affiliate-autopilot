export const CONTENT_STATUSES = [
  'draft',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled',
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_TYPES = ['text', 'image', 'video', 'carousel', 'thread'] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export interface Content {
  id: string;
  userId: string;
  title: string;
  body: string;
  status: ContentStatus;
  contentType: ContentType;
  createdAt: Date;
  updatedAt: Date;
}

export const CONTENT_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['scheduled', 'draft', 'cancelled'],
  scheduled: ['publishing', 'cancelled', 'draft'],
  publishing: ['published', 'failed'],
  published: [],
  failed: ['draft', 'approved', 'cancelled'],
  cancelled: [],
};

export function canTransitionContentStatus(
  from: ContentStatus,
  to: ContentStatus,
): boolean {
  return CONTENT_TRANSITIONS[from].includes(to);
}
