import type { AffiliateProviderId } from './product.js';

/**
 * Monetization relationship for a Product.
 * Affiliate URL is not the Product URL.
 */
export interface AffiliateOffer {
  id: string;
  userId: string;
  productId: string;
  provider: AffiliateProviderId;
  affiliateUrl: string;
  trackingCode: string | null;
  commissionRate: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface GeneratedAffiliateLink {
  affiliateUrl: string;
  trackingCode: string | null;
}
