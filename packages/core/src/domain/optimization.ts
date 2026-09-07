import type { PostEngagementMetrics } from './post-analytics.js';

export const OPTIMIZATION_RECOMMENDATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'applied',
] as const;

export type OptimizationRecommendationStatus =
  (typeof OPTIMIZATION_RECOMMENDATION_STATUSES)[number];

export const OPTIMIZATION_RECOMMENDATION_TYPES = [
  'product_priority',
  'content_tone',
  'underperforming_product',
  'underperforming_content',
  'selection_score_adjustment',
] as const;

export type OptimizationRecommendationType =
  (typeof OPTIMIZATION_RECOMMENDATION_TYPES)[number];

export const OPTIMIZATION_PRIORITIES = ['high', 'medium', 'low'] as const;

export type OptimizationPriority = (typeof OPTIMIZATION_PRIORITIES)[number];

export interface OptimizationRecommendationEvidence {
  metrics?: PostEngagementMetrics;
  baselineMetrics?: PostEngagementMetrics;
  productId?: string | null;
  contentId?: string | null;
  affiliateOfferId?: string | null;
  selectionScore?: number;
  adjustedScore?: number;
  performanceScore?: number;
  tone?: string | null;
  publicationCount?: number;
  details?: Record<string, unknown>;
}

export interface OptimizationRecommendation {
  id: string;
  userId: string;
  type: OptimizationRecommendationType;
  status: OptimizationRecommendationStatus;
  title: string;
  summary: string;
  rationale: string;
  priority: OptimizationPriority;
  productId: string | null;
  contentId: string | null;
  affiliateOfferId: string | null;
  evidence: OptimizationRecommendationEvidence;
  aiReasoning: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
}

export interface OptimizationAnalysisSummary {
  productCount: number;
  contentCount: number;
  publicationCount: number;
  medianPerformanceScore: number;
}

export interface GenerateOptimizationRecommendationsResult {
  created: number;
  skipped: number;
  summary: OptimizationAnalysisSummary;
  recommendations: OptimizationRecommendation[];
}
