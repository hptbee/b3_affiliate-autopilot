import { describe, expect, it, vi } from 'vitest';
import { ShopeeAffiliateNetwork } from './network.js';
import { ShopeeAffiliateClient } from './client.js';
import { AffiliateProviderError } from '@social-autopilot/core';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function networkWithFetch(fetchImpl: typeof fetch): ShopeeAffiliateNetwork {
  const client = new ShopeeAffiliateClient(
    { appId: 'app', secret: 'secret' },
    { fetch: fetchImpl, nowSeconds: () => 1_700_000_000 },
  );
  return new ShopeeAffiliateNetwork(client);
}

describe('ShopeeAffiliateNetwork', () => {
  it('searches productOfferV2 and maps nodes', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: {
          productOfferV2: {
            nodes: [
              {
                itemId: 11,
                productName: 'Widget',
                productLink: 'https://shopee.vn/widget-i.1.11',
                offerLink: 'https://shope.ee/w',
                imageUrl: 'https://cf.shopee.vn/file/w.jpg',
                priceMin: '1000',
                sales: 3,
                ratingStar: '5',
                commissionRate: '0.1',
              },
            ],
          },
        },
      }),
    );
    const network = networkWithFetch(fetchImpl as unknown as typeof fetch);
    const products = await network.searchProducts({ keyword: 'widget' });
    expect(products).toHaveLength(1);
    expect(products[0].externalProductId).toBe('11');
    expect(products[0].affiliateUrl).toBe('https://shope.ee/w');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('secret');
  });

  it('creates a short affiliate link', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: { generateShortLink: { shortLink: 'https://shope.ee/short' } },
      }),
    );
    const network = networkWithFetch(fetchImpl as unknown as typeof fetch);
    const link = await network.createAffiliateLink({
      productUrl: 'https://shopee.vn/widget-i.1.11',
      trackingCodes: ['fb', 'story'],
    });
    expect(link.affiliateUrl).toBe('https://shope.ee/short');
    expect(link.trackingCode).toBe('fb,story');
  });

  it('maps authentication failures', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errors: [{ message: 'Invalid Signature', extensions: { code: 10020 } }],
      }),
    );
    const network = networkWithFetch(fetchImpl as unknown as typeof fetch);
    await expect(network.searchProducts({ keyword: 'x' })).rejects.toMatchObject({
      kind: 'authentication',
    });
  });

  it('maps rate limits', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errors: [{ message: 'Rate limit exceeded', extensions: { code: 10030 } }],
      }),
    );
    const network = networkWithFetch(fetchImpl as unknown as typeof fetch);
    await expect(network.searchProducts({ keyword: 'x' })).rejects.toMatchObject({
      kind: 'rate_limit',
    });
  });

  it('rejects unparseable product URLs', async () => {
    const network = networkWithFetch(vi.fn() as unknown as typeof fetch);
    await expect(network.searchProducts({ productUrl: 'https://shope.ee/x' })).rejects.toThrow(
      AffiliateProviderError,
    );
  });

  it('treats empty offer list as not found at the service layer, not a crash', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { productOfferV2: { nodes: [] } } }));
    const network = networkWithFetch(fetchImpl as unknown as typeof fetch);
    await expect(network.searchProducts({ externalProductId: '1' })).resolves.toEqual([]);
  });

  it('fails on malformed JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('not-json', { status: 200 }));
    const network = networkWithFetch(fetchImpl as unknown as typeof fetch);
    await expect(network.searchProducts({ keyword: 'x' })).rejects.toMatchObject({
      kind: 'malformed',
    });
  });
});
