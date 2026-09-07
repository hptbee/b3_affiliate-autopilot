import type {
  GenerateOptimizationRecommendationsResult,
  OptimizationAnalysisSummary,
  OptimizationRecommendation,
  OptimizationRecommendationStatus,
} from '../domain/optimization.js';
import type { PostPublicationWithLatestMetrics } from '../domain/post-analytics.js';
import { sumEngagementMetrics } from '../domain/post-analytics.js';
import type { Content } from '../domain/content.js';
import { ConflictError, NotFoundError } from '../types/errors.js';
import type { Logger } from '../types/logger.js';
import type { OptimizationReasoningProvider } from '../types/optimization.js';
import type { UserContext } from '../types/user-context.js';
import type { ContentRepository } from './content-service.js';
import type { ProductService } from './product-service.js';
import type { PostPublicationRepository } from './post-analytics-service.js';
import {
  buildContentInsights,
  buildOptimizationRecommendations,
  buildProductInsights,
  buildToneInsights,
  type DraftOptimizationRecommendation,
} from './affiliate-optimization-analyzer.js';

export interface OptimizationRecommendationRepository {
  create(
    input: Omit<
      OptimizationRecommendation,
      'id' | 'createdAt' | 'updatedAt' | 'reviewedAt'
    >,
  ): Promise<OptimizationRecommendation>;
  findById(id: string): Promise<OptimizationRecommendation | null>;
  findByUserId(
    userId: string,
    status?: OptimizationRecommendationStatus,
  ): Promise<OptimizationRecommendation[]>;
  updateStatus(
    id: string,
    status: OptimizationRecommendationStatus,
    reviewedAt: Date | null,
  ): Promise<OptimizationRecommendation>;
  findPendingDuplicate(input: {
    userId: string;
    type: OptimizationRecommendation['type'];
    productId: string | null;
    contentId: string | null;
    title: string;
  }): Promise<OptimizationRecommendation | null>;
}

export interface GenerateOptimizationRecommendationsInput {
  includeAiReasoning?: boolean;
}

export class AffiliateOptimizationService {
  constructor(
    private readonly recommendationRepository: OptimizationRecommendationRepository,
    private readonly publicationRepository: PostPublicationRepository,
    private readonly contentRepository: ContentRepository,
    private readonly productService: ProductService,
    private readonly reasoningProvider: OptimizationReasoningProvider | null,
    private readonly logger: Logger,
  ) {}

  async generateRecommendations(
    user: UserContext,
    input: GenerateOptimizationRecommendationsInput = {},
  ): Promise<GenerateOptimizationRecommendationsResult> {
    const publications = await this.publicationRepository.findByUserId(user.userId);
    const contents = await this.contentRepository.findByUserId(user.userId);
    const products = await this.productService.list(user);

    const productInsights = await this.buildProductInsights(user, products, publications);
    const contentInsights = buildContentInsights(
      contents.map((content) => this.toContentInsightInput(content, publications)),
    );
    const toneInsights = buildToneInsights(contentInsights);
    const drafts = buildOptimizationRecommendations({
      productInsights,
      contentInsights,
      toneInsights,
    });

    const summary: OptimizationAnalysisSummary = {
      productCount: products.length,
      contentCount: contents.length,
      publicationCount: publications.length,
      medianPerformanceScore: median(
        productInsights
          .filter((item) => item.publicationCount > 0)
          .map((item) => item.performanceScore),
      ),
    };

    let aiReasoning: string | null = null;
    if (input.includeAiReasoning && this.reasoningProvider && drafts.length > 0) {
      try {
        const result = await this.reasoningProvider.summarize({
          summary: `Analyzed ${summary.publicationCount} publications across ${summary.productCount} products and ${summary.contentCount} content items.`,
          recommendations: drafts.map((draft) => ({
            type: draft.type,
            title: draft.title,
            summary: draft.summary,
            priority: draft.priority,
            evidence: draft.evidence,
          })),
        });
        aiReasoning = result.reasoning;
      } catch (error) {
        this.logger.warn('Optimization AI reasoning failed; continuing without AI summary', {
          operation: 'optimization.generateRecommendations',
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    const recommendations: OptimizationRecommendation[] = [];
    let skipped = 0;

    for (const draft of drafts) {
      const duplicate = await this.recommendationRepository.findPendingDuplicate({
        userId: user.userId,
        type: draft.type,
        productId: draft.productId,
        contentId: draft.contentId,
        title: draft.title,
      });
      if (duplicate) {
        skipped += 1;
        continue;
      }

      const created = await this.recommendationRepository.create({
        userId: user.userId,
        type: draft.type,
        status: 'pending',
        title: draft.title,
        summary: draft.summary,
        rationale: draft.rationale,
        priority: draft.priority,
        productId: draft.productId,
        contentId: draft.contentId,
        affiliateOfferId: draft.affiliateOfferId,
        evidence: draft.evidence,
        aiReasoning,
      });
      recommendations.push(created);
    }

    this.logger.info('Generated optimization recommendations', {
      operation: 'optimization.generateRecommendations',
      created: recommendations.length,
      skipped,
      publicationCount: summary.publicationCount,
    });

    return {
      created: recommendations.length,
      skipped,
      summary,
      recommendations,
    };
  }

  async listRecommendations(
    user: UserContext,
    status?: OptimizationRecommendationStatus,
  ): Promise<OptimizationRecommendation[]> {
    return this.recommendationRepository.findByUserId(user.userId, status);
  }

  async approveRecommendation(user: UserContext, id: string): Promise<OptimizationRecommendation> {
    return this.updateRecommendationStatus(user, id, 'approved');
  }

  async rejectRecommendation(user: UserContext, id: string): Promise<OptimizationRecommendation> {
    return this.updateRecommendationStatus(user, id, 'rejected');
  }

  async applyRecommendation(user: UserContext, id: string): Promise<OptimizationRecommendation> {
    const recommendation = await this.getOwnedRecommendation(user, id);
    if (recommendation.status !== 'approved') {
      throw new ConflictError('Recommendation must be approved before it can be applied');
    }
    return this.recommendationRepository.updateStatus(id, 'applied', new Date());
  }

  private async updateRecommendationStatus(
    user: UserContext,
    id: string,
    status: OptimizationRecommendationStatus,
  ): Promise<OptimizationRecommendation> {
    const recommendation = await this.getOwnedRecommendation(user, id);
    if (recommendation.status !== 'pending') {
      throw new ConflictError(`Recommendation is already ${recommendation.status}`);
    }
    return this.recommendationRepository.updateStatus(id, status, new Date());
  }

  private async getOwnedRecommendation(
    user: UserContext,
    id: string,
  ): Promise<OptimizationRecommendation> {
    const recommendation = await this.recommendationRepository.findById(id);
    if (!recommendation || recommendation.userId !== user.userId) {
      throw new NotFoundError('OptimizationRecommendation', id);
    }
    return recommendation;
  }

  private async buildProductInsights(
    user: UserContext,
    products: Awaited<ReturnType<ProductService['list']>>,
    publications: PostPublicationWithLatestMetrics[],
  ) {
    const entries = [];

    for (const product of products) {
      const offers = await this.productService.listOffers(user, product.id);
      const offer = offers[0] ?? null;
      const productPublications = publications.filter((item) => item.productId === product.id);
      const metrics = sumEngagementMetrics(
        productPublications
          .map((item) => item.latestSnapshot?.metrics)
          .filter((value): value is NonNullable<typeof value> => value != null),
      );

      entries.push({
        product,
        offer,
        metrics,
        publicationCount: productPublications.length,
      });
    }

    return buildProductInsights(entries);
  }

  private toContentInsightInput(content: Content, publications: PostPublicationWithLatestMetrics[]) {
    const contentPublications = publications.filter((item) => item.contentId === content.id);
    const metrics = sumEngagementMetrics(
      contentPublications
        .map((item) => item.latestSnapshot?.metrics)
        .filter((value): value is NonNullable<typeof value> => value != null),
    );

    return {
      content,
      metrics,
      publicationCount: contentPublications.length,
    };
  }
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
