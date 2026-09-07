import type { Logger } from '../types/logger.js';
import {
  DEFAULT_POST_ANALYTICS_CRON,
  DEFAULT_POST_ANALYTICS_INTERVAL_HOURS,
  POST_ANALYTICS_JOB_NAME,
  POST_ANALYTICS_LEASE_MS,
} from '../types/post-analytics.js';
import type { PipelineLockRepository } from '../types/pipeline-lock.js';
import type { PostAnalyticsRefreshResult, PostAnalyticsService } from './post-analytics-service.js';

export type PostAnalyticsRefreshAction = 'ran' | 'skipped' | 'failed';

export type PostAnalyticsRefreshSkipReason = 'disabled' | 'not_due' | 'locked';

export interface PostAnalyticsRefreshScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  leaseMs: number;
  batchLimit: number;
}

export interface PostAnalyticsRefreshOutcome {
  action: PostAnalyticsRefreshAction;
  reason?: PostAnalyticsRefreshSkipReason;
  result?: PostAnalyticsRefreshResult;
  error?: string;
}

export class PostAnalyticsRefreshSchedulerService {
  constructor(
    private readonly analyticsService: PostAnalyticsService,
    private readonly lockRepository: PipelineLockRepository,
    private readonly logger: Logger,
    private readonly config: PostAnalyticsRefreshScheduleConfig,
  ) {}

  async runScheduled(now: Date): Promise<PostAnalyticsRefreshOutcome> {
    if (!this.config.enabled) {
      this.logger.info('Post analytics cron skipped because it is disabled', {
        operation: 'postAnalytics.cron',
        status: 'skipped',
        reason: 'disabled',
      });
      return { action: 'skipped', reason: 'disabled' };
    }

    const notDue = await this.isNotDueYet(now);
    if (notDue) {
      this.logger.info('Post analytics cron skipped because interval has not elapsed', {
        operation: 'postAnalytics.cron',
        status: 'skipped',
        reason: 'not_due',
        intervalHours: this.config.intervalHours,
      });
      return { action: 'skipped', reason: 'not_due' };
    }

    const ownerId = crypto.randomUUID();
    const acquired = await this.lockRepository.tryAcquire(
      POST_ANALYTICS_JOB_NAME,
      ownerId,
      now,
      this.config.leaseMs,
    );

    if (!acquired) {
      this.logger.info('Post analytics cron skipped because another run holds the lock', {
        operation: 'postAnalytics.cron',
        status: 'skipped',
        reason: 'locked',
      });
      return { action: 'skipped', reason: 'locked' };
    }

    const start = Date.now();
    this.logger.info('Post analytics cron started', {
      operation: 'postAnalytics.cron',
      status: 'started',
      ownerId,
      batchLimit: this.config.batchLimit,
    });

    try {
      const result = await this.analyticsService.refreshDuePublications(now, {
        staleAfterMs: this.config.intervalHours * 60 * 60 * 1000,
        limit: this.config.batchLimit,
      });

      await this.lockRepository.complete(POST_ANALYTICS_JOB_NAME, ownerId, now, { ...result });

      this.logger.info('Post analytics cron completed', {
        operation: 'postAnalytics.cron',
        status: 'completed',
        ownerId,
        duration: Date.now() - start,
        ...result,
      });

      return { action: 'ran', result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Post analytics cron failed';
      await this.lockRepository.fail(POST_ANALYTICS_JOB_NAME, ownerId, now, message);

      this.logger.error('Post analytics cron failed', {
        operation: 'postAnalytics.cron',
        status: 'failed',
        ownerId,
        duration: Date.now() - start,
        errorCode: 'POST_ANALYTICS_CRON_ERROR',
        error: message,
      });

      return { action: 'failed', error: message };
    }
  }

  private async isNotDueYet(now: Date): Promise<boolean> {
    const state = await this.lockRepository.getState(POST_ANALYTICS_JOB_NAME);
    if (!state?.lastCompletedAt) return false;

    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    return now.getTime() < state.lastCompletedAt.getTime() + intervalMs;
  }
}

export function parsePostAnalyticsScheduleConfig(env: {
  POST_ANALYTICS_ENABLED?: string;
  POST_ANALYTICS_INTERVAL_HOURS?: string;
  POST_ANALYTICS_BATCH_LIMIT?: string;
}): PostAnalyticsRefreshScheduleConfig {
  return {
    enabled: env.POST_ANALYTICS_ENABLED !== 'false',
    intervalHours: parsePositiveNumber(
      env.POST_ANALYTICS_INTERVAL_HOURS,
      DEFAULT_POST_ANALYTICS_INTERVAL_HOURS,
    ),
    leaseMs: POST_ANALYTICS_LEASE_MS,
    batchLimit: parsePositiveInt(env.POST_ANALYTICS_BATCH_LIMIT, 50),
  };
}

export function isPostAnalyticsCron(cronExpression: string, configuredCron?: string): boolean {
  const expected = configuredCron?.trim() || DEFAULT_POST_ANALYTICS_CRON;
  return cronExpression === expected;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
