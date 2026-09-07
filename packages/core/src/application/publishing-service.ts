import type { Content } from '../domain/content.js';
import { parseAffiliateContentMetadata } from '../domain/content.js';
import { assertContentContainsAffiliateUrl } from '../domain/affiliate-link-validation.js';
import type { ScheduledPost } from '../domain/scheduled-post.js';
import type { SocialAccount, SocialPlatform } from '../domain/social-account.js';
import { ConflictError, SocialPublishError, NotFoundError } from '../types/errors.js';
import type { Logger } from '../types/logger.js';
import type { PublishMediaAttachment } from '../types/publishing.js';
import type { TokenStore } from '../types/token-store.js';
import type { UserContext } from '../types/user-context.js';
import type { ContentRepository } from './content-service.js';
import type { MediaRepository } from './media-service.js';
import type { ScheduledPostRepository } from './scheduled-post-service.js';
import type { SocialAccountRepository } from './scheduled-post-service.js';
import type { MediaStorage } from '../types/media-storage.js';

export interface PublishPostInput {
  content: Content;
  socialAccount: SocialAccount;
  scheduledPost: ScheduledPost;
  idempotencyKey: string;
  accessToken: string;
  mediaAttachments: PublishMediaAttachment[];
}

export interface PublishContentNowInput {
  contentId: string;
  socialAccountId: string;
}

export interface PublishContentNowResult extends PublishScheduledPostOutcome {
  scheduledPost: ScheduledPost;
}

export interface PublishPostResult {
  externalPostId: string;
  platform: SocialPlatform;
  publishedAt: Date;
}

export type PublishScheduledPostDisposition =
  | 'published'
  | 'already_published'
  | 'uncertain'
  | 'dead'
  | 'failed'
  | 'skipped';

export interface PublishScheduledPostOutcome {
  queueAction: 'ack' | 'retry';
  disposition: PublishScheduledPostDisposition;
  result?: PublishPostResult;
}

export interface SocialPublisher {
  platform: SocialPlatform;
  publish(input: PublishPostInput): Promise<PublishPostResult>;
}

export class PublishingService {
  constructor(
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly contentRepository: ContentRepository,
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly publishers: Map<SocialPlatform, SocialPublisher>,
    private readonly logger: Logger,
    private readonly tokenStore: TokenStore,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaStorage: MediaStorage,
  ) {}

  async publishContentNow(
    user: UserContext,
    input: PublishContentNowInput,
  ): Promise<PublishContentNowResult> {
    const content = await this.contentRepository.findById(input.contentId);
    if (!content || content.userId !== user.userId) {
      throw new NotFoundError('Content', input.contentId);
    }

    if (content.status !== 'approved') {
      throw new ConflictError(
        `Content must be approved to publish, current status: ${content.status}`,
      );
    }

    this.assertPublishableAffiliateContent(content);

    const account = await this.socialAccountRepository.findById(input.socialAccountId);
    if (!account || account.userId !== user.userId) {
      throw new NotFoundError('SocialAccount', input.socialAccountId);
    }

    if (account.status !== 'active') {
      throw new ConflictError(`Social account is not active: ${account.status}`);
    }

    const scheduledPost = await this.scheduledPostRepository.createImmediate({
      contentId: input.contentId,
      socialAccountId: input.socialAccountId,
    });

    const outcome = await this.publishScheduledPost(scheduledPost.id);
    const updated = await this.scheduledPostRepository.findById(scheduledPost.id);
    if (!updated) {
      throw new NotFoundError('ScheduledPost', scheduledPost.id);
    }

    return { ...outcome, scheduledPost: updated };
  }

  async publishScheduledPost(scheduledPostId: string): Promise<PublishScheduledPostOutcome> {
    const start = Date.now();
    const post = await this.scheduledPostRepository.findById(scheduledPostId);

    if (!post) {
      throw new NotFoundError('ScheduledPost', scheduledPostId);
    }

    if (post.externalPostId) {
      this.logger.info('Post already has externalPostId, acknowledging', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: 'published',
      });
      const existingAccount = await this.socialAccountRepository.findById(post.socialAccountId);
      return {
        queueAction: 'ack',
        disposition: 'already_published',
        result: {
          externalPostId: post.externalPostId,
          platform: existingAccount?.platform ?? 'facebook',
          publishedAt: post.publishedAt ?? new Date(),
        },
      };
    }

    if (post.status === 'uncertain') {
      this.logger.warn('Skipping uncertain post; will not retry', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: 'uncertain',
      });
      return { queueAction: 'ack', disposition: 'uncertain' };
    }

    const acquired = await this.scheduledPostRepository.acquirePublishingLock(
      scheduledPostId,
      new Date(),
    );
    if (!acquired) {
      this.logger.info('Could not acquire publishing lock, skipping', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: post.status,
      });
      return { queueAction: 'ack', disposition: 'skipped' };
    }

    try {
      const content = await this.contentRepository.findById(post.contentId);
      if (!content) {
        throw new NotFoundError('Content', post.contentId);
      }

      this.assertPublishableAffiliateContent(content);

      const account = await this.socialAccountRepository.findById(post.socialAccountId);
      if (!account) {
        throw new NotFoundError('SocialAccount', post.socialAccountId);
      }

      const publisher = this.publishers.get(account.platform);
      if (!publisher) {
        throw new SocialPublishError(
          `No publisher configured for platform: ${account.platform}`,
          'dead',
        );
      }

      const accessToken = await this.tokenStore.get(account.accessTokenRef);
      if (!accessToken) {
        throw new SocialPublishError(
          'Social account access token is missing or expired',
          'dead',
          { socialAccountId: account.id },
        );
      }

      const mediaAttachments = await this.loadMediaAttachments(content.id);

      const result = await publisher.publish({
        content,
        socialAccount: account,
        scheduledPost: post,
        idempotencyKey: scheduledPostId,
        accessToken,
        mediaAttachments,
      });

      await this.scheduledPostRepository.markPublished(scheduledPostId, result.externalPostId);

      this.logger.info('Successfully published scheduled post', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: 'published',
        duration: Date.now() - start,
      });

      return { queueAction: 'ack', disposition: 'published', result };
    } catch (error) {
      const outcome =
        error instanceof SocialPublishError ? error.outcome : ('failed' as const);
      const message = error instanceof Error ? error.message : 'Unknown publish error';

      if (outcome === 'uncertain') {
        await this.scheduledPostRepository.markUncertain(scheduledPostId, message);
      } else if (outcome === 'dead') {
        await this.scheduledPostRepository.markDead(scheduledPostId, message);
      } else {
        await this.scheduledPostRepository.markFailed(scheduledPostId, message);
      }

      this.logger.error('Failed to publish scheduled post', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: outcome,
        duration: Date.now() - start,
        errorCode: 'SOCIAL_PUBLISH_ERROR',
      });

      if (outcome === 'uncertain' || outcome === 'dead') {
        return { queueAction: 'ack', disposition: outcome };
      }

      return { queueAction: 'retry', disposition: 'failed' };
    }
  }

  private async loadMediaAttachments(contentId: string): Promise<PublishMediaAttachment[]> {
    const assets = await this.mediaRepository.findByContentId(contentId);
    const attachments: PublishMediaAttachment[] = [];

    for (const asset of assets) {
      const stored = await this.mediaStorage.get(asset.key);
      if (!stored) {
        this.logger.warn('Media object missing from storage during publish', {
          operation: 'publishing.loadMediaAttachments',
          entityId: asset.id,
        });
        continue;
      }

      const body = await new Response(stored.body).arrayBuffer();
      attachments.push({
        id: asset.id,
        mimeType: asset.mimeType,
        mediaType: asset.mediaType,
        body,
      });
    }

    return attachments;
  }

  private assertPublishableAffiliateContent(content: Content): void {
    const affiliateMeta = parseAffiliateContentMetadata(content.metadata);
    if (affiliateMeta) {
      assertContentContainsAffiliateUrl(content, affiliateMeta.affiliateUrl);
    }
  }
}
