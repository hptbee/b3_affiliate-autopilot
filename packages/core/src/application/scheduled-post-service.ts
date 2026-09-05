import type { ScheduledPost } from '../domain/scheduled-post.js';
import {
  canCancelScheduledPost,
  isPublishable,
  MAX_PUBLISH_RETRIES,
} from '../domain/scheduled-post.js';
import type { SocialAccount } from '../domain/social-account.js';
import type { UserContext } from '../types/user-context.js';
import { ConflictError, NotFoundError, ValidationError } from '../types/errors.js';
import type { ContentRepository } from './content-service.js';

export interface CreateScheduledPostInput {
  contentId: string;
  socialAccountId: string;
  scheduledAt: Date;
}

export interface ScheduledPostRepository {
  create(input: CreateScheduledPostInput): Promise<ScheduledPost>;
  findById(id: string): Promise<ScheduledPost | null>;
  findByUserId(userId: string): Promise<ScheduledPost[]>;
  findByContentId(contentId: string): Promise<ScheduledPost[]>;
  findDue(now: Date): Promise<ScheduledPost[]>;
  cancel(id: string): Promise<ScheduledPost>;
  claimForQueue(id: string, now: Date): Promise<boolean>;
  acquirePublishingLock(id: string, now: Date): Promise<boolean>;
  markPublished(id: string, externalPostId: string): Promise<ScheduledPost>;
  markFailed(id: string, error: string): Promise<ScheduledPost>;
  markUncertain(id: string, error: string): Promise<ScheduledPost>;
  markDead(id: string, error: string): Promise<ScheduledPost>;
  reclaimStalePublishing(now: Date, leaseMs: number): Promise<number>;
}

export interface SocialAccountRepository {
  findById(id: string): Promise<SocialAccount | null>;
  findByUserId(userId: string): Promise<SocialAccount[]>;
}

export class ScheduledPostService {
  constructor(
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly contentRepository: ContentRepository,
    private readonly socialAccountRepository: SocialAccountRepository,
  ) {}

  async create(user: UserContext, input: CreateScheduledPostInput): Promise<ScheduledPost> {
    const content = await this.contentRepository.findById(input.contentId);
    if (!content || content.userId !== user.userId) {
      throw new NotFoundError('Content', input.contentId);
    }

    if (content.status !== 'approved') {
      throw new ConflictError(
        `Content must be approved to schedule, current status: ${content.status}`,
      );
    }

    const account = await this.socialAccountRepository.findById(input.socialAccountId);
    if (!account || account.userId !== user.userId) {
      throw new NotFoundError('SocialAccount', input.socialAccountId);
    }

    if (account.platform !== 'tiktok') {
      throw new ValidationError('MVP only supports TikTok accounts');
    }

    if (input.scheduledAt.getTime() <= Date.now()) {
      throw new ValidationError('Scheduled time must be in the future');
    }

    return this.scheduledPostRepository.create(input);
  }

  async getById(user: UserContext, id: string): Promise<ScheduledPost> {
    const post = await this.scheduledPostRepository.findById(id);
    if (!post) {
      throw new NotFoundError('ScheduledPost', id);
    }

    const content = await this.contentRepository.findById(post.contentId);
    if (!content || content.userId !== user.userId) {
      throw new NotFoundError('ScheduledPost', id);
    }

    return post;
  }

  async list(user: UserContext): Promise<ScheduledPost[]> {
    return this.scheduledPostRepository.findByUserId(user.userId);
  }

  async cancel(user: UserContext, id: string): Promise<ScheduledPost> {
    const post = await this.getById(user, id);

    if (!canCancelScheduledPost(post.status)) {
      throw new ConflictError(`Cannot cancel scheduled post with status: ${post.status}`);
    }

    return this.scheduledPostRepository.cancel(id);
  }

  async findDuePosts(now: Date): Promise<ScheduledPost[]> {
    return this.scheduledPostRepository.findDue(now);
  }

  validatePublishable(post: ScheduledPost): void {
    if (post.externalPostId) {
      throw new ConflictError('Post is already published', { scheduledPostId: post.id });
    }

    if (post.status === 'uncertain') {
      throw new ConflictError('Post has an uncertain publish outcome and must not be retried', {
        scheduledPostId: post.id,
      });
    }

    if (!isPublishable(post.status)) {
      throw new ConflictError(`Post is not publishable, status: ${post.status}`, {
        scheduledPostId: post.id,
      });
    }

    if (post.retryCount >= MAX_PUBLISH_RETRIES) {
      throw new ConflictError('Maximum publish retries exceeded', {
        scheduledPostId: post.id,
        retryCount: post.retryCount,
      });
    }
  }
}
