import type { Content } from '../domain/content.js';
import type { ScheduledPost } from '../domain/scheduled-post.js';
import type { SocialAccount } from '../domain/social-account.js';
import { ConflictError, NotFoundError, SocialPublishError } from '../types/errors.js';
import type { Logger } from '../types/logger.js';
import type { ContentRepository } from './content-service.js';
import type { ScheduledPostRepository } from './scheduled-post-service.js';
import type { SocialAccountRepository } from './scheduled-post-service.js';

export interface PublishPostInput {
  content: Content;
  socialAccount: SocialAccount;
  scheduledPost: ScheduledPost;
}

export interface PublishPostResult {
  externalPostId: string;
  platform: string;
  publishedAt: Date;
}

export interface SocialPublisher {
  platform: SocialAccount['platform'];
  publish(input: PublishPostInput): Promise<PublishPostResult>;
}

export class PublishingService {
  constructor(
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly contentRepository: ContentRepository,
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly publishers: Map<SocialAccount['platform'], SocialPublisher>,
    private readonly logger: Logger,
  ) {}

  async publishScheduledPost(scheduledPostId: string): Promise<PublishPostResult | null> {
    const start = Date.now();
    const post = await this.scheduledPostRepository.findById(scheduledPostId);

    if (!post) {
      throw new NotFoundError('ScheduledPost', scheduledPostId);
    }

    // Idempotency: already published
    if (post.status === 'published' && post.externalPostId) {
      this.logger.info('Post already published, acknowledging', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: 'published',
      });
      return {
        externalPostId: post.externalPostId,
        platform: 'unknown',
        publishedAt: post.publishedAt ?? new Date(),
      };
    }

    // Idempotency: another worker owns the job
    const acquired = await this.scheduledPostRepository.acquirePublishingLock(scheduledPostId);
    if (!acquired) {
      this.logger.info('Could not acquire publishing lock, skipping', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: post.status,
      });
      return null;
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
        throw new SocialPublishError(`No publisher configured for platform: ${account.platform}`);
      }

      const result = await publisher.publish({ content, socialAccount: account, scheduledPost: post });

      await this.scheduledPostRepository.markPublished(scheduledPostId, result.externalPostId);
      await this.contentRepository.update(content.id, { status: 'published' });

      this.logger.info('Successfully published scheduled post', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: 'published',
        duration: Date.now() - start,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown publish error';
      await this.scheduledPostRepository.markFailed(scheduledPostId, message);

      this.logger.error('Failed to publish scheduled post', {
        operation: 'publishing.publishScheduledPost',
        entityId: scheduledPostId,
        status: 'failed',
        duration: Date.now() - start,
        errorCode: error instanceof ConflictError ? 'CONFLICT' : 'SOCIAL_PUBLISH_ERROR',
      });

      throw error;
    }
  }
}
