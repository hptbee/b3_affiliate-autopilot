import type { SocialPlatform } from '@social-autopilot/core';
import { MockSocialPublisher } from './mock.js';
import type { SocialPublisher } from '../types/index.js';

export function createSocialPublishers(): Map<SocialPlatform, SocialPublisher> {
  const platforms: SocialPlatform[] = ['linkedin', 'x', 'facebook', 'instagram'];
  return new Map(platforms.map((p) => [p, new MockSocialPublisher(p)]));
}

export * from './mock.js';
