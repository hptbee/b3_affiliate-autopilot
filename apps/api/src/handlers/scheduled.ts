import { DEFAULT_AFFILIATE_PIPELINE_CRON, isAffiliatePipelineCron } from '@social-autopilot/core';
import { createAppContext } from '../lib/context.js';
import type { Env } from '../../worker-configuration.js';

export async function scheduled(
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  if (isAffiliatePipelineCron(controller.cron, env.AFFILIATE_PIPELINE_CRON)) {
    await runAffiliatePipelineCron(env, controller);
    return;
  }

  await runPublishSchedulerCron(env, controller);
}

async function runPublishSchedulerCron(env: Env, controller: ScheduledController): Promise<void> {
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

async function runAffiliatePipelineCron(env: Env, controller: ScheduledController): Promise<void> {
  const { affiliatePipelineSchedulerService, logger } = createAppContext(env);
  const start = Date.now();

  logger.info('Affiliate pipeline cron trigger fired', {
    operation: 'affiliatePipeline.cron',
    status: 'triggered',
    cron: controller.cron,
    configuredCron: env.AFFILIATE_PIPELINE_CRON ?? DEFAULT_AFFILIATE_PIPELINE_CRON,
  });

  const outcome = await affiliatePipelineSchedulerService.runScheduled(new Date());

  logger.info('Affiliate pipeline cron trigger handled', {
    operation: 'affiliatePipeline.cron',
    status: outcome.action,
    reason: outcome.reason,
    duration: Date.now() - start,
    created: outcome.result?.created,
    skipped: outcome.result?.skipped,
    failed: outcome.result?.failed,
    error: outcome.error,
  });
}
