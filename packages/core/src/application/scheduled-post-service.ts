import type { Content } from '../domain/content.js';
import type { ScheduledPost } from '../domain/scheduled-post.js';
import {
  canCancelScheduledPost,
  isPublishable,
  MAX_PUBLISH_RETRIES,
} from '../domain/scheduled-post.js';
import type { SocialAccount } from '../domain/social-account.js';
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
  findAll(): Promise<ScheduledPost[]>;
  findDue(now: Date): Promise<ScheduledPost[]>;
  cancel(id: string): Promise<ScheduledPost>;
  acquirePublishingLock(id: string): Promise<boolean>;
  markPublished(id: string, externalPostId: string): Promise<ScheduledPost>;
  markFailed(id: string, error: string): Promise<ScheduledPost>;
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

  async create(input: CreateScheduledPostInput): Promise<ScheduledPost> {
    const content = await this.contentRepository.findById(input.contentId);
    if (!content) {
      throw new NotFoundError('Content', input.contentId);
    }

    if (content.status === 'cancelled') {
      throw new ConflictError('Cannot schedule cancelled content');
    }

    if (content.status !== 'approved' && content.status !== 'draft') {
      throw new ConflictError(
        `Content must be draft or approved to schedule, current status: ${content.status}`,
      );
    }

    const account = await this.socialAccountRepository.findById(input.socialAccountId);
    if (!account) {
      throw new NotFoundError('SocialAccount', input.socialAccountId);
    }

    if (account.userId !== content.userId) {
      throw new ValidationError('Social account does not belong to content owner');
    }

    if (input.scheduledAt.getTime() <= Date.now()) {
      throw new ValidationError('Scheduled time must be in the future');
    }

    const scheduledPost = await this.scheduledPostRepository.create(input);

    if (content.status === 'draft' || content.status === 'approved') {
      await this.contentRepository.update(content.id, { status: 'scheduled' });
    }

    return scheduledPost;
  }

  async getById(id: string): Promise<ScheduledPost> {
    const post = await this.scheduledPostRepository.findById(id);
    if (!post) {
      throw new NotFoundError('ScheduledPost', id);
    }
    return post;
  }

  async list(): Promise<ScheduledPost[]> {
    return this.scheduledPostRepository.findAll();
  }

  async cancel(id: string): Promise<ScheduledPost> {
    const post = await this.getById(id);

    if (!canCancelScheduledPost(post.status)) {
      throw new ConflictError(`Cannot cancel scheduled post with status: ${post.status}`);
    }

    return this.scheduledPostRepository.cancel(id);
  }

  async findDuePosts(now: Date): Promise<ScheduledPost[]> {
    return this.scheduledPostRepository.findDue(now);
  }

  validatePublishable(post: ScheduledPost): void {
    if (post.status === 'published') {
      throw new ConflictError('Post is already published', { scheduledPostId: post.id });
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

export type { Content };
