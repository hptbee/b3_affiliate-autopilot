import type { SocialPlatform } from './social-account.js';

export interface PostEngagementMetrics {
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  engagements: number | null;
}

export const EMPTY_POST_ENGAGEMENT_METRICS: PostEngagementMetrics = {
  impressions: null,
  reach: null,
  clicks: null,
  reactions: null,
  comments: null,
  shares: null,
  engagements: null,
};

export interface PostPublication {
  id: string;
  scheduledPostId: string;
  contentId: string;
  socialAccountId: string;
  platform: SocialPlatform;
  externalPostId: string;
  productId: string | null;
  affiliateOfferId: string | null;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostMetricSnapshot {
  id: string;
  publicationId: string;
  fetchedAt: Date;
  metrics: PostEngagementMetrics;
  rawMetrics: Record<string, unknown> | null;
  fetchError: string | null;
  createdAt: Date;
}

export interface PostPublicationWithLatestMetrics extends PostPublication {
  latestSnapshot: PostMetricSnapshot | null;
}

export interface ContentPerformanceSummary {
  contentId: string;
  publicationCount: number;
  latestMetrics: PostEngagementMetrics;
  publications: PostPublicationWithLatestMetrics[];
}

export interface ProductPerformanceSummary {
  productId: string;
  publicationCount: number;
  latestMetrics: PostEngagementMetrics;
  publications: PostPublicationWithLatestMetrics[];
}

export function sumEngagementMetrics(
  items: PostEngagementMetrics[],
): PostEngagementMetrics {
  const totals = { ...EMPTY_POST_ENGAGEMENT_METRICS };

  for (const metrics of items) {
    totals.impressions = addNullable(totals.impressions, metrics.impressions);
    totals.reach = addNullable(totals.reach, metrics.reach);
    totals.clicks = addNullable(totals.clicks, metrics.clicks);
    totals.reactions = addNullable(totals.reactions, metrics.reactions);
    totals.comments = addNullable(totals.comments, metrics.comments);
    totals.shares = addNullable(totals.shares, metrics.shares);
    totals.engagements = addNullable(totals.engagements, metrics.engagements);
  }

  return totals;
}

function addNullable(current: number | null, value: number | null): number | null {
  if (value === null) return current;
  return (current ?? 0) + value;
}
