import type { SocialPublisher as CoreSocialPublisher } from '@social-autopilot/core';
import type { SocialPublisher as PackageSocialPublisher } from '@social-autopilot/social';
import type { SocialPlatform } from '@social-autopilot/core';

export function adaptSocialPublishers(
  publishers: Map<SocialPlatform, PackageSocialPublisher>,
): Map<SocialPlatform, CoreSocialPublisher> {
  const adapted = new Map<SocialPlatform, CoreSocialPublisher>();

  for (const [platform, publisher] of publishers) {
    adapted.set(platform, {
      platform,
      async publish(input) {
        const result = await publisher.publish({
          content: {
            id: input.content.id,
            title: input.content.title,
            body: input.content.body,
          },
          socialAccount: {
            id: input.socialAccount.id,
            platform: input.socialAccount.platform,
            externalAccountId: input.socialAccount.externalAccountId,
            displayName: input.socialAccount.displayName,
          },
        });
        return result;
      },
    });
  }

  return adapted;
}
