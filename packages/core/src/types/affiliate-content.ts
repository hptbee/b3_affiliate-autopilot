import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import type { AffiliateContentCopy } from '../domain/content.js';
import type { Product } from '../domain/product.js';

/** Provider-independent input for affiliate content generation. */
export interface AffiliateContentGenerationContext {
  product: Product;
  offer: AffiliateOffer;
  tone?: string;
  language?: string;
}

/** Structured AI output before persistence. */
export interface GeneratedAffiliateContentDraft {
  copy: AffiliateContentCopy;
  qualityScore: number;
  videoScenePlan?: string;
}

/** Replaceable AI port. Implementations live outside core (e.g. packages/ai). */
export interface AffiliateContentGenerator {
  generate(context: AffiliateContentGenerationContext): Promise<GeneratedAffiliateContentDraft>;
}
