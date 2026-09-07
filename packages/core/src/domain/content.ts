export const CONTENT_STATUSES = ['draft', 'approved', 'archived', 'cancelled'] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_TYPES = ['video', 'text'] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * Persisted content. Platform-independent: no Facebook/TikTok/Shopee fields.
 * Structured affiliate copy (hook, script, caption, CTA, hashtags) is conceptual until Phase 2;
 * generated drafts currently pack hook into `title` and the rest into `body`.
 */
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

/**
 * Channel-neutral affiliate copy. Not a D1 schema — do not persist as extra columns yet.
 */
export interface AffiliateContentCopy {
  hook: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string[];
  language?: string;
  tone?: string;
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
