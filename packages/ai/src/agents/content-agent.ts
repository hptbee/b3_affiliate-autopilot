import type { ContentService, UserContext } from '@social-autopilot/core';
import type { AIProvider } from '../providers/types.js';
import { TIKTOK_DRAFT_SYSTEM_PROMPT } from '../prompts/content.js';
import { tiktokContentDraftSchema } from '../prompts/tiktok-draft.js';
import type { AgentResult } from './types.js';

export interface GenerateDraftInput {
  topic: string;
  tone?: string;
}

export interface GenerateDraftOutput {
  title: string;
  body: string;
  contentId: string;
  qualityScore: number;
}

/**
 * Deterministic TikTok draft generator. No tool loop.
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
      const prompt = [`Topic: ${input.topic}`, input.tone ? `Tone: ${input.tone}` : '']
        .filter(Boolean)
        .join('\n');

      const draft = await this.aiProvider.generateStructured({
        prompt,
        systemPrompt: TIKTOK_DRAFT_SYSTEM_PROMPT,
        schema: tiktokContentDraftSchema,
      });

      const title = draft.hook;
      const body = [draft.script, draft.caption, draft.cta, (draft.hashtags ?? []).join(' ')]
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
