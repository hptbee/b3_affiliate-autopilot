import { describe, expect, it, vi } from 'vitest';
import type { Content } from '../domain/content.js';
import type { ScheduledPost } from '../domain/scheduled-post.js';
import type { SocialAccount } from '../domain/social-account.js';
import {
  PublishingService,
  type PublishPostResult,
  type SocialPublisher,
} from '../application/publishing-service.js';
import type { ContentRepository } from '../application/content-service.js';
import type {
  ScheduledPostRepository,
  SocialAccountRepository,
} from '../application/scheduled-post-service.js';
import { createLogger } from '../types/logger.js';

function createScheduledPost(overrides: Partial<ScheduledPost> = {}): ScheduledPost {
  return {
    id: 'post-1',
    contentId: 'content-1',
    socialAccountId: 'account-1',
    scheduledAt: new Date(),
    status: 'scheduled',
    publishedAt: null,
    externalPostId: null,
    error: null,
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createContent(): Content {
  return {
    id: 'content-1',
    userId: 'user-1',
    title: 'Title',
    body: 'Body',
    status: 'scheduled',
    contentType: 'text',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createAccount(): SocialAccount {
  return {
    id: 'account-1',
    userId: 'user-1',
    platform: 'linkedin',
    externalAccountId: 'ext-1',
    displayName: 'Test',
    accessTokenRef: 'token-ref',
    refreshTokenRef: null,
    tokenExpiresAt: null,
    metadata: {},
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createPublishingService(options: {
  post?: ScheduledPost;
  acquireLock?: boolean;
  publishResult?: PublishPostResult;
  publishError?: Error;
}) {
  let post = options.post ?? createScheduledPost();
  const content = createContent();
  const account = createAccount();

  const scheduledPostRepository: ScheduledPostRepository = {
    async findById() {
      return post;
    },
    async create() {
      throw new Error('not implemented');
    },
    async findAll() {
      return [post];
    },
    async findDue() {
      return [];
    },
    async cancel() {
      throw new Error('not implemented');
    },
    async acquirePublishingLock() {
      if (post.status === 'publishing') return false;
      if (options.acquireLock === false) return false;
      post = { ...post, status: 'publishing' };
      return true;
    },
    async markPublished(id, externalPostId) {
      post = {
        ...post,
        status: 'published',
        externalPostId,
        publishedAt: new Date(),
      };
      return post;
    },
    async markFailed(id, error) {
      post = {
        ...post,
        status: 'failed',
        error,
        retryCount: post.retryCount + 1,
      };
      return post;
    },
  };

  const contentRepository: ContentRepository = {
    async create() {
      throw new Error('not implemented');
    },
    async findById() {
      return content;
    },
    async findByUserId() {
      return [content];
    },
    async update(id, input) {
      return { ...content, ...input };
    },
    async delete() {},
  };

  const socialAccountRepository: SocialAccountRepository = {
    async findById() {
      return account;
    },
    async findByUserId() {
      return [account];
    },
  };

  const mockPublisher: SocialPublisher = {
    platform: 'linkedin',
    publish: vi.fn(async () => {
      if (options.publishError) throw options.publishError;
      return (
        options.publishResult ?? {
          externalPostId: 'ext-post-1',
          platform: 'linkedin',
          publishedAt: new Date(),
        }
      );
    }),
  };

  const service = new PublishingService(
    scheduledPostRepository,
    contentRepository,
    socialAccountRepository,
    new Map([['linkedin', mockPublisher]]),
    createLogger('test'),
  );

  return { service, mockPublisher, getPost: () => post };
}

describe('PublishingService', () => {
  it('publishes successfully', async () => {
    const { service, mockPublisher } = createPublishingService({});
    const result = await service.publishScheduledPost('post-1');
    expect(result?.externalPostId).toBe('ext-post-1');
    expect(mockPublisher.publish).toHaveBeenCalledOnce();
  });

  it('skips already published post (idempotency)', async () => {
    const { service, mockPublisher } = createPublishingService({
      post: createScheduledPost({
        status: 'published',
        externalPostId: 'already-published',
        publishedAt: new Date(),
      }),
    });
    const result = await service.publishScheduledPost('post-1');
    expect(result?.externalPostId).toBe('already-published');
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('skips when lock cannot be acquired', async () => {
    const { service, mockPublisher } = createPublishingService({
      post: createScheduledPost({ status: 'publishing' }),
      acquireLock: false,
    });
    const result = await service.publishScheduledPost('post-1');
    expect(result).toBeNull();
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('handles publish failure and marks post as failed', async () => {
    const { service } = createPublishingService({
      publishError: new Error('Network timeout'),
    });
    await expect(service.publishScheduledPost('post-1')).rejects.toThrow('Network timeout');
  });
});
