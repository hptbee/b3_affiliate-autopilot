import { describe, expect, it, vi } from 'vitest';
import type { Content, ContentStatus } from '../domain/content.js';
import { isStalePublishing, type ScheduledPost } from '../domain/scheduled-post.js';
import type { SocialAccount } from '../domain/social-account.js';
import {
  PublishingService,
  type PublishPostResult,
  type SocialPublisher,
} from '../application/publishing-service.js';
import type { ContentRepository, UpdateContentInput } from '../application/content-service.js';
import type {
  ScheduledPostRepository,
  SocialAccountRepository,
} from '../application/scheduled-post-service.js';
import { SocialPublishError } from '../types/errors.js';
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
    queuedAt: null,
    publishingStartedAt: null,
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
    status: 'approved',
    contentType: 'video',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createAccount(): SocialAccount {
  return {
    id: 'account-1',
    userId: 'user-1',
    platform: 'tiktok',
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

function emptyRepoMethods(): Pick<
  ScheduledPostRepository,
  | 'create'
  | 'findByUserId'
  | 'findByContentId'
  | 'findDue'
  | 'cancel'
  | 'claimForQueue'
  | 'reclaimStalePublishing'
> {
  return {
    async create() {
      throw new Error('not implemented');
    },
    async findByUserId() {
      return [];
    },
    async findByContentId() {
      return [];
    },
    async findDue() {
      return [];
    },
    async cancel() {
      throw new Error('not implemented');
    },
    async claimForQueue() {
      return true;
    },
    async reclaimStalePublishing() {
      return 0;
    },
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
  const contentUpdates: UpdateContentInput[] = [];
  const statusUpdates: ContentStatus[] = [];

  const scheduledPostRepository: ScheduledPostRepository = {
    ...emptyRepoMethods(),
    async findById() {
      return post;
    },
    async acquirePublishingLock() {
      if (post.status === 'publishing') return false;
      if (options.acquireLock === false) return false;
      post = { ...post, status: 'publishing', publishingStartedAt: new Date() };
      return true;
    },
    async markPublished(_id, externalPostId) {
      post = {
        ...post,
        status: 'published',
        externalPostId,
        publishedAt: new Date(),
      };
      return post;
    },
    async markFailed(_id, error) {
      post = {
        ...post,
        status: 'failed',
        error,
        retryCount: post.retryCount + 1,
      };
      return post;
    },
    async markUncertain(_id, error) {
      post = { ...post, status: 'uncertain', error };
      return post;
    },
    async markDead(_id, error) {
      post = { ...post, status: 'dead', error };
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
    async update(_id, input) {
      contentUpdates.push(input);
      return { ...content, ...input };
    },
    async updateStatus(_id, status) {
      statusUpdates.push(status);
      return { ...content, status };
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
    platform: 'tiktok',
    publish: vi.fn(async (): Promise<PublishPostResult> => {
      if (options.publishError) throw options.publishError;
      return (
        options.publishResult ?? {
          externalPostId: 'ext-post-1',
          platform: 'tiktok',
          publishedAt: new Date(),
        }
      );
    }),
  };

  const service = new PublishingService(
    scheduledPostRepository,
    contentRepository,
    socialAccountRepository,
    new Map([['tiktok', mockPublisher]]),
    createLogger('test'),
  );

  return { service, mockPublisher, getPost: () => post, contentUpdates, statusUpdates };
}

describe('PublishingService', () => {
  it('publishes successfully without changing Content status', async () => {
    const { service, mockPublisher, contentUpdates } = createPublishingService({});
    const outcome = await service.publishScheduledPost('post-1');
    expect(outcome.queueAction).toBe('ack');
    expect(outcome.disposition).toBe('published');
    expect(outcome.result?.externalPostId).toBe('ext-post-1');
    expect(mockPublisher.publish).toHaveBeenCalledOnce();
    expect(contentUpdates).toHaveLength(0);
  });

  it('skips when externalPostId already exists', async () => {
    const { service, mockPublisher } = createPublishingService({
      post: createScheduledPost({
        status: 'failed',
        externalPostId: 'already-published',
        publishedAt: new Date(),
      }),
    });
    const outcome = await service.publishScheduledPost('post-1');
    expect(outcome.queueAction).toBe('ack');
    expect(outcome.disposition).toBe('already_published');
    expect(outcome.result?.externalPostId).toBe('already-published');
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('skips when lock cannot be acquired', async () => {
    const { service, mockPublisher } = createPublishingService({
      post: createScheduledPost({ status: 'publishing' }),
      acquireLock: false,
    });
    const outcome = await service.publishScheduledPost('post-1');
    expect(outcome.queueAction).toBe('ack');
    expect(outcome.disposition).toBe('skipped');
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('marks retryable failures as failed and requests retry', async () => {
    const { service, getPost } = createPublishingService({
      publishError: new SocialPublishError('Rate limited', 'failed'),
    });
    const outcome = await service.publishScheduledPost('post-1');
    expect(outcome.queueAction).toBe('retry');
    expect(outcome.disposition).toBe('failed');
    expect(getPost().status).toBe('failed');
  });

  it('marks ambiguous provider errors as uncertain and acks', async () => {
    const { service, getPost } = createPublishingService({
      publishError: new SocialPublishError('Timeout after send', 'uncertain'),
    });
    const outcome = await service.publishScheduledPost('post-1');
    expect(outcome.queueAction).toBe('ack');
    expect(outcome.disposition).toBe('uncertain');
    expect(getPost().status).toBe('uncertain');
  });

  it('marks permanent errors as dead and acks', async () => {
    const { service, getPost } = createPublishingService({
      publishError: new SocialPublishError('Video rejected', 'dead'),
    });
    const outcome = await service.publishScheduledPost('post-1');
    expect(outcome.queueAction).toBe('ack');
    expect(outcome.disposition).toBe('dead');
    expect(getPost().status).toBe('dead');
  });

  it('does not retry uncertain posts', async () => {
    const { service, mockPublisher } = createPublishingService({
      post: createScheduledPost({ status: 'uncertain' }),
    });
    const outcome = await service.publishScheduledPost('post-1');
    expect(outcome.queueAction).toBe('ack');
    expect(outcome.disposition).toBe('uncertain');
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });
});

describe('publishing lease', () => {
  it('treats publishing without a start time as stale', () => {
    const post = createScheduledPost({ status: 'publishing', publishingStartedAt: null });
    expect(isStalePublishing(post, new Date())).toBe(true);
  });

  it('does not reclaim publishing that has an externalPostId', () => {
    const post = createScheduledPost({
      status: 'publishing',
      publishingStartedAt: new Date(Date.now() - 60 * 60 * 1000),
      externalPostId: 'ext',
    });
    expect(isStalePublishing(post, new Date())).toBe(false);
  });
});
