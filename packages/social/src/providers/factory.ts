import type { SocialPlatform, SocialPublisher } from '@social-autopilot/core';
import { FacebookPublisher } from '../facebook/publisher.js';
import { MockFacebookPublisher, MockTikTokPublisher } from './mock.js';

export interface CreateSocialPublishersOptions {
  useMockFacebook?: boolean;
  facebookApiVersion?: string;
  fetch?: typeof fetch;
}

export function createSocialPublishers(
  options: CreateSocialPublishersOptions = {},
): Map<SocialPlatform, SocialPublisher> {
  const facebook =
    options.useMockFacebook === true
      ? new MockFacebookPublisher()
      : new FacebookPublisher({
          apiVersion: options.facebookApiVersion,
          http: options.fetch ? { fetch: options.fetch } : undefined,
        });

  return new Map([
    ['facebook', facebook],
    ['tiktok', new MockTikTokPublisher()],
  ]);
}

export * from './mock.js';
export * from '../facebook/publisher.js';
export * from '../facebook/client.js';
export * from '../facebook/errors.js';
