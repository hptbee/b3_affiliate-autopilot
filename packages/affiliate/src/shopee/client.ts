import { AffiliateProviderError } from '@social-autopilot/core';
import {
  SHOPEE_VN_GRAPHQL_ENDPOINT,
  type ShopeeCredentials,
  shopeeAuthorizationHeader,
  signShopeeRequest,
} from './auth.js';
import { firstGraphQLError, type ShopeeGraphQLError } from './errors.js';

export interface ShopeeGraphQLResponse<T> {
  data?: T;
  errors?: ShopeeGraphQLError[];
}

export interface ShopeeHttp {
  fetch: typeof fetch;
  nowSeconds?: () => number;
}

export class ShopeeAffiliateClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly nowSeconds: () => number;

  constructor(
    private readonly credentials: ShopeeCredentials,
    http: ShopeeHttp = { fetch: globalThis.fetch.bind(globalThis) },
  ) {
    this.endpoint = credentials.endpoint ?? SHOPEE_VN_GRAPHQL_ENDPOINT;
    this.fetchImpl = http.fetch;
    this.nowSeconds = http.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  }

  async graphql<T>(query: string): Promise<T> {
    const payload = JSON.stringify({ query });
    const timestamp = this.nowSeconds();
    const signature = await signShopeeRequest(
      this.credentials.appId,
      this.credentials.secret,
      timestamp,
      payload,
    );

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: shopeeAuthorizationHeader(this.credentials.appId, timestamp, signature),
        },
        body: payload,
      });
    } catch {
      throw new AffiliateProviderError('Shopee Affiliate request failed', 'unavailable', {
        provider: 'shopee',
      });
    }

    if (response.status === 429) {
      throw new AffiliateProviderError('Shopee Affiliate rate limit exceeded', 'rate_limit', {
        provider: 'shopee',
      });
    }

    let body: ShopeeGraphQLResponse<T>;
    try {
      body = (await response.json()) as ShopeeGraphQLResponse<T>;
    } catch {
      throw new AffiliateProviderError('Shopee Affiliate returned a malformed response', 'malformed', {
        provider: 'shopee',
        status: response.status,
      });
    }

    const graphqlError = firstGraphQLError(body.errors);
    if (graphqlError) {
      throw graphqlError;
    }

    if (!response.ok) {
      throw new AffiliateProviderError('Shopee Affiliate request failed', 'unknown', {
        provider: 'shopee',
        status: response.status,
      });
    }

    if (!body.data) {
      throw new AffiliateProviderError('Shopee Affiliate returned no data', 'malformed', {
        provider: 'shopee',
      });
    }

    return body.data;
  }
}

export const PRODUCT_OFFER_FIELDS = `
  itemId
  productName
  productLink
  offerLink
  imageUrl
  priceMin
  priceMax
  sales
  ratingStar
  commissionRate
  sellerCommissionRate
  shopeeCommissionRate
  shopId
  shopName
  shopType
  productCatIds
  periodStartTime
  periodEndTime
`;

export function productOfferQuery(args: {
  keyword?: string;
  itemId?: string;
  page?: number;
  limit?: number;
}): string {
  const parts: string[] = [];
  if (args.keyword) parts.push(`keyword: ${JSON.stringify(args.keyword)}`);
  if (args.itemId) {
    if (!/^\d+$/.test(args.itemId)) {
      throw new AffiliateProviderError('externalProductId must be a numeric Shopee item id', 'invalid');
    }
    parts.push(`itemId: ${args.itemId}`);
  }
  parts.push(`page: ${args.page ?? 1}`);
  parts.push(`limit: ${args.limit ?? 10}`);
  return `{ productOfferV2(${parts.join(', ')}) { nodes { ${PRODUCT_OFFER_FIELDS} } pageInfo { page limit hasNextPage } } }`;
}

export function generateShortLinkMutation(originUrl: string, subIds?: string[]): string {
  const sub = subIds && subIds.length > 0 ? `, subIds: ${JSON.stringify(subIds.slice(0, 5))}` : '';
  return `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(originUrl)}${sub} }) { shortLink } }`;
}
