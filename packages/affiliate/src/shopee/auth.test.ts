import { describe, expect, it } from 'vitest';
import { signShopeeRequest, shopeeAuthorizationHeader } from './auth.js';

describe('Shopee request signing', () => {
  it('builds SHA256(AppId + Timestamp + Payload + Secret)', async () => {
    const signature = await signShopeeRequest('123', 'secret', 1577836800, '{"query":"{}"}');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    const again = await signShopeeRequest('123', 'secret', 1577836800, '{"query":"{}"}');
    expect(again).toBe(signature);
    const different = await signShopeeRequest('123', 'secret', 1577836801, '{"query":"{}"}');
    expect(different).not.toBe(signature);
  });

  it('formats the authorization header without the secret', () => {
    const header = shopeeAuthorizationHeader('123', 1, 'abcd');
    expect(header).toBe('SHA256 Credential=123, Timestamp=1, Signature=abcd');
    expect(header).not.toContain('secret');
  });
});
