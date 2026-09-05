import type { SocialPlatform, SocialPublisher } from '@social-autopilot/core';
import { MockTikTokPublisher } from './mock.js';

export function createSocialPublishers(): Map<SocialPlatform, SocialPublisher> {
  return new Map([['tiktok', new MockTikTokPublisher()]]);
}

export * from './mock.js';
