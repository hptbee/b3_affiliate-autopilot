import { describe, expect, it } from 'vitest';
import {
  buildOptimizationRecommendations,
  buildToneInsights,
  computePerformanceScore,
  computeSelectionScore,
} from './affiliate-optimization-analyzer.js';
import type { ContentPerformanceInsight, ProductPerformanceInsight } from './affiliate-optimization-analyzer.js';

const metrics = {
  high: {
    impressions: 1000,
    reach: null,
    clicks: 100,
    reactions: 50,
    comments: 10,
    shares: 5,
    engagements: 165,
  },
  low: {
    impressions: 1000,
    reach: null,
    clicks: 10,
    reactions: 5,
    comments: 1,
    shares: 0,
    engagements: 16,
  },
};

describe('computePerformanceScore', () => {
  it('uses click and engagement rates when impressions are available', () => {
    const score = computePerformanceScore(metrics.high, 1);
    expect(score).toBeCloseTo(0.126, 3);
  });

  it('falls back to engagements per publication without impressions', () => {
    const score = computePerformanceScore(
      { ...metrics.high, impressions: null },
      2,
    );
    expect(score).toBe(82.5);
  });
});

describe('computeSelectionScore', () => {
  it('weights commission, sales, and rating', () => {
    const score = computeSelectionScore(
      {
        id: 'p1',
        userId: 'u1',
        provider: 'shopee',
        externalProductId: '1',
        title: 'Phone',
        description: null,
        price: '100',
        originalPrice: null,
        rating: 4.5,
        salesCount: 1000,
        images: [],
        productUrl: 'https://example.com',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'o1',
        userId: 'u1',
        productId: 'p1',
        provider: 'shopee',
        affiliateUrl: 'https://shope.ee/x',
        trackingCode: null,
        commissionRate: '10',
        createdAt: new Date(),
        expiresAt: null,
      },
    );

    expect(score).toBeGreaterThan(5);
  });
});

describe('buildOptimizationRecommendations', () => {
  it('creates explainable recommendations for priority and underperformance', () => {
    const productInsights: ProductPerformanceInsight[] = [
      {
        productId: 'p-high',
        affiliateOfferId: 'o-high',
        productTitle: 'Top Product',
        publicationCount: 2,
        metrics: metrics.high,
        performanceScore: computePerformanceScore(metrics.high, 2),
        selectionScore: 8,
      },
      {
        productId: 'p-low',
        affiliateOfferId: 'o-low',
        productTitle: 'Weak Product',
        publicationCount: 2,
        metrics: metrics.low,
        performanceScore: computePerformanceScore(metrics.low, 2),
        selectionScore: 7,
      },
    ];

    const contentInsights: ContentPerformanceInsight[] = [
      {
        contentId: 'c-low',
        productId: 'p-low',
        affiliateOfferId: 'o-low',
        title: 'Weak Hook',
        tone: 'casual',
        publicationCount: 1,
        metrics: metrics.low,
        performanceScore: computePerformanceScore(metrics.low, 1),
      },
      {
        contentId: 'c-high',
        productId: 'p-high',
        affiliateOfferId: 'o-high',
        title: 'Strong Hook',
        tone: 'energetic',
        publicationCount: 1,
        metrics: metrics.high,
        performanceScore: computePerformanceScore(metrics.high, 1),
      },
    ];

    const recommendations = buildOptimizationRecommendations({
      productInsights,
      contentInsights,
      toneInsights: buildToneInsights(contentInsights),
    });

    expect(recommendations.some((item) => item.type === 'product_priority')).toBe(true);
    expect(recommendations.some((item) => item.type === 'underperforming_product')).toBe(true);
    expect(recommendations.some((item) => item.type === 'underperforming_content')).toBe(true);
    expect(recommendations.some((item) => item.type === 'content_tone')).toBe(true);
    expect(recommendations.every((item) => item.evidence.metrics || item.evidence.details)).toBe(
      true,
    );
  });
});
