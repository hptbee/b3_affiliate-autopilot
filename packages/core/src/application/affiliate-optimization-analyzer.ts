import type { PostEngagementMetrics } from '../domain/post-analytics.js';
import { sumEngagementMetrics } from '../domain/post-analytics.js';
import type { Product } from '../domain/product.js';
import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import type { Content } from '../domain/content.js';
import type {
  OptimizationPriority,
  OptimizationRecommendationEvidence,
  OptimizationRecommendationType,
} from '../domain/optimization.js';

export interface ProductPerformanceInsight {
  productId: string;
  affiliateOfferId: string | null;
  productTitle: string;
  publicationCount: number;
  metrics: PostEngagementMetrics;
  performanceScore: number;
  selectionScore: number;
}

export interface ContentPerformanceInsight {
  contentId: string;
  productId: string | null;
  affiliateOfferId: string | null;
  title: string;
  tone: string | null;
  publicationCount: number;
  metrics: PostEngagementMetrics;
  performanceScore: number;
}

export interface TonePerformanceInsight {
  tone: string;
  publicationCount: number;
  metrics: PostEngagementMetrics;
  performanceScore: number;
}

export interface DraftOptimizationRecommendation {
  type: OptimizationRecommendationType;
  title: string;
  summary: string;
  rationale: string;
  priority: OptimizationPriority;
  productId: string | null;
  contentId: string | null;
  affiliateOfferId: string | null;
  evidence: OptimizationRecommendationEvidence;
}

export function computePerformanceScore(
  metrics: PostEngagementMetrics,
  publicationCount: number,
): number {
  if (publicationCount <= 0) return 0;

  const impressions = metrics.impressions ?? 0;
  const clicks = metrics.clicks ?? 0;
  const engagements = metrics.engagements ?? 0;

  if (impressions > 0) {
    const clickRate = clicks / impressions;
    const engagementRate = engagements / impressions;
    return clickRate * 0.6 + engagementRate * 0.4;
  }

  return engagements / publicationCount;
}

export function computeSelectionScore(product: Product, offer: AffiliateOffer): number {
  const commission = parseCommission(offer.commissionRate);
  const sales = product.salesCount ?? 0;
  const rating = product.rating ?? 0;
  return commission * 0.5 + Math.log10(sales + 1) * 0.3 + rating * 0.2;
}

export function buildProductInsights(
  products: Array<{ product: Product; offer: AffiliateOffer | null; metrics: PostEngagementMetrics; publicationCount: number }>,
): ProductPerformanceInsight[] {
  return products
    .map((entry) => ({
      productId: entry.product.id,
      affiliateOfferId: entry.offer?.id ?? null,
      productTitle: entry.product.title,
      publicationCount: entry.publicationCount,
      metrics: entry.metrics,
      performanceScore: computePerformanceScore(entry.metrics, entry.publicationCount),
      selectionScore: entry.offer
        ? computeSelectionScore(entry.product, entry.offer)
        : computeSelectionScore(entry.product, {
            id: 'missing',
            userId: entry.product.userId,
            productId: entry.product.id,
            provider: entry.product.provider,
            affiliateUrl: '',
            trackingCode: null,
            commissionRate: null,
            createdAt: entry.product.createdAt,
            expiresAt: null,
          }),
    }))
    .sort((a, b) => b.performanceScore - a.performanceScore);
}

export function buildContentInsights(
  contents: Array<{ content: Content; metrics: PostEngagementMetrics; publicationCount: number }>,
): ContentPerformanceInsight[] {
  return contents
    .map((entry) => ({
      contentId: entry.content.id,
      productId: readMetadataString(entry.content.metadata, 'productId'),
      affiliateOfferId: readMetadataString(entry.content.metadata, 'affiliateOfferId'),
      title: entry.content.title,
      tone: readMetadataString(entry.content.metadata, 'tone'),
      publicationCount: entry.publicationCount,
      metrics: entry.metrics,
      performanceScore: computePerformanceScore(entry.metrics, entry.publicationCount),
    }))
    .sort((a, b) => b.performanceScore - a.performanceScore);
}

export function buildToneInsights(contentInsights: ContentPerformanceInsight[]): TonePerformanceInsight[] {
  const groups = new Map<string, ContentPerformanceInsight[]>();

  for (const insight of contentInsights) {
    const tone = insight.tone?.trim() || 'unspecified';
    const bucket = groups.get(tone) ?? [];
    bucket.push(insight);
    groups.set(tone, bucket);
  }

  return [...groups.entries()]
    .map(([tone, items]) => {
      const metrics = sumEngagementMetrics(items.map((item) => item.metrics));
      const publicationCount = items.reduce((total, item) => total + item.publicationCount, 0);
      return {
        tone,
        publicationCount,
        metrics,
        performanceScore: computePerformanceScore(metrics, publicationCount),
      };
    })
    .sort((a, b) => b.performanceScore - a.performanceScore);
}

export function buildOptimizationRecommendations(input: {
  productInsights: ProductPerformanceInsight[];
  contentInsights: ContentPerformanceInsight[];
  toneInsights: TonePerformanceInsight[];
}): DraftOptimizationRecommendation[] {
  const recommendations: DraftOptimizationRecommendation[] = [];
  const publishedProducts = input.productInsights.filter((item) => item.publicationCount > 0);
  const publishedContents = input.contentInsights.filter((item) => item.publicationCount > 0);
  const medianProductScore = median(publishedProducts.map((item) => item.performanceScore));
  const medianContentScore = median(publishedContents.map((item) => item.performanceScore));

  const topProducts = publishedProducts.slice(0, 3);
  for (const product of topProducts) {
    if (product.performanceScore <= 0) continue;
    recommendations.push({
      type: 'product_priority',
      title: `Prioritize ${product.productTitle}`,
      summary: 'This product is outperforming peers and should be prioritized in affiliate selection.',
      rationale: `Performance score ${product.performanceScore.toFixed(4)} exceeds the current median of ${medianProductScore.toFixed(4)} across ${publishedProducts.length} published products.`,
      priority: product.performanceScore >= medianProductScore * 1.5 ? 'high' : 'medium',
      productId: product.productId,
      contentId: null,
      affiliateOfferId: product.affiliateOfferId,
      evidence: {
        productId: product.productId,
        affiliateOfferId: product.affiliateOfferId,
        metrics: product.metrics,
        performanceScore: product.performanceScore,
        publicationCount: product.publicationCount,
        details: { medianPerformanceScore: medianProductScore },
      },
    });
  }

  for (const product of publishedProducts.filter((item) => item.performanceScore < medianProductScore)) {
    recommendations.push({
      type: 'underperforming_product',
      title: `Review underperforming product: ${product.productTitle}`,
      summary: 'Published posts for this product are below the median engagement performance.',
      rationale: `Performance score ${product.performanceScore.toFixed(4)} is below the median ${medianProductScore.toFixed(4)}.`,
      priority: product.performanceScore < medianProductScore * 0.5 ? 'high' : 'medium',
      productId: product.productId,
      contentId: null,
      affiliateOfferId: product.affiliateOfferId,
      evidence: {
        productId: product.productId,
        affiliateOfferId: product.affiliateOfferId,
        metrics: product.metrics,
        performanceScore: product.performanceScore,
        publicationCount: product.publicationCount,
        baselineMetrics: aggregateBaselineMetrics(publishedProducts),
        details: { medianPerformanceScore: medianProductScore },
      },
    });
  }

  for (const content of publishedContents.filter((item) => item.performanceScore < medianContentScore)) {
    recommendations.push({
      type: 'underperforming_content',
      title: `Revise underperforming content: ${content.title}`,
      summary: 'This content is underperforming relative to other published affiliate posts.',
      rationale: `Content performance score ${content.performanceScore.toFixed(4)} is below the median ${medianContentScore.toFixed(4)}.`,
      priority: content.performanceScore < medianContentScore * 0.5 ? 'high' : 'low',
      productId: content.productId,
      contentId: content.contentId,
      affiliateOfferId: content.affiliateOfferId,
      evidence: {
        contentId: content.contentId,
        productId: content.productId,
        affiliateOfferId: content.affiliateOfferId,
        metrics: content.metrics,
        performanceScore: content.performanceScore,
        publicationCount: content.publicationCount,
        tone: content.tone,
        details: { medianPerformanceScore: medianContentScore },
      },
    });
  }

  const toneCandidates = input.toneInsights.filter((item) => item.publicationCount >= 1);
  const bestTone = toneCandidates[0];
  const medianToneScore = median(toneCandidates.map((item) => item.performanceScore));
  if (bestTone && bestTone.performanceScore > medianToneScore) {
    recommendations.push({
      type: 'content_tone',
      title: `Favor "${bestTone.tone}" tone in future drafts`,
      summary: 'Historical performance suggests this tone pattern is resonating best.',
      rationale: `Tone "${bestTone.tone}" achieved performance score ${bestTone.performanceScore.toFixed(4)} versus median ${medianToneScore.toFixed(4)}.`,
      priority: 'medium',
      productId: null,
      contentId: null,
      affiliateOfferId: null,
      evidence: {
        tone: bestTone.tone,
        metrics: bestTone.metrics,
        performanceScore: bestTone.performanceScore,
        publicationCount: bestTone.publicationCount,
        details: {
          medianPerformanceScore: medianToneScore,
          toneBreakdown: toneCandidates,
        },
      },
    });
  }

  const performanceRank = new Map(
    publishedProducts.map((item, index) => [item.productId, index + 1]),
  );
  const selectionRank = [...input.productInsights]
    .sort((a, b) => b.selectionScore - a.selectionScore)
    .map((item, index) => [item.productId, index + 1] as const);

  for (const [productId, selectionPosition] of selectionRank) {
    const performancePosition = performanceRank.get(productId);
    if (!performancePosition) continue;

    const rankGap = performancePosition - selectionPosition;
    if (Math.abs(rankGap) < 2) continue;

    const product = input.productInsights.find((item) => item.productId === productId);
    if (!product) continue;

    const adjustedScore = product.selectionScore + rankGap * 0.1;
    recommendations.push({
      type: 'selection_score_adjustment',
      title: `Adjust selection score for ${product.productTitle}`,
      summary:
        rankGap < 0
          ? 'Performance is stronger than the current selection ranking suggests.'
          : 'Performance is weaker than the current selection ranking suggests.',
      rationale: `Selection rank ${selectionPosition} vs performance rank ${performancePosition} indicates a ${Math.abs(rankGap)}-position mismatch.`,
      priority: Math.abs(rankGap) >= 4 ? 'high' : 'medium',
      productId: product.productId,
      contentId: null,
      affiliateOfferId: product.affiliateOfferId,
      evidence: {
        productId: product.productId,
        affiliateOfferId: product.affiliateOfferId,
        selectionScore: product.selectionScore,
        adjustedScore,
        performanceScore: product.performanceScore,
        publicationCount: product.publicationCount,
        metrics: product.metrics,
        details: {
          selectionRank: selectionPosition,
          performanceRank: performancePosition,
          rankGap,
        },
      },
    });
  }

  return dedupeRecommendations(recommendations);
}

function dedupeRecommendations(
  recommendations: DraftOptimizationRecommendation[],
): DraftOptimizationRecommendation[] {
  const seen = new Set<string>();
  const unique: DraftOptimizationRecommendation[] = [];

  for (const recommendation of recommendations) {
    const key = [
      recommendation.type,
      recommendation.productId ?? '',
      recommendation.contentId ?? '',
      recommendation.title,
    ].join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(recommendation);
  }

  return unique;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function parseCommission(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function aggregateBaselineMetrics(products: ProductPerformanceInsight[]): PostEngagementMetrics {
  return sumEngagementMetrics(products.map((item) => item.metrics));
}
