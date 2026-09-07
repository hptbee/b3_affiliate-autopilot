import { z } from 'zod';

export const coverImageSpecSchema = z.object({
  headline: z.string().min(1).max(120),
  subtitle: z.string().min(1).max(200),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export type CoverImageSpec = z.infer<typeof coverImageSpecSchema>;

export const COVER_IMAGE_SYSTEM_PROMPT = `You design simple social cover images for affiliate marketing posts.
Return structured fields only: headline, subtitle, backgroundColor, textColor.
Headline should be short and punchy from the content hook. Subtitle supports the message.
Use hex colors (#RRGGBB). Keep text readable (contrast between background and text).
Do not invent prices or discounts not present in the input.`;
