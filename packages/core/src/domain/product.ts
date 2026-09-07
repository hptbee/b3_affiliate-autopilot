/**
 * Affiliate-provider listing. Persistence is Phase 1 — this is a domain boundary only.
 * Product URL is not an affiliate URL.
 */
export const AFFILIATE_PROVIDERS = ['shopee'] as const;

export type AffiliateProvider = (typeof AFFILIATE_PROVIDERS)[number];

export const PRIMARY_AFFILIATE_PROVIDER = 'shopee' as const;

export interface Product {
  id: string;
  provider: AffiliateProvider;
  externalProductId: string;
  title: string;
  description: string;
  price: string | null;
  originalPrice: string | null;
  rating: number | null;
  salesCount: number | null;
  images: string[];
  productUrl: string;
  metadata: Record<string, unknown>;
}
