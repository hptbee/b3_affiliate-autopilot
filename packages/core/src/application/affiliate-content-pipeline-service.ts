import type { Content } from '../domain/content.js';
import type { MediaAsset } from '../domain/media.js';
import type { UserContext } from '../types/user-context.js';
import type { AffiliateContentService } from './affiliate-content-service.js';
import {
  AffiliateProductSelectionService,
  DEFAULT_DUPLICATE_WINDOW_MS,
  type EligibleAffiliateProduct,
} from './affiliate-product-selection-service.js';
import type { MediaService } from './media-service.js';

export interface RunAffiliatePipelineInput {
  limit: number;
  keyword?: string;
  duplicateWindowHours?: number;
  generateMedia?: boolean;
  tone?: string;
  language?: string;
}

export type PipelineItemStatus = 'created' | 'skipped_duplicate' | 'failed';

export interface PipelineItemResult {
  status: PipelineItemStatus;
  productId?: string;
  affiliateOfferId?: string;
  contentId?: string;
  mediaId?: string;
  error?: string;
}

export interface PipelineRunResult {
  requested: number;
  created: number;
  skipped: number;
  failed: number;
  items: PipelineItemResult[];
}

export class AffiliateContentPipelineService {
  constructor(
    private readonly selectionService: AffiliateProductSelectionService,
    private readonly affiliateContentService: AffiliateContentService,
    private readonly mediaService: MediaService,
  ) {}

  async run(user: UserContext, input: RunAffiliatePipelineInput): Promise<PipelineRunResult> {
    const duplicateWindowMs =
      input.duplicateWindowHours !== undefined
        ? input.duplicateWindowHours * 60 * 60 * 1000
        : DEFAULT_DUPLICATE_WINDOW_MS;
    const generateMedia = input.generateMedia ?? true;
    const since = new Date(Date.now() - duplicateWindowMs);

    const selected = await this.selectionService.selectEligible(user, {
      limit: input.limit,
      keyword: input.keyword,
      duplicateWindowMs,
    });

    const items: PipelineItemResult[] = [];

    for (const candidate of selected) {
      if (await this.selectionService.hasRecentContent(user.userId, candidate, since)) {
        items.push(skippedItem(candidate, 'Recent draft already exists for this product and offer'));
        continue;
      }

      try {
        const generated = await this.affiliateContentService.generateDraft(user, {
          productId: candidate.product.id,
          affiliateOfferId: candidate.offer.id,
          tone: input.tone,
          language: input.language,
        });

        let mediaId: string | undefined;
        if (generateMedia) {
          const media = await this.mediaService.generateForContent(user, generated.content.id, {
            productId: candidate.product.id,
          });
          mediaId = media.id;
        }

        items.push({
          status: 'created',
          productId: candidate.product.id,
          affiliateOfferId: candidate.offer.id,
          contentId: generated.content.id,
          mediaId,
        });
      } catch (error) {
        items.push({
          status: 'failed',
          productId: candidate.product.id,
          affiliateOfferId: candidate.offer.id,
          error: error instanceof Error ? error.message : 'Pipeline item failed',
        });
      }
    }

    return summarizePipeline(input.limit, items);
  }
}

function skippedItem(candidate: EligibleAffiliateProduct, error: string): PipelineItemResult {
  return {
    status: 'skipped_duplicate',
    productId: candidate.product.id,
    affiliateOfferId: candidate.offer.id,
    error,
  };
}

function summarizePipeline(requested: number, items: PipelineItemResult[]): PipelineRunResult {
  const created = items.filter((item) => item.status === 'created').length;
  const skipped = items.filter((item) => item.status === 'skipped_duplicate').length;
  const failed = items.filter((item) => item.status === 'failed').length;

  return {
    requested,
    created,
    skipped,
    failed,
    items,
  };
}

export type PipelineCreatedContent = Content;
export type PipelineCreatedMedia = MediaAsset;
