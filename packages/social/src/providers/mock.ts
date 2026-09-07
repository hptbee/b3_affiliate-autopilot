import type {
  PublishPostInput,
  PublishPostResult,
  SocialPlatform,
  SocialPublisher,
} from '@social-autopilot/core';

/**
 * In-process publisher stand-in. Does NOT call Facebook, TikTok, or any other live API.
 */
class MockSocialPublisher implements SocialPublisher {
  constructor(readonly platform: SocialPlatform) {}

  async publish(input: PublishPostInput): Promise<PublishPostResult> {
    return {
      externalPostId: `mock-${this.platform}-${input.idempotencyKey}`,
      platform: this.platform,
      publishedAt: new Date(),
    };
  }
}

/** First distribution target mock. Phase 4 will replace this with FacebookPublisher. */
export class MockFacebookPublisher extends MockSocialPublisher {
  constructor() {
    super('facebook');
  }
}

/** PENDING / FUTURE distribution mock. Must never be mistaken for a production TikTok client. */
export class MockTikTokPublisher extends MockSocialPublisher {
  constructor() {
    super('tiktok');
  }
}
