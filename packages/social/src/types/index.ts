import type { SocialPlatform } from '@social-autopilot/core';

export type { SocialPlatform };

export interface PublishPostInput {
  content: {
    id: string;
    title: string;
    body: string;
  };
  socialAccount: {
    id: string;
    platform: SocialPlatform;
    externalAccountId: string;
    displayName: string;
  };
}

export interface PublishPostResult {
  externalPostId: string;
  platform: SocialPlatform;
  publishedAt: Date;
}

export interface SocialPublisher {
  platform: SocialPlatform;
  publish(input: PublishPostInput): Promise<PublishPostResult>;
}
