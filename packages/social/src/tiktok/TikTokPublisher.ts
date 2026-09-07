import type { PublishPostInput, PublishPostResult, SocialPublisher } from '@social-autopilot/core';
import { TikTokClient } from './TikTokClient.js';

export interface TikTokPublisherDeps {
  getAccessToken: (socialAccountId: string) => Promise<string>;
  getVideoBytes: (contentId: string) => Promise<{ bytes: ArrayBuffer; mimeType: string }>;
}

function toTikTokPrivacy(privacyLevel: string): 'SELF_ONLY' | 'PUBLIC_TO_EVERYONE' {
  return privacyLevel === 'public' ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY';
}

export class TikTokPublisher implements SocialPublisher {
  readonly platform = 'tiktok' as const;

  constructor(private readonly deps: TikTokPublisherDeps) {}

  async publish(input: PublishPostInput): Promise<PublishPostResult> {
    const accessToken = await this.deps.getAccessToken(input.socialAccount.id);
    const video = await this.deps.getVideoBytes(input.content.id);
    const client = new TikTokClient({ accessToken });

    const init = await client.initVideoUpload({
      caption: input.caption,
      privacyLevel: toTikTokPrivacy(input.scheduledPost.privacyLevel),
      videoSize: video.bytes.byteLength,
    });

    await client.uploadVideo(init.uploadUrl, video.bytes, video.mimeType);
    const externalPostId = await client.waitForPublish(init.publishId);

    return {
      externalPostId,
      platform: 'tiktok',
      publishedAt: new Date(),
    };
  }
}
