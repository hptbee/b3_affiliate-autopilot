import type { PublishPostInput, PublishPostResult, SocialPublisher } from '@social-autopilot/core';

/**
 * Mock TikTok publisher for development and tests.
 * Does NOT call the TikTok API. Phase 1C will replace this with TikTokPublisher.
 */
export class MockTikTokPublisher implements SocialPublisher {
  readonly platform = 'tiktok' as const;

  async publish(input: PublishPostInput): Promise<PublishPostResult> {
    return {
      externalPostId: `mock-tiktok-${input.idempotencyKey}`,
      platform: 'tiktok',
      publishedAt: new Date(),
    };
  }
}
