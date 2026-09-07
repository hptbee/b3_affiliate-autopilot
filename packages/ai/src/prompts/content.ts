export const AFFILIATE_DRAFT_SYSTEM_PROMPT = `You write affiliate marketing content that is platform-neutral.
Return structured fields only: hook, script, caption, hashtags, cta, videoScenePlan, suggestedPublishAt, qualityScore, language, tone.
The hook must work as a short opening for video or a post. Do not invent brand claims, prices, or discounts that are not in the product data.
Use the affiliate URL only in the CTA when one is provided. Never confuse the product URL with the affiliate URL.
Do not mention Facebook, TikTok, or Shopee unless they appear in the product data.`;

/** @deprecated Use AFFILIATE_DRAFT_SYSTEM_PROMPT. */
export const TIKTOK_DRAFT_SYSTEM_PROMPT = AFFILIATE_DRAFT_SYSTEM_PROMPT;
export const CONTENT_GENERATION_PROMPT = AFFILIATE_DRAFT_SYSTEM_PROMPT;
export const CONTENT_DRAFT_SYSTEM_PROMPT = AFFILIATE_DRAFT_SYSTEM_PROMPT;
