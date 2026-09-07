import type {
  PostAnalyticsFetchInput,
  PostAnalyticsFetchResult,
  PostAnalyticsProvider,
} from '@social-autopilot/core';
import {
  FacebookGraphClient,
  type FacebookGraphErrorBody,
  type FacebookPostEngagementResult,
  type FacebookPostInsightsResult,
} from './client.js';

export const FACEBOOK_POST_INSIGHT_METRICS = [
  'post_impressions_organic',
  'post_clicks',
  'post_reactions_by_type_total',
] as const;

export function mapFacebookAnalytics(
  engagement: FacebookPostEngagementResult | null,
  insights: FacebookPostInsightsResult | null,
): PostAnalyticsFetchResult {
  const insightValues = insights ? extractInsightValues(insights) : {};
  const reactionsFromInsights = sumReactionValues(insightValues.post_reactions_by_type_total);
  const reactions = engagement?.reactions ?? reactionsFromInsights;
  const comments = engagement?.comments ?? null;
  const shares = engagement?.shares ?? null;
  const clicks = insightValues.post_clicks ?? null;
  const impressions = insightValues.post_impressions_organic ?? null;

  const engagements = sumNullable([reactions, comments, shares, clicks]);

  return {
    metrics: {
      impressions,
      reach: null,
      clicks,
      reactions,
      comments,
      shares,
      engagements,
    },
    rawMetrics: {
      engagement,
      insights,
    },
  };
}

export class FacebookPostAnalyticsProvider implements PostAnalyticsProvider {
  readonly platform = 'facebook' as const;

  constructor(private readonly client: FacebookGraphClient = new FacebookGraphClient()) {}

  async fetchMetrics(input: PostAnalyticsFetchInput): Promise<PostAnalyticsFetchResult> {
    let engagement: FacebookPostEngagementResult | null = null;
    let insights: FacebookPostInsightsResult | null = null;
    const errors: string[] = [];

    try {
      engagement = await this.client.getPostEngagement(input.externalPostId, input.accessToken);
    } catch (error) {
      errors.push(formatFacebookError('engagement', error));
    }

    try {
      insights = await this.client.getPostInsights(
        input.externalPostId,
        input.accessToken,
        [...FACEBOOK_POST_INSIGHT_METRICS],
      );
    } catch (error) {
      errors.push(formatFacebookError('insights', error));
    }

    if (!engagement && !insights) {
      throw new Error(errors.join('; ') || 'Facebook analytics returned no data');
    }

    const mapped = mapFacebookAnalytics(engagement, insights);
    if (errors.length > 0) {
      mapped.rawMetrics.partialErrors = errors;
    }

    if (isEmptyMetrics(mapped.metrics)) {
      throw new Error(errors.join('; ') || 'Facebook analytics returned no usable metrics');
    }

    return mapped;
  }
}

export class MockFacebookPostAnalyticsProvider implements PostAnalyticsProvider {
  readonly platform = 'facebook' as const;

  constructor(private readonly metricsByPostId: Record<string, PostAnalyticsFetchResult> = {}) {}

  async fetchMetrics(input: PostAnalyticsFetchInput): Promise<PostAnalyticsFetchResult> {
    const result = this.metricsByPostId[input.externalPostId];
    if (!result) {
      return {
        metrics: {
          impressions: 120,
          reach: null,
          clicks: 8,
          reactions: 15,
          comments: 3,
          shares: 2,
          engagements: 28,
        },
        rawMetrics: {
          source: 'mock',
          externalPostId: input.externalPostId,
        },
      };
    }
    return result;
  }
}

function extractInsightValues(
  insights: FacebookPostInsightsResult,
): Record<string, number | null> {
  const values: Record<string, number | null> = {};

  for (const item of insights.data) {
    values[item.name] = extractInsightValue(item);
  }

  return values;
}

function extractInsightValue(item: FacebookPostInsightsResult['data'][number]): number | null {
  const value = item.values?.[0]?.value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object') {
    return sumReactionValues(value as Record<string, number>);
  }
  return null;
}

function sumReactionValues(value: Record<string, number> | number | null | undefined): number | null {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return null;

  let total = 0;
  let hasValue = false;
  for (const count of Object.values(value)) {
    if (typeof count === 'number') {
      total += count;
      hasValue = true;
    }
  }
  return hasValue ? total : null;
}

function sumNullable(values: Array<number | null>): number | null {
  let total = 0;
  let hasValue = false;
  for (const value of values) {
    if (value !== null) {
      total += value;
      hasValue = true;
    }
  }
  return hasValue ? total : null;
}

function isEmptyMetrics(metrics: PostAnalyticsFetchResult['metrics']): boolean {
  return Object.values(metrics).every((value) => value === null);
}

function formatFacebookError(source: string, error: unknown): string {
  if (error instanceof Error) {
    const facebookError = (error as Error & { facebookError?: FacebookGraphErrorBody['error'] })
      .facebookError;
    if (facebookError?.message) {
      return `${source}: ${facebookError.message}`;
    }
    return `${source}: ${error.message}`;
  }
  return `${source}: unknown error`;
}
