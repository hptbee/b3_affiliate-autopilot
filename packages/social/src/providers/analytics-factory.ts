import type { PostAnalyticsProvider, SocialPlatform } from '@social-autopilot/core';
import {
  FacebookPostAnalyticsProvider,
  MockFacebookPostAnalyticsProvider,
} from '../facebook/analytics.js';
import { FacebookGraphClient } from '../facebook/client.js';

export interface CreatePostAnalyticsProvidersOptions {
  useMockFacebook?: boolean;
  facebookApiVersion?: string;
  fetch?: typeof fetch;
}

export function createPostAnalyticsProviders(
  options: CreatePostAnalyticsProvidersOptions = {},
): Map<SocialPlatform, PostAnalyticsProvider> {
  const facebook =
    options.useMockFacebook === true
      ? new MockFacebookPostAnalyticsProvider()
      : new FacebookPostAnalyticsProvider(
          new FacebookGraphClient({
            apiVersion: options.facebookApiVersion,
            http: options.fetch ? { fetch: options.fetch } : undefined,
          }),
        );

  return new Map<SocialPlatform, PostAnalyticsProvider>([['facebook', facebook]]);
}

export * from '../facebook/analytics.js';
