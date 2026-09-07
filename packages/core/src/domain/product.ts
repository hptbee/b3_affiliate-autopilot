/**
 * Provider-independent product listing.
 * Product URL is not an affiliate URL.
 * Fields stay nullable when a provider cannot supply them.
 */
export const AFFILIATE_PROVIDERS = ['shopee'] as const;

export type AffiliateProviderId = (typeof AFFILIATE_PROVIDERS)[number];

export const PRIMARY_AFFILIATE_PROVIDER = 'shopee' as const;

export interface Product {
  id: string;
  userId: string;
  provider: AffiliateProviderId;
  externalProductId: string;
  title: string;
  description: string | null;
  price: string | null;
  originalPrice: string | null;
  rating: number | null;
  salesCount: number | null;
  images: string[];
  productUrl: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Catalog row before persistence. No owner id. */
export interface DiscoveredProduct {
  provider: AffiliateProviderId;
  externalProductId: string;
  title: string;
  description: string | null;
  price: string | null;
  originalPrice: string | null;
  rating: number | null;
  salesCount: number | null;
  images: string[];
  productUrl: string;
  /** Provider affiliate URL if the catalog already returned one (`offerLink`). */
  affiliateUrl: string | null;
  commissionRate: string | null;
  offerExpiresAt: Date | null;
  metadata: Record<string, unknown>;
}
