import type { SocialPlatform, SocialPublisher } from '@social-autopilot/core';
import { MockTikTokPublisher } from './mock.js';
import { TikTokPublisher, type TikTokPublisherDeps } from '../tiktok/TikTokPublisher.js';

export interface CreateSocialPublishersOptions {
  tiktokConfigured: boolean;
  tiktokDeps?: TikTokPublisherDeps;
}

export function createSocialPublishers(
  options: CreateSocialPublishersOptions = { tiktokConfigured: false },
): Map<SocialPlatform, SocialPublisher> {
  if (options.tiktokConfigured && options.tiktokDeps) {
    return new Map([['tiktok', new TikTokPublisher(options.tiktokDeps)]]);
  }
  return new Map([['tiktok', new MockTikTokPublisher()]]);
}

export * from './mock.js';
