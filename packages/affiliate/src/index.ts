import { AffiliateProviderError, type AffiliateNetwork } from '@social-autopilot/core';
import { hasShopeeCredentials } from './shopee/auth.js';
import { ShopeeAffiliateClient, type ShopeeHttp } from './shopee/client.js';
import { ShopeeAffiliateNetwork } from './shopee/network.js';

export interface CreateAffiliateNetworkOptions {
  appId?: string;
  secret?: string;
  endpoint?: string;
  http?: ShopeeHttp;
}

export function createShopeeAffiliateNetwork(
  options: CreateAffiliateNetworkOptions,
): AffiliateNetwork {
  if (!hasShopeeCredentials(options)) {
    return {
      provider: 'shopee',
      async searchProducts() {
        throw new AffiliateProviderError(
          'Shopee Affiliate credentials are not configured. Set SHOPEE_AFFILIATE_APP_ID and SHOPEE_AFFILIATE_SECRET after Open API access is granted.',
          'unavailable',
        );
      },
      async createAffiliateLink() {
        throw new AffiliateProviderError(
          'Shopee Affiliate credentials are not configured. Set SHOPEE_AFFILIATE_APP_ID and SHOPEE_AFFILIATE_SECRET after Open API access is granted.',
          'unavailable',
        );
      },
    };
  }

  const client = new ShopeeAffiliateClient(
    {
      appId: options.appId,
      secret: options.secret,
      endpoint: options.endpoint,
    },
    options.http,
  );
  return new ShopeeAffiliateNetwork(client);
}

export { ShopeeAffiliateNetwork } from './shopee/network.js';
export { ShopeeAffiliateClient } from './shopee/client.js';
export { mapShopeeProductOffer } from './shopee/mapper.js';
export { parseShopeeItemId } from './shopee/url.js';
export { mapShopeeError } from './shopee/errors.js';
export { signShopeeRequest, SHOPEE_VN_GRAPHQL_ENDPOINT } from './shopee/auth.js';
