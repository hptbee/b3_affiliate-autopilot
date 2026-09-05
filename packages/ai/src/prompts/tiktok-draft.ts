import { z } from 'zod';

export const tiktokContentDraftSchema = z.object({
  hook: z.string().min(1),
  script: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  cta: z.string().min(1),
  suggestedPublishAt: z.string().datetime().optional(),
  qualityScore: z.number().min(0).max(1),
});

export type TikTokContentDraft = z.infer<typeof tiktokContentDraftSchema>;
