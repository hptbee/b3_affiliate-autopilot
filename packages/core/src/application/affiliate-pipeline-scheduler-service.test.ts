import { describe, expect, it, vi } from 'vitest';
import {
  AffiliatePipelineSchedulerService,
  isAffiliatePipelineCron,
  parseAffiliatePipelineScheduleConfig,
} from './affiliate-pipeline-scheduler-service.js';
import type { AffiliateContentPipelineService } from './affiliate-content-pipeline-service.js';
import {
  AFFILIATE_PIPELINE_JOB_NAME,
  DEFAULT_AFFILIATE_PIPELINE_CRON,
  type PipelineJobState,
  type PipelineLockRepository,
} from '../types/pipeline-lock.js';
import { BOOTSTRAP_USER_ID } from '../types/user-context.js';
import { createLogger } from '../types/logger.js';

function createLockRepository(options?: {
  state?: PipelineJobState | null;
  acquire?: boolean;
}) {
  const complete = vi.fn(async () => {});
  const fail = vi.fn(async () => {});

  const repository: PipelineLockRepository = {
    async getState() {
      return options?.state ?? null;
    },
    async tryAcquire() {
      return options?.acquire ?? true;
    },
    complete,
    fail,
  };

  return { repository, complete, fail };
}

function createScheduler(options?: {
  enabled?: boolean;
  intervalHours?: number;
  state?: PipelineJobState | null;
  acquire?: boolean;
  pipelineResult?: { requested: number; created: number; skipped: number; failed: number };
  pipelineError?: Error;
}) {
  const run = vi.fn(async () => {
    if (options?.pipelineError) throw options.pipelineError;
    return (
      options?.pipelineResult ?? {
        requested: 5,
        created: 3,
        skipped: 1,
        failed: 1,
      }
    );
  });

  const pipelineService = { run } as unknown as AffiliateContentPipelineService;
  const { repository, complete, fail } = createLockRepository({
    state: options?.state,
    acquire: options?.acquire,
  });

  const service = new AffiliatePipelineSchedulerService(
    pipelineService,
    repository,
    createLogger('test'),
    {
      enabled: options?.enabled ?? true,
      intervalHours: options?.intervalHours ?? 24,
      leaseMs: 30 * 60 * 1000,
      pipeline: { limit: 5, generateMedia: true },
    },
  );

  return { service, run, complete, fail };
}

describe('AffiliatePipelineSchedulerService.runScheduled', () => {
  it('skips when disabled', async () => {
    const { service, run } = createScheduler({ enabled: false });
    const outcome = await service.runScheduled(new Date('2026-01-02T02:00:00Z'));

    expect(outcome).toEqual({ action: 'skipped', reason: 'disabled' });
    expect(run).not.toHaveBeenCalled();
  });

  it('skips when interval has not elapsed since last completion', async () => {
    const { service, run } = createScheduler({
      state: {
        jobName: AFFILIATE_PIPELINE_JOB_NAME,
        status: 'completed',
        ownerId: 'prev',
        startedAt: new Date('2026-01-01T02:00:00Z'),
        leaseExpiresAt: new Date('2026-01-01T02:30:00Z'),
        lastCompletedAt: new Date('2026-01-01T02:05:00Z'),
        lastResult: { created: 2 },
        lastError: null,
        updatedAt: new Date('2026-01-01T02:05:00Z'),
      },
    });

    const outcome = await service.runScheduled(new Date('2026-01-01T20:00:00Z'));
    expect(outcome).toEqual({ action: 'skipped', reason: 'not_due' });
    expect(run).not.toHaveBeenCalled();
  });

  it('runs when interval has elapsed since last completion', async () => {
    const { service, run } = createScheduler({
      state: {
        jobName: AFFILIATE_PIPELINE_JOB_NAME,
        status: 'completed',
        ownerId: 'prev',
        startedAt: new Date('2026-01-01T02:00:00Z'),
        leaseExpiresAt: new Date('2026-01-01T02:30:00Z'),
        lastCompletedAt: new Date('2026-01-01T02:05:00Z'),
        lastResult: { created: 2 },
        lastError: null,
        updatedAt: new Date('2026-01-01T02:05:00Z'),
      },
    });

    const outcome = await service.runScheduled(new Date('2026-01-02T03:00:00Z'));
    expect(outcome.action).toBe('ran');
    expect(run).toHaveBeenCalledWith({ userId: BOOTSTRAP_USER_ID }, { limit: 5, generateMedia: true });
  });

  it('skips when lock cannot be acquired', async () => {
    const { service, run } = createScheduler({ acquire: false });
    const outcome = await service.runScheduled(new Date('2026-01-02T02:00:00Z'));

    expect(outcome).toEqual({ action: 'skipped', reason: 'locked' });
    expect(run).not.toHaveBeenCalled();
  });

  it('runs pipeline and records completion on success', async () => {
    const now = new Date('2026-01-02T02:00:00Z');
    const { service, run, complete, fail } = createScheduler({
      pipelineResult: { requested: 5, created: 4, skipped: 1, failed: 0 },
    });

    const outcome = await service.runScheduled(now);
    expect(outcome.action).toBe('ran');
    expect(outcome.result).toEqual({ requested: 5, created: 4, skipped: 1, failed: 0 });
    expect(run).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledWith(
      AFFILIATE_PIPELINE_JOB_NAME,
      expect.any(String),
      now,
      { requested: 5, created: 4, skipped: 1, failed: 0 },
    );
    expect(fail).not.toHaveBeenCalled();
  });

  it('records failure when pipeline throws', async () => {
    const now = new Date('2026-01-02T02:00:00Z');
    const { service, complete, fail } = createScheduler({
      pipelineError: new Error('pipeline exploded'),
    });

    const outcome = await service.runScheduled(now);
    expect(outcome).toEqual({ action: 'failed', error: 'pipeline exploded' });
    expect(complete).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(
      AFFILIATE_PIPELINE_JOB_NAME,
      expect.any(String),
      now,
      'pipeline exploded',
    );
  });
});

describe('parseAffiliatePipelineScheduleConfig', () => {
  it('defaults to enabled daily schedule with limit 5', () => {
    const config = parseAffiliatePipelineScheduleConfig({});
    expect(config.enabled).toBe(true);
    expect(config.intervalHours).toBe(24);
    expect(config.pipeline.limit).toBe(5);
    expect(config.pipeline.generateMedia).toBe(true);
  });

  it('respects explicit env overrides', () => {
    const config = parseAffiliatePipelineScheduleConfig({
      AFFILIATE_PIPELINE_ENABLED: 'false',
      AFFILIATE_PIPELINE_INTERVAL_HOURS: '12',
      AFFILIATE_PIPELINE_LIMIT: '3',
      AFFILIATE_PIPELINE_KEYWORD: 'phone',
      AFFILIATE_PIPELINE_GENERATE_MEDIA: 'false',
      AFFILIATE_PIPELINE_TONE: 'casual',
      AFFILIATE_PIPELINE_LANGUAGE: 'vi',
    });

    expect(config.enabled).toBe(false);
    expect(config.intervalHours).toBe(12);
    expect(config.pipeline).toEqual({
      limit: 3,
      keyword: 'phone',
      duplicateWindowHours: undefined,
      generateMedia: false,
      tone: 'casual',
      language: 'vi',
    });
  });
});

describe('isAffiliatePipelineCron', () => {
  it('matches the default daily cron expression', () => {
    expect(isAffiliatePipelineCron(DEFAULT_AFFILIATE_PIPELINE_CRON)).toBe(true);
    expect(isAffiliatePipelineCron('*/5 * * * *')).toBe(false);
  });

  it('matches a configured cron expression', () => {
    expect(isAffiliatePipelineCron('0 3 * * *', '0 3 * * *')).toBe(true);
    expect(isAffiliatePipelineCron('0 2 * * *', '0 3 * * *')).toBe(false);
  });
});
