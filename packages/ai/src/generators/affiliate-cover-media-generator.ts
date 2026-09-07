import {
  MediaGenerationError,
  type MediaGenerationContext,
  type MediaGenerator,
  type GeneratedMediaBinary,
} from '@social-autopilot/core';
import { ZodError } from 'zod';
import type { AIProvider } from '../providers/types.js';
import { withTimeout } from '../lib/timeout.js';
import { COVER_IMAGE_SYSTEM_PROMPT, coverImageSpecSchema } from '../prompts/cover-image.js';
import { buildSvgCover, svgToArrayBuffer } from './svg-cover.js';

export const DEFAULT_COVER_MEDIA_TIMEOUT_MS = 60_000;

function buildCoverPrompt(context: MediaGenerationContext): string {
  const { content, productTitle, productImageUrl } = context;
  return [
    `Content title (hook): ${content.title}`,
    `Content body:\n${content.body}`,
    productTitle ? `Product: ${productTitle}` : '',
    productImageUrl ? `Reference product image URL (style reference only): ${productImageUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export class AiSvgCoverMediaGenerator implements MediaGenerator {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly timeoutMs = DEFAULT_COVER_MEDIA_TIMEOUT_MS,
  ) {}

  async generate(context: MediaGenerationContext): Promise<GeneratedMediaBinary> {
    const prompt = buildCoverPrompt(context);
    if (!prompt.trim()) {
      throw new MediaGenerationError('Content is required to generate media', 'invalid');
    }

    try {
      const spec = await withTimeout(
        this.aiProvider.generateStructured({
          prompt,
          systemPrompt: COVER_IMAGE_SYSTEM_PROMPT,
          schema: coverImageSpecSchema,
        }),
        this.timeoutMs,
        'Media generation timed out',
      );

      const svg = buildSvgCover(spec);
      const body = svgToArrayBuffer(svg);

      return {
        body,
        mimeType: 'image/svg+xml',
        mediaType: 'image',
        metadata: {
          generator: 'ai-svg-cover',
          headline: spec.headline,
        },
      };
    } catch (error) {
      if (error instanceof MediaGenerationError) {
        throw error;
      }
      if (error instanceof ZodError) {
        throw new MediaGenerationError('AI returned an invalid cover image specification', 'invalid', {
          issues: error.issues,
        });
      }
      if (error instanceof Error && error.message === 'Media generation timed out') {
        throw new MediaGenerationError('Media generation timed out', 'timeout', {
          timeoutMs: this.timeoutMs,
        });
      }
      throw new MediaGenerationError(
        error instanceof Error ? error.message : 'Media generation failed',
        'generation',
      );
    }
  }
}

export function createAffiliateCoverMediaGenerator(
  aiProvider: AIProvider,
  options?: { timeoutMs?: number },
): MediaGenerator {
  return new AiSvgCoverMediaGenerator(aiProvider, options?.timeoutMs);
}
