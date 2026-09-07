import type { PostEngagementMetrics } from '../domain/post-analytics.js';
import type { SocialPlatform } from '../domain/social-account.js';

export const DEFAULT_POST_ANALYTICS_CRON = '0 */6 * * *';
export const DEFAULT_POST_ANALYTICS_INTERVAL_HOURS = 6;
export const POST_ANALYTICS_JOB_NAME = 'post-analytics-refresh';
export const POST_ANALYTICS_LEASE_MS = 30 * 60 * 1000;

export interface PostAnalyticsFetchInput {
  externalPostId: string;
  pageId: string;
  accessToken: string;
}

export interface PostAnalyticsFetchResult {
  metrics: PostEngagementMetrics;
  rawMetrics: Record<string, unknown>;
}

export interface PostAnalyticsProvider {
  platform: SocialPlatform;
  fetchMetrics(input: PostAnalyticsFetchInput): Promise<PostAnalyticsFetchResult>;
}
