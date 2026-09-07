import { describe, expect, it } from 'vitest';
import { mapShopeeProductOffer } from './mapper.js';
import { AffiliateProviderError } from '@social-autopilot/core';

const validNode = {
  itemId: 6309028319,
  productName: 'Apple iPhone 11 128GB',
  productLink: 'https://shopee.vn/Apple-Iphone-11-128GB-Local-Set-i.52377417.6309028319',
  offerLink: 'https://shope.ee/abc123',
  imageUrl: 'https://cf.shopee.vn/file/example.jpg',
  priceMin: '15000000',
  priceMax: '17000000',
  sales: 1234,
  ratingStar: '4.8',
  commissionRate: '0.05',
  sellerCommissionRate: '0.02',
  shopeeCommissionRate: '0.03',
  shopId: 52377417,
  shopName: 'Official Store',
  shopType: [1],
  productCatIds: [100, 200],
  periodEndTime: 1893456000,
};

describe('mapShopeeProductOffer', () => {
  it('maps required fields and keeps productUrl separate from affiliateUrl', () => {
    const product = mapShopeeProductOffer(validNode);
    expect(product.provider).toBe('shopee');
    expect(product.externalProductId).toBe('6309028319');
    expect(product.title).toBe('Apple iPhone 11 128GB');
    expect(product.productUrl).toContain('shopee.vn');
    expect(product.affiliateUrl).toBe('https://shope.ee/abc123');
    expect(product.productUrl).not.toBe(product.affiliateUrl);
    expect(product.price).toBe('15000000');
    expect(product.originalPrice).toBeNull();
    expect(product.description).toBeNull();
    expect(product.rating).toBe(4.8);
    expect(product.salesCount).toBe(1234);
    expect(product.images).toEqual(['https://cf.shopee.vn/file/example.jpg']);
    expect(product.commissionRate).toBe('0.05');
    expect(product.metadata.shopId).toBe('52377417');
  });

  it('accepts productId and soldCount aliases', () => {
    const product = mapShopeeProductOffer({
      ...validNode,
      itemId: undefined,
      productId: '99',
      sales: undefined,
      soldCount: 50,
    });
    expect(product.externalProductId).toBe('99');
    expect(product.salesCount).toBe(50);
  });

  it('treats missing optional fields as null', () => {
    const product = mapShopeeProductOffer({
      itemId: 1,
      productName: 'Name',
      productLink: 'https://shopee.vn/p-i.1.1',
    });
    expect(product.price).toBeNull();
    expect(product.rating).toBeNull();
    expect(product.salesCount).toBeNull();
    expect(product.images).toEqual([]);
    expect(product.affiliateUrl).toBeNull();
  });

  it('rejects missing identity', () => {
    expect(() =>
      mapShopeeProductOffer({
        productName: 'Name',
        productLink: 'https://shopee.vn/p',
      }),
    ).toThrow(AffiliateProviderError);
  });

  it('rejects missing title', () => {
    expect(() =>
      mapShopeeProductOffer({
        itemId: 1,
        productLink: 'https://shopee.vn/p-i.1.1',
      }),
    ).toThrow(/productName/);
  });

  it('rejects missing productLink', () => {
    expect(() =>
      mapShopeeProductOffer({
        itemId: 1,
        productName: 'Name',
      }),
    ).toThrow(/productLink/);
  });
});
