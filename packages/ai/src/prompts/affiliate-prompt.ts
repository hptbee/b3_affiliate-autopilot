import type { AffiliateContentGenerationContext } from '@social-autopilot/core';

export function buildAffiliateContentPrompt(context: AffiliateContentGenerationContext): string {
  const { product, offer, tone, language } = context;

  return [
    `Product title: ${product.title}`,
    product.description ? `Product description: ${product.description}` : '',
    product.price ? `Price: ${product.price}` : '',
    product.rating !== null ? `Rating: ${product.rating}` : '',
    product.salesCount !== null ? `Sales count: ${product.salesCount}` : '',
    `Product URL (reference only — do not use as CTA link): ${product.productUrl}`,
    `Affiliate URL (use in CTA): ${offer.affiliateUrl}`,
    offer.commissionRate ? `Commission rate: ${offer.commissionRate}` : '',
    tone ? `Tone: ${tone}` : '',
    language ? `Language: ${language}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
