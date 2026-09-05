import { createLogger } from '@social-autopilot/core';
import { createServices, CloudflarePublishQueue } from '@social-autopilot/database';
import { createSocialPublishers } from '@social-autopilot/social';

export interface Env {
  DB: D1Database;
  PUBLISH_QUEUE: Queue<{ scheduledPostId: string }>;
  ENVIRONMENT: string;
}

export default {
  async queue(batch: MessageBatch<{ scheduledPostId: string }>, env: Env): Promise<void> {
    const logger = createLogger('publisher');

    const publishQueue = new CloudflarePublishQueue(env.PUBLISH_QUEUE);
    const services = createServices({
      db: env.DB,
      publishQueue,
      publishers: createSocialPublishers(),
      logger,
    });

    for (const message of batch.messages) {
      const { scheduledPostId } = message.body;
      const start = Date.now();

      try {
        await services.publishingService.publishScheduledPost(scheduledPostId);
        message.ack();

        logger.info('Queue message processed', {
          operation: 'publisher.queue',
          entityId: scheduledPostId,
          status: 'acknowledged',
          duration: Date.now() - start,
        });
      } catch (error) {
        logger.error('Queue message failed', {
          operation: 'publisher.queue',
          entityId: scheduledPostId,
          status: 'retry',
          duration: Date.now() - start,
          errorCode: 'SOCIAL_PUBLISH_ERROR',
        });
        message.retry();
      }
    }
  },
};
