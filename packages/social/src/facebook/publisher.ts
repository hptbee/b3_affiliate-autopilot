import type {
  PublishMediaAttachment,
  PublishPostInput,
  PublishPostResult,
  SocialPublisher,
} from '@social-autopilot/core';
import { SocialPublishError } from '@social-autopilot/core';
import { FacebookGraphClient, type FacebookGraphClientOptions } from './client.js';
import { mapFacebookError } from './errors.js';

const FACEBOOK_SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

export interface FacebookPublisherOptions extends FacebookGraphClientOptions {}

export class FacebookPublisher implements SocialPublisher {
  readonly platform = 'facebook' as const;
  private readonly client: FacebookGraphClient;

  constructor(options: FacebookPublisherOptions = {}) {
    this.client = new FacebookGraphClient(options);
  }

  async publish(input: PublishPostInput): Promise<PublishPostResult> {
    const pageId = input.socialAccount.externalAccountId;
    const message = buildPostMessage(input.content);
    const photo = selectPublishablePhoto(input.mediaAttachments);

    try {
      if (photo) {
        const blob = new Blob([photo.body], { type: photo.mimeType });
        const extension = extensionForMimeType(photo.mimeType);
        const result = await this.client.publishPhoto(pageId, input.accessToken, {
          message,
          source: blob,
          filename: `cover.${extension}`,
        });

        return {
          externalPostId: result.post_id ?? result.id,
          platform: 'facebook',
          publishedAt: new Date(),
        };
      }

      const result = await this.client.publishFeed(pageId, input.accessToken, message);
      return {
        externalPostId: result.id,
        platform: 'facebook',
        publishedAt: new Date(),
      };
    } catch (error) {
      throw mapFacebookError(error);
    }
  }
}

export function buildPostMessage(content: PublishPostInput['content']): string {
  const title = content.title.trim();
  const body = content.body.trim();
  if (title && body) {
    return `${title}\n\n${body}`;
  }
  return title || body;
}

export function selectPublishablePhoto(
  attachments: PublishMediaAttachment[],
): PublishMediaAttachment | null {
  for (const attachment of attachments) {
    if (attachment.mediaType !== 'image') continue;
    if (attachment.mimeType === 'image/svg+xml') continue;
    if (!FACEBOOK_SUPPORTED_IMAGE_MIME_TYPES.has(attachment.mimeType)) continue;
    if (!attachment.body || attachment.body.byteLength === 0) continue;
    return attachment;
  }
  return null;
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/bmp':
      return 'bmp';
    case 'image/tiff':
      return 'tiff';
    default:
      return 'img';
  }
}

export async function connectFacebookPage(
  client: FacebookGraphClient,
  connect: (page: { id: string; name: string }) => Promise<unknown>,
  input: { pageId: string; pageAccessToken: string; displayName?: string },
): Promise<{ pageId: string; displayName: string }> {
  const page = await client.getPage(input.pageId, input.pageAccessToken);
  if (page.id !== input.pageId) {
    throw new SocialPublishError('Facebook page id does not match verified page', 'dead', {
      requestedPageId: input.pageId,
      verifiedPageId: page.id,
    });
  }

  const displayName = input.displayName?.trim() || page.name;
  await connect({ id: page.id, name: displayName });
  return { pageId: page.id, displayName };
}
