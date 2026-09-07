import { z } from 'zod';

/**
 * Platform-neutral affiliate content draft.
 * Do not add Facebook- or TikTok-specific fields here.
 */
export const affiliateContentDraftSchema = z.object({
  hook: z.string().min(1),
  script: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  cta: z.string().min(1),
  videoScenePlan: z.string().optional(),
  suggestedPublishAt: z.string().datetime().optional(),
  qualityScore: z.number().min(0).max(1),
  language: z.string().optional(),
  tone: z.string().optional(),
});

export type AffiliateContentDraft = z.infer<typeof affiliateContentDraftSchema>;

/** @deprecated Use affiliateContentDraftSchema. Kept so existing imports keep working. */
export const tiktokContentDraftSchema = affiliateContentDraftSchema;

/** @deprecated Use AffiliateContentDraft. */
export type TikTokContentDraft = AffiliateContentDraft;
