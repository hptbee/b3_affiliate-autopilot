import type { SocialPlatform } from '@social-autopilot/core';
import type { PublishPostInput, PublishPostResult, SocialPublisher } from '../types/index.js';

/**
 * Mock publisher for development and testing.
 * Does NOT call real social platform APIs.
 */
export class MockSocialPublisher implements SocialPublisher {
  constructor(public readonly platform: SocialPlatform) {}

  async publish(input: PublishPostInput): Promise<PublishPostResult> {
    const externalPostId = `mock-${this.platform}-${input.content.id}-${Date.now()}`;

    return {
      externalPostId,
      platform: this.platform,
      publishedAt: new Date(),
    };
  }
}

export function createMockPublishers(): Map<SocialPlatform, SocialPublisher> {
  const platforms: SocialPlatform[] = ['linkedin', 'x', 'facebook', 'instagram'];
  return new Map(platforms.map((p) => [p, new MockSocialPublisher(p)]));
}
