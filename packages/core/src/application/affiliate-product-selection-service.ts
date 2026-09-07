import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import type { Product } from '../domain/product.js';
import type { UserContext } from '../types/user-context.js';
import type { ContentRepository } from './content-service.js';
import type { ProductService } from './product-service.js';

export const DEFAULT_DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface EligibleAffiliateProduct {
  product: Product;
  offer: AffiliateOffer;
}

export interface SelectEligibleProductsInput {
  limit: number;
  keyword?: string;
  duplicateWindowMs?: number;
}

export class AffiliateProductSelectionService {
  constructor(
    private readonly productService: ProductService,
    private readonly contentRepository: ContentRepository,
  ) {}

  async selectEligible(
    user: UserContext,
    input: SelectEligibleProductsInput,
  ): Promise<EligibleAffiliateProduct[]> {
    const duplicateWindowMs = input.duplicateWindowMs ?? DEFAULT_DUPLICATE_WINDOW_MS;
    const since = new Date(Date.now() - duplicateWindowMs);
    const candidates = input.keyword
      ? await this.collectFromKeywordSearch(user, input.keyword, input.limit)
      : await this.collectFromExistingProducts(user);

    const eligible: EligibleAffiliateProduct[] = [];

    for (const candidate of candidates) {
      if (eligible.length >= input.limit) break;
      if (await this.hasRecentContent(user.userId, candidate, since)) continue;
      eligible.push(candidate);
    }

    return eligible.slice(0, input.limit);
  }

  async hasRecentContent(
    userId: string,
    candidate: EligibleAffiliateProduct,
    since: Date,
  ): Promise<boolean> {
    const recent = await this.contentRepository.findRecentByAffiliateOffer(
      userId,
      candidate.product.id,
      candidate.offer.id,
      since,
    );
    return recent.length > 0;
  }

  private async collectFromKeywordSearch(
    user: UserContext,
    keyword: string,
    limit: number,
  ): Promise<EligibleAffiliateProduct[]> {
    const discovered = await this.productService.search(user, { keyword, limit: limit * 2 });
    const candidates: EligibleAffiliateProduct[] = [];

    for (const item of discovered) {
      if (candidates.length >= limit * 2) break;
      const imported = await this.productService.importProduct(user, {
        externalProductId: item.externalProductId,
        productUrl: item.productUrl,
      });
      if (!imported.offer?.affiliateUrl) continue;
      candidates.push({ product: imported.product, offer: imported.offer });
    }

    return this.sortCandidates(candidates);
  }

  private async collectFromExistingProducts(user: UserContext): Promise<EligibleAffiliateProduct[]> {
    const products = await this.productService.list(user);
    const candidates: EligibleAffiliateProduct[] = [];

    for (const product of products) {
      const offers = await this.productService.listOffers(user, product.id);
      for (const offer of offers) {
        if (!offer.affiliateUrl.trim()) continue;
        if (offer.expiresAt && offer.expiresAt.getTime() <= Date.now()) continue;
        candidates.push({ product, offer });
      }
    }

    return this.sortCandidates(candidates);
  }

  private sortCandidates(candidates: EligibleAffiliateProduct[]): EligibleAffiliateProduct[] {
    return [...candidates].sort((a, b) => {
      const commissionDiff = parseCommission(b.offer.commissionRate) - parseCommission(a.offer.commissionRate);
      if (commissionDiff !== 0) return commissionDiff;

      const salesDiff = (b.product.salesCount ?? 0) - (a.product.salesCount ?? 0);
      if (salesDiff !== 0) return salesDiff;

      return b.product.updatedAt.getTime() - a.product.updatedAt.getTime();
    });
  }
}

function parseCommission(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
