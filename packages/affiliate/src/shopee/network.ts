import type {
  AffiliateNetwork,
  DiscoveredProduct,
  GeneratedAffiliateLink,
  ProductSearchQuery,
} from '@social-autopilot/core';
import { AffiliateProviderError } from '@social-autopilot/core';
import { ShopeeAffiliateClient, generateShortLinkMutation, productOfferQuery } from './client.js';
import { mapShopeeProductOffer, type ShopeeProductOfferNode } from './mapper.js';
import { parseShopeeItemId } from './url.js';

interface ProductOfferResponse {
  productOfferV2?: {
    nodes?: ShopeeProductOfferNode[] | null;
  } | null;
}

interface ShortLinkResponse {
  generateShortLink?: { shortLink?: string | null } | null;
}

export class ShopeeAffiliateNetwork implements AffiliateNetwork {
  readonly provider = 'shopee' as const;

  constructor(private readonly client: ShopeeAffiliateClient) {}

  async searchProducts(query: ProductSearchQuery): Promise<DiscoveredProduct[]> {
    const itemId = query.externalProductId ?? (query.productUrl ? parseShopeeItemId(query.productUrl) : null);

    if (query.productUrl && !itemId && !query.keyword && !query.externalProductId) {
      throw new AffiliateProviderError(
        'Could not parse a Shopee item id from productUrl. Use a shopee.vn ...-i.{shopId}.{itemId} URL or pass externalProductId.',
        'invalid',
      );
    }

    if (!itemId && !query.keyword) {
      throw new AffiliateProviderError('keyword or item id is required', 'invalid');
    }

    const data = await this.client.graphql<ProductOfferResponse>(
      productOfferQuery({
        keyword: itemId ? undefined : query.keyword,
        itemId: itemId ?? undefined,
        page: query.page,
        limit: query.limit,
      }),
    );

    const nodes = data.productOfferV2?.nodes ?? [];
    const products: DiscoveredProduct[] = [];
    for (const node of nodes) {
      if (!node) continue;
      products.push(mapShopeeProductOffer(node));
    }
    return products;
  }

  async createAffiliateLink(input: {
    productUrl: string;
    trackingCodes?: string[];
  }): Promise<GeneratedAffiliateLink> {
    if (!input.productUrl.trim()) {
      throw new AffiliateProviderError('productUrl is required to create an affiliate link', 'invalid');
    }

    const data = await this.client.graphql<ShortLinkResponse>(
      generateShortLinkMutation(input.productUrl, input.trackingCodes),
    );
    const shortLink = data.generateShortLink?.shortLink?.trim();
    if (!shortLink) {
      throw new AffiliateProviderError('Shopee did not return a shortLink', 'malformed');
    }

    return {
      affiliateUrl: shortLink,
      trackingCode: input.trackingCodes?.filter(Boolean).join(',') || null,
    };
  }
}
