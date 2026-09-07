import type { DiscoveredProduct } from '@social-autopilot/core';
import { AffiliateProviderError } from '@social-autopilot/core';

export interface ShopeeProductOfferNode {
  itemId?: number | string | null;
  productId?: number | string | null;
  productName?: string | null;
  productLink?: string | null;
  offerLink?: string | null;
  imageUrl?: string | null;
  priceMin?: string | number | null;
  priceMax?: string | number | null;
  price?: string | number | null;
  priceDiscountRate?: number | null;
  sales?: number | null;
  soldCount?: number | null;
  ratingStar?: string | number | null;
  commissionRate?: string | null;
  sellerCommissionRate?: string | null;
  shopeeCommissionRate?: string | null;
  shopId?: number | string | null;
  shopName?: string | null;
  shopType?: unknown;
  productCatIds?: unknown;
  periodStartTime?: number | null;
  periodEndTime?: number | null;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function unixToDate(value: unknown): Date | null {
  const n = asNumber(value);
  if (n === null || n <= 0) return null;
  return new Date(n * 1000);
}

export function mapShopeeProductOffer(node: ShopeeProductOfferNode): DiscoveredProduct {
  const externalProductId = asString(node.itemId ?? node.productId);
  const title = node.productName?.trim() ?? '';
  const productUrl = node.productLink?.trim() ?? '';

  if (!externalProductId) {
    throw new AffiliateProviderError('Shopee offer is missing itemId', 'malformed');
  }
  if (!title) {
    throw new AffiliateProviderError('Shopee offer is missing productName', 'malformed');
  }
  if (!productUrl) {
    throw new AffiliateProviderError('Shopee offer is missing productLink', 'malformed');
  }

  const imageUrl = node.imageUrl?.trim();
  const rating = asNumber(node.ratingStar);

  return {
    provider: 'shopee',
    externalProductId,
    title,
    description: null,
    price: asString(node.priceMin ?? node.price),
    originalPrice: null,
    rating,
    salesCount: asNumber(node.sales ?? node.soldCount),
    images: imageUrl ? [imageUrl] : [],
    productUrl,
    affiliateUrl: node.offerLink?.trim() || null,
    commissionRate: asString(node.commissionRate),
    offerExpiresAt: unixToDate(node.periodEndTime),
    metadata: {
      shopId: asString(node.shopId),
      shopName: node.shopName ?? null,
      shopType: node.shopType ?? null,
      productCatIds: node.productCatIds ?? null,
      priceMax: asString(node.priceMax),
      priceDiscountRate: node.priceDiscountRate ?? null,
      sellerCommissionRate: asString(node.sellerCommissionRate),
      shopeeCommissionRate: asString(node.shopeeCommissionRate),
      periodStartTime: node.periodStartTime ?? null,
      periodEndTime: node.periodEndTime ?? null,
    },
  };
}
