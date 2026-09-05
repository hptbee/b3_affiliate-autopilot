export const TIKTOK_DRAFT_SYSTEM_PROMPT = `You write TikTok short-form video drafts.
Return structured fields only: hook, script, caption, hashtags, cta, suggestedPublishAt, qualityScore.
Keep the hook under 3 seconds of spoken time. Do not invent brand claims.`;

export const CONTENT_GENERATION_PROMPT = TIKTOK_DRAFT_SYSTEM_PROMPT;
export const CONTENT_DRAFT_SYSTEM_PROMPT = TIKTOK_DRAFT_SYSTEM_PROMPT;
