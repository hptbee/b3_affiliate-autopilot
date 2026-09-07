import type { ContentService, UserContext } from '@social-autopilot/core';
import type { AIProvider } from '../providers/types.js';
import { AFFILIATE_DRAFT_SYSTEM_PROMPT } from '../prompts/content.js';
import { affiliateContentDraftSchema } from '../prompts/affiliate-draft.js';
import type { AgentResult } from './types.js';

export interface GenerateDraftInput {
  topic?: string;
  productTitle?: string;
  productDescription?: string;
  affiliateUrl?: string;
  tone?: string;
  language?: string;
}

export interface GenerateDraftOutput {
  title: string;
  body: string;
  contentId: string;
  qualityScore: number;
}

/**
 * Deterministic affiliate draft generator. No tool loop, no autonomous publishing.
 */
export class ContentAgent {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly contentService: ContentService,
  ) {}

  async generateDraft(
    user: UserContext,
    input: GenerateDraftInput,
  ): Promise<AgentResult<GenerateDraftOutput>> {
    try {
      const prompt = [
        input.productTitle ? `Product: ${input.productTitle}` : '',
        input.productDescription ? `Product description: ${input.productDescription}` : '',
        input.affiliateUrl ? `Affiliate URL (use in CTA only): ${input.affiliateUrl}` : '',
        input.topic ? `Topic: ${input.topic}` : '',
        input.tone ? `Tone: ${input.tone}` : '',
        input.language ? `Language: ${input.language}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      if (!prompt) {
        return { success: false, error: 'Product or topic is required' };
      }

      const draft = await this.aiProvider.generateStructured({
        prompt,
        systemPrompt: AFFILIATE_DRAFT_SYSTEM_PROMPT,
        schema: affiliateContentDraftSchema,
      });

      const title = draft.hook;
      const body = [
        draft.script,
        draft.caption,
        draft.cta,
        (draft.hashtags ?? []).join(' '),
        draft.videoScenePlan,
      ]
        .filter(Boolean)
        .join('\n\n');

      const content = await this.contentService.create(user, {
        title,
        body,
        contentType: 'video',
      });

      return {
        success: true,
        data: {
          title: content.title,
          body: content.body,
          contentId: content.id,
          qualityScore: draft.qualityScore,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
