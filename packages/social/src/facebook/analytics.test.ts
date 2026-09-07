import { describe, expect, it, vi } from 'vitest';
import {
  FacebookPostAnalyticsProvider,
  mapFacebookAnalytics,
  MockFacebookPostAnalyticsProvider,
} from './analytics.js';
import type { FacebookGraphClient } from './client.js';

describe('mapFacebookAnalytics', () => {
  it('maps engagement and insights into provider-neutral metrics', () => {
    const result = mapFacebookAnalytics(
      { reactions: 10, comments: 3, shares: 2 },
      {
        data: [
          {
            name: 'post_impressions_organic',
            period: 'lifetime',
            values: [{ value: 120 }],
          },
          {
            name: 'post_clicks',
            period: 'lifetime',
            values: [{ value: 8 }],
          },
        ],
      },
    );

    expect(result.metrics).toEqual({
      impressions: 120,
      reach: null,
      clicks: 8,
      reactions: 10,
      comments: 3,
      shares: 2,
      engagements: 23,
    });
  });

  it('keeps metrics nullable when sources are missing', () => {
    const result = mapFacebookAnalytics(null, null);
    expect(result.metrics).toEqual({
      impressions: null,
      reach: null,
      clicks: null,
      reactions: null,
      comments: null,
      shares: null,
      engagements: null,
    });
  });
});

describe('FacebookPostAnalyticsProvider', () => {
  it('fetches engagement and insights without live API calls', async () => {
    const client = {
      getPostEngagement: vi.fn(async () => ({
        reactions: 5,
        comments: 1,
        shares: 2,
      })),
      getPostInsights: vi.fn(async () => ({
        data: [
          {
            name: 'post_impressions_organic',
            period: 'lifetime',
            values: [{ value: 50 }],
          },
          {
            name: 'post_clicks',
            period: 'lifetime',
            values: [{ value: 4 }],
          },
        ],
      })),
    } as unknown as FacebookGraphClient;

    const provider = new FacebookPostAnalyticsProvider(client);
    const result = await provider.fetchMetrics({
      externalPostId: 'page_1',
      pageId: 'page',
      accessToken: 'token',
    });

    expect(result.metrics.impressions).toBe(50);
    expect(result.metrics.reactions).toBe(5);
    expect(client.getPostEngagement).toHaveBeenCalledOnce();
    expect(client.getPostInsights).toHaveBeenCalledOnce();
  });

  it('returns partial metrics when only engagement is available', async () => {
    const client = {
      getPostEngagement: vi.fn(async () => ({
        reactions: 2,
        comments: 1,
        shares: null,
      })),
      getPostInsights: vi.fn(async () => {
        throw new Error('insights unavailable');
      }),
    } as unknown as FacebookGraphClient;

    const provider = new FacebookPostAnalyticsProvider(client);
    const result = await provider.fetchMetrics({
      externalPostId: 'page_1',
      pageId: 'page',
      accessToken: 'token',
    });

    expect(result.metrics.reactions).toBe(2);
    expect(result.metrics.impressions).toBeNull();
    expect(result.rawMetrics.partialErrors).toEqual(['insights: insights unavailable']);
  });
});

describe('MockFacebookPostAnalyticsProvider', () => {
  it('returns deterministic mock metrics', async () => {
    const provider = new MockFacebookPostAnalyticsProvider();
    const result = await provider.fetchMetrics({
      externalPostId: 'page_1',
      pageId: 'page',
      accessToken: 'token',
    });

    expect(result.metrics.impressions).toBe(120);
    expect(result.rawMetrics.source).toBe('mock');
  });
});
