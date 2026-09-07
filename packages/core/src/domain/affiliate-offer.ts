import type { AffiliateProvider } from './product.js';

/**
 * Monetization relationship for a Product.
 * Affiliate URL is not the Product URL.
 * Persistence is Phase 1 — this is a domain boundary only.
 */
export interface AffiliateOffer {
  id: string;
  productId: string;
  provider: AffiliateProvider;
  affiliateUrl: string;
  trackingCode: string | null;
  commissionRate: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}
