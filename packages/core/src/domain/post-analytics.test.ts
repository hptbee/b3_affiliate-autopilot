import { describe, expect, it } from 'vitest';
import {
  EMPTY_POST_ENGAGEMENT_METRICS,
  sumEngagementMetrics,
} from './post-analytics.js';

describe('sumEngagementMetrics', () => {
  it('sums available metrics and preserves nulls for missing values', () => {
    const result = sumEngagementMetrics([
      {
        impressions: 100,
        reach: null,
        clicks: 5,
        reactions: 10,
        comments: 2,
        shares: 1,
        engagements: 18,
      },
      {
        impressions: 50,
        reach: 40,
        clicks: null,
        reactions: 3,
        comments: null,
        shares: 2,
        engagements: null,
      },
    ]);

    expect(result).toEqual({
      impressions: 150,
      reach: 40,
      clicks: 5,
      reactions: 13,
      comments: 2,
      shares: 3,
      engagements: 18,
    });
  });

  it('returns empty metrics for an empty list', () => {
    expect(sumEngagementMetrics([])).toEqual(EMPTY_POST_ENGAGEMENT_METRICS);
  });
});
