import { createLogger } from '@social-autopilot/core';
import { createServices, CloudflarePublishQueue } from '@social-autopilot/database';
import { createSocialPublishers, adaptSocialPublishers } from '@social-autopilot/social';

export interface Env {
  DB: D1Database;
  PUBLISH_QUEUE: Queue<{ scheduledPostId: string }>;
  ENVIRONMENT: string;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const logger = createLogger('scheduler');
    const cron = controller.cron;

    logger.info('Cron trigger fired', {
      operation: 'scheduler.cron',
      status: 'started',
      cron: cron,
    });

    const publishQueue = new CloudflarePublishQueue(env.PUBLISH_QUEUE);
    const services = createServices({
      db: env.DB,
      publishQueue,
      publishers: adaptSocialPublishers(createSocialPublishers()),
      logger,
    });

    const start = Date.now();
    const result = await services.schedulerService.processDuePosts(new Date());

    logger.info('Cron processing complete', {
      operation: 'scheduler.cron',
      status: 'completed',
      duration: Date.now() - start,
      enqueued: result.enqueued,
      skipped: result.skipped,
    });

    ctx.waitUntil(Promise.resolve());
  },
};
