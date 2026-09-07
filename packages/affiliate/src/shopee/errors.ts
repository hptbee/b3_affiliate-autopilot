import { AffiliateProviderError, type AffiliateProviderErrorKind } from '@social-autopilot/core';

export interface ShopeeGraphQLError {
  message?: string;
  extensions?: { code?: number; message?: string };
}

export function mapShopeeError(code: number | undefined, message: string): AffiliateProviderError {
  const kind = kindForCode(code);
  return new AffiliateProviderError(message || defaultMessage(kind), kind, {
    provider: 'shopee',
    providerCode: code,
  });
}

function kindForCode(code: number | undefined): AffiliateProviderErrorKind {
  switch (code) {
    case 10020:
    case 10031:
    case 10032:
    case 10033:
    case 10034:
    case 10035:
      return 'authentication';
    case 10030:
      return 'rate_limit';
    case 10010:
    case 11001:
      return 'invalid';
    case 11000:
      return 'unavailable';
    default:
      return 'unknown';
  }
}

function defaultMessage(kind: AffiliateProviderErrorKind): string {
  switch (kind) {
    case 'authentication':
      return 'Shopee Affiliate authentication failed';
    case 'rate_limit':
      return 'Shopee Affiliate rate limit exceeded';
    case 'invalid':
      return 'Shopee Affiliate request was invalid';
    case 'unavailable':
      return 'Shopee Affiliate service unavailable';
    default:
      return 'Shopee Affiliate request failed';
  }
}

export function firstGraphQLError(errors: ShopeeGraphQLError[] | undefined): AffiliateProviderError | null {
  const error = errors?.[0];
  if (!error) return null;
  return mapShopeeError(
    error.extensions?.code,
    error.extensions?.message ?? error.message ?? 'Shopee GraphQL error',
  );
}
