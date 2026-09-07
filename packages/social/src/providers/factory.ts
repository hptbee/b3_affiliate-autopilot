import type { SocialPlatform, SocialPublisher } from '@social-autopilot/core';
import { MockFacebookPublisher, MockTikTokPublisher } from './mock.js';

export function createSocialPublishers(): Map<SocialPlatform, SocialPublisher> {
  return new Map([
    ['facebook', new MockFacebookPublisher()],
    ['tiktok', new MockTikTokPublisher()],
  ]);
}

export * from './mock.js';
