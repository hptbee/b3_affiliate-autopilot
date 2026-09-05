import { z } from 'zod';
import type { ContentService } from '@social-autopilot/core';
import type { AIProvider } from '../providers/types.js';
import { CONTENT_DRAFT_SYSTEM_PROMPT } from '../prompts/content.js';
import type { AgentContext, AgentResult } from './types.js';

const draftSchema = z.object({
  title: z.string(),
  body: z.string(),
});

export interface GenerateDraftInput {
  topic: string;
  tone?: string;
  platform?: string;
}

export interface GenerateDraftOutput {
  title: string;
  body: string;
  contentId: string;
}

/**
 * Simple deterministic content agent that uses AI to generate a draft
 * and persists it via ContentService. No autonomous loop — designed for
 * future MCP/tool integration.
 */
export class ContentAgent {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly contentService: ContentService,
  ) {}

  async generateDraft(
    context: AgentContext,
    input: GenerateDraftInput,
  ): Promise<AgentResult<GenerateDraftOutput>> {
    try {
      const prompt = [
        `Topic: ${input.topic}`,
        input.tone ? `Tone: ${input.tone}` : '',
        input.platform ? `Target platform: ${input.platform}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const draft = await this.aiProvider.generateStructured({
        prompt,
        systemPrompt: CONTENT_DRAFT_SYSTEM_PROMPT,
        schema: draftSchema,
      });

      const content = await this.contentService.create({
        userId: context.userId,
        title: draft.title,
        body: draft.body,
      });

      return {
        success: true,
        data: {
          title: content.title,
          body: content.body,
          contentId: content.id,
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
