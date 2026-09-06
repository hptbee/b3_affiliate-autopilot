import { createAppContext } from '../lib/context.js';
import type { Env } from '../../worker-configuration.js';

export async function scheduled(
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const { schedulerService, logger } = createAppContext(env);
  const start = Date.now();

  logger.info('Cron trigger fired', {
    operation: 'scheduler.cron',
    status: 'started',
    cron: controller.cron,
  });

  const result = await schedulerService.processDuePosts(new Date());

  logger.info('Cron processing complete', {
    operation: 'scheduler.cron',
    status: 'completed',
    duration: Date.now() - start,
    enqueued: result.enqueued,
    skipped: result.skipped,
    reclaimed: result.reclaimed,
  });
}
