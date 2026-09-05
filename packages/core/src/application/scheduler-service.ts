import type { ScheduledPost } from '../domain/scheduled-post.js';
import { MAX_PUBLISH_RETRIES } from '../domain/scheduled-post.js';
import type { Logger } from '../types/logger.js';
import type { PublishQueue } from '../types/queue.js';
import type { ScheduledPostRepository } from './scheduled-post-service.js';

export class SchedulerService {
  constructor(
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly publishQueue: PublishQueue,
    private readonly logger: Logger,
  ) {}

  async processDuePosts(now: Date): Promise<{ enqueued: number; skipped: number }> {
    const duePosts = await this.scheduledPostRepository.findDue(now);
    let enqueued = 0;
    let skipped = 0;

    for (const post of duePosts) {
      if (post.retryCount >= MAX_PUBLISH_RETRIES) {
        this.logger.warn('Skipping post exceeding max retries', {
          operation: 'scheduler.processDuePosts',
          entityId: post.id,
          status: post.status,
        });
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

    return { enqueued, skipped };
  }
}

export function filterDuePosts(posts: ScheduledPost[], now: Date): ScheduledPost[] {
  return posts.filter(
    (post) =>
      (post.status === 'scheduled' || post.status === 'failed') &&
      post.scheduledAt.getTime() <= now.getTime(),
  );
}
