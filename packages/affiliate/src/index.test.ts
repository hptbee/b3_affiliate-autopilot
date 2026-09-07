import { describe, expect, it } from 'vitest';
import { createShopeeAffiliateNetwork } from './index.js';

describe('createShopeeAffiliateNetwork', () => {
  it('fails closed when secrets are missing', async () => {
    const network = createShopeeAffiliateNetwork({});
    await expect(network.searchProducts({ keyword: 'x' })).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });

  it('fails closed when secrets are whitespace', async () => {
    const network = createShopeeAffiliateNetwork({ appId: '  ', secret: '  ' });
    await expect(network.createAffiliateLink({ productUrl: 'https://shopee.vn/p-i.1.1' })).rejects.toMatchObject(
      { kind: 'unavailable' },
    );
  });
});
