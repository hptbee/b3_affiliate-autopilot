import {
  AIProviderError,
  type AffiliateContentGenerationContext,
  type AffiliateContentGenerator,
  type GeneratedAffiliateContentDraft,
} from '@social-autopilot/core';
import { ZodError } from 'zod';
import type { AIProvider } from '../providers/types.js';
import { withTimeout } from '../lib/timeout.js';
import { buildAffiliateContentPrompt } from '../prompts/affiliate-prompt.js';
import { AFFILIATE_DRAFT_SYSTEM_PROMPT } from '../prompts/content.js';
import {
  affiliateContentDraftSchema,
  type AffiliateContentDraft,
} from '../prompts/affiliate-draft.js';

export const DEFAULT_AFFILIATE_CONTENT_TIMEOUT_MS = 60_000;

function mapDraft(draft: AffiliateContentDraft): GeneratedAffiliateContentDraft {
  return {
    copy: {
      hook: draft.hook,
      script: draft.script,
      caption: draft.caption,
      cta: draft.cta,
      hashtags: draft.hashtags ?? [],
      language: draft.language,
      tone: draft.tone,
    },
    qualityScore: draft.qualityScore,
    videoScenePlan: draft.videoScenePlan,
  };
}

export class AiAffiliateContentGenerator implements AffiliateContentGenerator {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly timeoutMs = DEFAULT_AFFILIATE_CONTENT_TIMEOUT_MS,
  ) {}

  async generate(context: AffiliateContentGenerationContext): Promise<GeneratedAffiliateContentDraft> {
    const prompt = buildAffiliateContentPrompt(context);

    try {
      const draft = await withTimeout(
        this.aiProvider.generateStructured({
          prompt,
          systemPrompt: AFFILIATE_DRAFT_SYSTEM_PROMPT,
          schema: affiliateContentDraftSchema,
        }),
        this.timeoutMs,
        'AI generation timed out',
      );
      return mapDraft({
        ...draft,
        hashtags: draft.hashtags ?? [],
      });
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      if (error instanceof ZodError) {
        throw new AIProviderError('AI returned an invalid affiliate content draft', {
          issues: error.issues,
        });
      }
      if (error instanceof Error && error.message === 'AI generation timed out') {
        throw new AIProviderError('AI content generation timed out', {
          timeoutMs: this.timeoutMs,
        });
      }
      throw new AIProviderError(
        error instanceof Error ? error.message : 'AI content generation failed',
      );
    }
  }
}

export function createAffiliateContentGenerator(
  aiProvider: AIProvider,
  options?: { timeoutMs?: number },
): AffiliateContentGenerator {
  return new AiAffiliateContentGenerator(aiProvider, options?.timeoutMs);
}
