import type { ScheduledPost } from '../domain/scheduled-post.js';
import {
  MAX_PUBLISH_RETRIES,
  PUBLISHING_LEASE_MS,
  QUEUE_CLAIM_TTL_MS,
} from '../domain/scheduled-post.js';
import type { Logger } from '../types/logger.js';
import type { PublishQueue } from '../types/queue.js';
import type { ScheduledPostRepository } from './scheduled-post-service.js';

export class SchedulerService {
  constructor(
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly publishQueue: PublishQueue,
    private readonly logger: Logger,
  ) {}

  async processDuePosts(now: Date): Promise<{ enqueued: number; skipped: number; reclaimed: number }> {
    const reclaimed = await this.scheduledPostRepository.reclaimStalePublishing(
      now,
      PUBLISHING_LEASE_MS,
    );

    const duePosts = await this.scheduledPostRepository.findDue(now);
    let enqueued = 0;
    let skipped = 0;

    for (const post of duePosts) {
      if (post.retryCount >= MAX_PUBLISH_RETRIES) {
        await this.scheduledPostRepository.markDead(post.id, 'Maximum publish retries exceeded');
        skipped++;
        continue;
      }

      if (post.queuedAt && now.getTime() - post.queuedAt.getTime() < QUEUE_CLAIM_TTL_MS) {
        skipped++;
        continue;
      }

      const claimed = await this.scheduledPostRepository.claimForQueue(post.id, now);
      if (!claimed) {
        skipped++;
        continue;
      }

      await this.publishQueue.send({ scheduledPostId: post.id });
      enqueued++;

      this.logger.info('Enqueued scheduled post for publishing', {
        operation: 'scheduler.processDuePosts',
        entityId: post.id,
      });
    }

    return { enqueued, skipped, reclaimed };
  }
}

export function filterDuePosts(posts: ScheduledPost[], now: Date): ScheduledPost[] {
  return posts.filter(
    (post) =>
      (post.status === 'scheduled' || post.status === 'failed') &&
      post.scheduledAt.getTime() <= now.getTime(),
  );
}
