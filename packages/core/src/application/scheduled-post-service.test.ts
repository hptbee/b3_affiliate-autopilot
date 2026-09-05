import { describe, expect, it } from 'vitest';
import type { Content } from '../domain/content.js';
import type { ScheduledPost } from '../domain/scheduled-post.js';
import type { SocialAccount } from '../domain/social-account.js';
import { ScheduledPostService } from '../application/scheduled-post-service.js';
import type { ContentRepository } from '../application/content-service.js';
import type {
  ScheduledPostRepository,
  SocialAccountRepository,
} from '../application/scheduled-post-service.js';
import { ConflictError } from '../types/errors.js';
import { filterDuePosts } from '../application/scheduler-service.js';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);
const user = { userId: 'user-1' };
const other = { userId: 'user-2' };

function createScheduledPost(overrides: Partial<ScheduledPost> = {}): ScheduledPost {
  return {
    id: 'post-1',
    contentId: 'content-1',
    socialAccountId: 'account-1',
    scheduledAt: future,
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

function createContent(overrides: Partial<Content> = {}): Content {
  return {
    id: 'content-1',
    userId: 'user-1',
    title: 'Title',
    body: 'Body',
    status: 'approved',
    contentType: 'video',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
  return {
    id: 'account-1',
    userId: 'user-1',
    platform: 'tiktok',
    externalAccountId: 'ext-1',
    displayName: 'Test Account',
    accessTokenRef: 'token-ref',
    refreshTokenRef: null,
    tokenExpiresAt: null,
    metadata: {},
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createServices(
  content = createContent(),
  scheduledPost = createScheduledPost(),
  account = createAccount(),
) {
  const scheduledPosts = new Map([[scheduledPost.id, { ...scheduledPost }]]);
  const extraPosts: ScheduledPost[] = [];

  const scheduledPostRepository: ScheduledPostRepository = {
    async create(input) {
      const post = createScheduledPost({
        id: `post-new-${scheduledPosts.size}`,
        ...input,
      });
      scheduledPosts.set(post.id, post);
      extraPosts.push(post);
      return post;
    },
    async findById(id) {
      return scheduledPosts.get(id) ?? extraPosts.find((p) => p.id === id) ?? null;
    },
    async findByUserId(userId) {
      if (content.userId !== userId) return [];
      return [...scheduledPosts.values()];
    },
    async findByContentId(contentId) {
      return [...scheduledPosts.values()].filter((p) => p.contentId === contentId);
    },
    async findDue(date) {
      return [...scheduledPosts.values()].filter(
        (p) =>
          (p.status === 'scheduled' || p.status === 'failed') &&
          p.scheduledAt.getTime() <= date.getTime(),
      );
    },
    async cancel(id) {
      const post = scheduledPosts.get(id)!;
      const updated = { ...post, status: 'cancelled' as const };
      scheduledPosts.set(id, updated);
      return updated;
    },
    async claimForQueue() {
      return true;
    },
    async acquirePublishingLock() {
      return true;
    },
    async markPublished(id, externalPostId) {
      const post = scheduledPosts.get(id)!;
      const updated = {
        ...post,
        status: 'published' as const,
        externalPostId,
        publishedAt: new Date(),
      };
      scheduledPosts.set(id, updated);
      return updated;
    },
    async markFailed(id, error) {
      const post = scheduledPosts.get(id)!;
      const updated = {
        ...post,
        status: 'failed' as const,
        error,
        retryCount: post.retryCount + 1,
      };
      scheduledPosts.set(id, updated);
      return updated;
    },
    async markUncertain(id, error) {
      const post = scheduledPosts.get(id)!;
      const updated = { ...post, status: 'uncertain' as const, error };
      scheduledPosts.set(id, updated);
      return updated;
    },
    async markDead(id, error) {
      const post = scheduledPosts.get(id)!;
      const updated = { ...post, status: 'dead' as const, error };
      scheduledPosts.set(id, updated);
      return updated;
    },
    async reclaimStalePublishing() {
      return 0;
    },
  };

  const contentStore = new Map([[content.id, { ...content }]]);
  const contentRepository: ContentRepository = {
    async create() {
      throw new Error('not implemented');
    },
    async findById(id) {
      return contentStore.get(id) ?? null;
    },
    async findByUserId() {
      return [...contentStore.values()];
    },
    async update(id, input) {
      const existing = contentStore.get(id)!;
      const updated = { ...existing, ...input };
      contentStore.set(id, updated);
      return updated;
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

  return {
    service: new ScheduledPostService(
      scheduledPostRepository,
      contentRepository,
      socialAccountRepository,
    ),
    scheduledPosts,
    contentStore,
  };
}

describe('ScheduledPostService', () => {
  it('creates a scheduled post for approved content', async () => {
    const { service } = createServices();
    const post = await service.create(user, {
      contentId: 'content-1',
      socialAccountId: 'account-1',
      scheduledAt: future,
    });
    expect(post.status).toBe('scheduled');
  });

  it('cannot schedule draft content', async () => {
    const { service } = createServices(createContent({ status: 'draft' }));
    await expect(
      service.create(user, {
        contentId: 'content-1',
        socialAccountId: 'account-1',
        scheduledAt: future,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('cannot schedule cancelled content', async () => {
    const { service } = createServices(createContent({ status: 'cancelled' }));
    await expect(
      service.create(user, {
        contentId: 'content-1',
        socialAccountId: 'account-1',
        scheduledAt: future,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('cannot schedule in the past', async () => {
    const { service } = createServices();
    await expect(
      service.create(user, {
        contentId: 'content-1',
        socialAccountId: 'account-1',
        scheduledAt: past,
      }),
    ).rejects.toThrow('Scheduled time must be in the future');
  });

  it('cannot cancel published post', async () => {
    const { service } = createServices(
      createContent(),
      createScheduledPost({ status: 'published' }),
    );
    await expect(service.cancel(user, 'post-1')).rejects.toThrow(ConflictError);
  });

  it('does not schedule using another user\'s account', async () => {
    const { service } = createServices(
      createContent(),
      createScheduledPost(),
      createAccount({ userId: 'user-2' }),
    );
    await expect(
      service.create(user, {
        contentId: 'content-1',
        socialAccountId: 'account-1',
        scheduledAt: future,
      }),
    ).rejects.toThrow('SocialAccount not found');
  });

  it('does not let another user read a scheduled post', async () => {
    const { service } = createServices();
    await expect(service.getById(other, 'post-1')).rejects.toThrow('ScheduledPost not found');
  });

  it('allows multiple scheduled posts for the same content', async () => {
    const { service } = createServices();
    const first = await service.create(user, {
      contentId: 'content-1',
      socialAccountId: 'account-1',
      scheduledAt: future,
    });
    const second = await service.create(user, {
      contentId: 'content-1',
      socialAccountId: 'account-1',
      scheduledAt: new Date(future.getTime() + 60_000),
    });
    expect(first.id).not.toBe(second.id);
    expect(first.contentId).toBe(second.contentId);
  });
});

describe('Scheduler filtering', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  const futureDate = new Date('2026-01-16T12:00:00Z');
  const pastDate = new Date('2026-01-14T12:00:00Z');

  it('finds due posts', () => {
    const posts = [
      createScheduledPost({ id: '1', scheduledAt: pastDate, status: 'scheduled' }),
      createScheduledPost({ id: '2', scheduledAt: futureDate, status: 'scheduled' }),
    ];
    const due = filterDuePosts(posts, now);
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('1');
  });

  it('ignores already published posts', () => {
    const posts = [
      createScheduledPost({ id: '1', scheduledAt: pastDate, status: 'published' }),
    ];
    const due = filterDuePosts(posts, now);
    expect(due).toHaveLength(0);
  });

  it('ignores future posts', () => {
    const posts = [
      createScheduledPost({ id: '1', scheduledAt: futureDate, status: 'scheduled' }),
    ];
    const due = filterDuePosts(posts, now);
    expect(due).toHaveLength(0);
  });

  it('ignores uncertain posts', () => {
    const posts = [
      createScheduledPost({ id: '1', scheduledAt: pastDate, status: 'uncertain' }),
    ];
    const due = filterDuePosts(posts, now);
    expect(due).toHaveLength(0);
  });
});
