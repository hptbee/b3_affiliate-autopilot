import { describe, expect, it, vi } from 'vitest';
import type { ScheduledPost } from '../domain/scheduled-post.js';
import { SchedulerService } from '../application/scheduler-service.js';
import type { ScheduledPostRepository } from '../application/scheduled-post-service.js';
import type { PublishQueue } from '../types/queue.js';
import { createLogger } from '../types/logger.js';

function createScheduledPost(overrides: Partial<ScheduledPost> = {}): ScheduledPost {
  return {
    id: 'post-1',
    contentId: 'content-1',
    socialAccountId: 'account-1',
    scheduledAt: new Date('2026-01-01T00:00:00Z'),
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

function createSchedulerService(options: {
  duePosts?: ScheduledPost[];
  reclaimCount?: number;
  claimSucceeds?: boolean;
}) {
  const sent: Array<{ scheduledPostId: string }> = [];
  const markedDead: string[] = [];
  let reclaimCount = options.reclaimCount ?? 0;

  const scheduledPostRepository: ScheduledPostRepository = {
    async create() {
      throw new Error('not implemented');
    },
    async findById() {
      return null;
    },
    async findByUserId() {
      return [];
    },
    async findByContentId() {
      return [];
    },
    async findDue() {
      return options.duePosts ?? [];
    },
    async cancel() {
      throw new Error('not implemented');
    },
    async acquirePublishingLock() {
      return true;
    },
    async markPublished() {
      throw new Error('not implemented');
    },
    async markFailed() {
      throw new Error('not implemented');
    },
    async markUncertain() {
      throw new Error('not implemented');
    },
    async markDead(id) {
      markedDead.push(id);
      return createScheduledPost({ id, status: 'dead' });
    },
    async claimForQueue() {
      return options.claimSucceeds ?? true;
    },
    async reclaimStalePublishing() {
      return reclaimCount;
    },
  };

  const publishQueue: PublishQueue = {
    send: vi.fn(async (message) => {
      sent.push(message);
    }),
    sendBatch: vi.fn(async (messages) => {
      sent.push(...messages);
    }),
  };

  const service = new SchedulerService(
    scheduledPostRepository,
    publishQueue,
    createLogger('test'),
  );

  return { service, sent, markedDead, publishQueue };
}

describe('SchedulerService.processDuePosts', () => {
  it('reclaims stale publishing records before scanning due posts', async () => {
    const { service } = createSchedulerService({ reclaimCount: 2, duePosts: [] });
    const result = await service.processDuePosts(new Date('2026-01-01T01:00:00Z'));
    expect(result.reclaimed).toBe(2);
  });

  it('skips posts with a recent queuedAt claim', async () => {
    const now = new Date('2026-01-01T01:00:00Z');
    const { service, sent } = createSchedulerService({
      duePosts: [
        createScheduledPost({
          id: 'recent',
          queuedAt: new Date(now.getTime() - 60_000),
        }),
      ],
    });

    const result = await service.processDuePosts(now);
    expect(result.enqueued).toBe(0);
    expect(result.skipped).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it('claims and enqueues due posts', async () => {
    const now = new Date('2026-01-01T01:00:00Z');
    const { service, sent, publishQueue } = createSchedulerService({
      duePosts: [createScheduledPost({ id: 'due-post' })],
    });

    const result = await service.processDuePosts(now);
    expect(result.enqueued).toBe(1);
    expect(sent).toEqual([{ scheduledPostId: 'due-post' }]);
    expect(publishQueue.send).toHaveBeenCalledOnce();
  });

  it('marks posts dead when retry count is exceeded', async () => {
    const now = new Date('2026-01-01T01:00:00Z');
    const { service, sent, markedDead } = createSchedulerService({
      duePosts: [createScheduledPost({ id: 'exhausted', retryCount: 3 })],
    });

    const result = await service.processDuePosts(now);
    expect(result.skipped).toBe(1);
    expect(markedDead).toEqual(['exhausted']);
    expect(sent).toHaveLength(0);
  });

  it('skips when claimForQueue loses the race', async () => {
    const now = new Date('2026-01-01T01:00:00Z');
    const { service, sent } = createSchedulerService({
      duePosts: [createScheduledPost({ id: 'contested' })],
      claimSucceeds: false,
    });

    const result = await service.processDuePosts(now);
    expect(result.skipped).toBe(1);
    expect(sent).toHaveLength(0);
  });
});
