export const SHOPEE_VN_GRAPHQL_ENDPOINT = 'https://open-api.affiliate.shopee.vn/graphql';

export interface ShopeeCredentials {
  appId: string;
  secret: string;
  endpoint?: string;
}

export function hasShopeeCredentials<T extends { appId?: string; secret?: string }>(
  input: T | undefined,
): input is T & { appId: string; secret: string } {
  return Boolean(input?.appId?.trim() && input?.secret?.trim());
}

export async function signShopeeRequest(
  appId: string,
  secret: string,
  timestampSeconds: number,
  payload: string,
): Promise<string> {
  const factor = `${appId}${timestampSeconds}${payload}${secret}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(factor));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function shopeeAuthorizationHeader(
  appId: string,
  timestampSeconds: number,
  signature: string,
): string {
  return `SHA256 Credential=${appId}, Timestamp=${timestampSeconds}, Signature=${signature}`;
}
