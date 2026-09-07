import { describe, expect, it, vi } from 'vitest';
import {
  isPostAnalyticsCron,
  parsePostAnalyticsScheduleConfig,
  PostAnalyticsRefreshSchedulerService,
} from './post-analytics-refresh-scheduler-service.js';
import type { PostAnalyticsService } from './post-analytics-service.js';
import { DEFAULT_POST_ANALYTICS_CRON, POST_ANALYTICS_JOB_NAME } from '../types/post-analytics.js';
import type { PipelineJobState, PipelineLockRepository } from '../types/pipeline-lock.js';
import { createLogger } from '../types/logger.js';

function createScheduler(options?: {
  enabled?: boolean;
  acquire?: boolean;
  state?: PipelineJobState | null;
  refreshError?: Error;
}) {
  const refreshDuePublications = vi.fn(async () => {
    if (options?.refreshError) throw options.refreshError;
    return { backfilled: 1, refreshed: 2, failed: 0, skipped: 0 };
  });

  const analyticsService = {
    refreshDuePublications,
  } as unknown as PostAnalyticsService;

  const complete = vi.fn(async () => {});
  const fail = vi.fn(async () => {});

  const lockRepository: PipelineLockRepository = {
    async getState() {
      return options?.state ?? null;
    },
    async tryAcquire() {
      return options?.acquire ?? true;
    },
    complete,
    fail,
  };

  const service = new PostAnalyticsRefreshSchedulerService(
    analyticsService,
    lockRepository,
    createLogger('test'),
    {
      enabled: options?.enabled ?? true,
      intervalHours: 6,
      leaseMs: 30 * 60 * 1000,
      batchLimit: 50,
    },
  );

  return { service, refreshDuePublications, complete, fail };
}

describe('PostAnalyticsRefreshSchedulerService', () => {
  it('skips when disabled', async () => {
    const { service, refreshDuePublications } = createScheduler({ enabled: false });
    const outcome = await service.runScheduled(new Date());
    expect(outcome).toEqual({ action: 'skipped', reason: 'disabled' });
    expect(refreshDuePublications).not.toHaveBeenCalled();
  });

  it('runs refresh and records completion', async () => {
    const now = new Date('2026-01-02T06:00:00Z');
    const { service, complete } = createScheduler();
    const outcome = await service.runScheduled(now);
    expect(outcome.action).toBe('ran');
    expect(outcome.result).toEqual({ backfilled: 1, refreshed: 2, failed: 0, skipped: 0 });
    expect(complete).toHaveBeenCalledWith(POST_ANALYTICS_JOB_NAME, expect.any(String), now, {
      backfilled: 1,
      refreshed: 2,
      failed: 0,
      skipped: 0,
    });
  });
});

describe('parsePostAnalyticsScheduleConfig', () => {
  it('defaults to enabled every 6 hours', () => {
    const config = parsePostAnalyticsScheduleConfig({});
    expect(config.enabled).toBe(true);
    expect(config.intervalHours).toBe(6);
    expect(config.batchLimit).toBe(50);
  });
});

describe('isPostAnalyticsCron', () => {
  it('matches the default cron expression', () => {
    expect(isPostAnalyticsCron(DEFAULT_POST_ANALYTICS_CRON)).toBe(true);
    expect(isPostAnalyticsCron('*/5 * * * *')).toBe(false);
  });
});
