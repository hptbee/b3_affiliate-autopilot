export const CONTENT_STATUSES = ['draft', 'approved', 'archived', 'cancelled'] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_TYPES = ['video', 'text'] as const;

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
  approved: ['archived', 'cancelled', 'draft'],
  archived: [],
  cancelled: [],
};

export function canTransitionContentStatus(from: ContentStatus, to: ContentStatus): boolean {
  return CONTENT_TRANSITIONS[from].includes(to);
}
