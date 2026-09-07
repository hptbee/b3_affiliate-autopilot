import {
  DEFAULT_AFFILIATE_PIPELINE_CRON,
  DEFAULT_POST_ANALYTICS_CRON,
  isAffiliatePipelineCron,
  isPostAnalyticsCron,
} from '@social-autopilot/core';
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

  if (isPostAnalyticsCron(controller.cron, env.POST_ANALYTICS_CRON)) {
    await runPostAnalyticsCron(env, controller);
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

async function runPostAnalyticsCron(env: Env, controller: ScheduledController): Promise<void> {
  const { postAnalyticsRefreshSchedulerService, logger } = createAppContext(env);
  const start = Date.now();

  logger.info('Post analytics cron trigger fired', {
    operation: 'postAnalytics.cron',
    status: 'triggered',
    cron: controller.cron,
    configuredCron: env.POST_ANALYTICS_CRON ?? DEFAULT_POST_ANALYTICS_CRON,
  });

  const outcome = await postAnalyticsRefreshSchedulerService.runScheduled(new Date());

  logger.info('Post analytics cron trigger handled', {
    operation: 'postAnalytics.cron',
    status: outcome.action,
    reason: outcome.reason,
    duration: Date.now() - start,
    backfilled: outcome.result?.backfilled,
    refreshed: outcome.result?.refreshed,
    failed: outcome.result?.failed,
    skipped: outcome.result?.skipped,
    error: outcome.error,
  });
}
