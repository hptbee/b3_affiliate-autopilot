import type { AffiliateProviderId, DiscoveredProduct } from '../domain/product.js';
import type { GeneratedAffiliateLink } from '../domain/affiliate-offer.js';

export interface ProductSearchQuery {
  keyword?: string;
  externalProductId?: string;
  productUrl?: string;
  page?: number;
  limit?: number;
}

export interface ProductDiscovery {
  readonly provider: AffiliateProviderId;
  searchProducts(query: ProductSearchQuery): Promise<DiscoveredProduct[]>;
}

export interface AffiliateLinkGenerator {
  readonly provider: AffiliateProviderId;
  createAffiliateLink(input: {
    productUrl: string;
    trackingCodes?: string[];
  }): Promise<GeneratedAffiliateLink>;
}

/**
 * Combined port for a single affiliate network.
 * Methods exist only for capabilities we actually use.
 */
export interface AffiliateNetwork extends ProductDiscovery, AffiliateLinkGenerator {}
