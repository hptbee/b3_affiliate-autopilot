import type { Content } from '../domain/content.js';
import type { ScheduledPost } from '../domain/scheduled-post.js';
import type { SocialAccount, SocialPlatform } from '../domain/social-account.js';
import { SocialPublishError, NotFoundError } from '../types/errors.js';
import type { Logger } from '../types/logger.js';
import type { ContentRepository } from './content-service.js';
import type { ScheduledPostRepository } from './scheduled-post-service.js';
import type { SocialAccountRepository } from './scheduled-post-service.js';

export interface PublishPostInput {
  content: Content;
  socialAccount: SocialAccount;
  scheduledPost: ScheduledPost;
  idempotencyKey: string;
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
  ) {}

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
      return {
        queueAction: 'ack',
        disposition: 'already_published',
        result: {
          externalPostId: post.externalPostId,
          platform: 'tiktok',
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

      const result = await publisher.publish({
        content,
        socialAccount: account,
        scheduledPost: post,
        idempotencyKey: scheduledPostId,
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
}
