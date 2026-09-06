import { createAppContext } from '../lib/context.js';
import type { Env } from '../../worker-configuration.js';

export async function queue(
  batch: MessageBatch<{ scheduledPostId: string }>,
  env: Env,
): Promise<void> {
  const { publishingService, logger } = createAppContext(env);

  for (const message of batch.messages) {
    const { scheduledPostId } = message.body;
    const start = Date.now();

    const outcome = await publishingService.publishScheduledPost(scheduledPostId);

    if (outcome.queueAction === 'ack') {
      message.ack();
      logger.info('Queue message processed', {
        operation: 'publisher.queue',
        entityId: scheduledPostId,
        status: 'acknowledged',
        disposition: outcome.disposition,
        duration: Date.now() - start,
      });
    } else {
      message.retry();
      logger.error('Queue message failed', {
        operation: 'publisher.queue',
        entityId: scheduledPostId,
        status: 'retry',
        disposition: outcome.disposition,
        duration: Date.now() - start,
        errorCode: 'SOCIAL_PUBLISH_ERROR',
      });
    }
  }
}
