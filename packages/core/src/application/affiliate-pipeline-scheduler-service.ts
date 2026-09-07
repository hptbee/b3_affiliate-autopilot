import type { PipelineRunResult } from './affiliate-content-pipeline-service.js';
import type { Logger } from '../types/logger.js';
import {
  AFFILIATE_PIPELINE_JOB_NAME,
  AFFILIATE_PIPELINE_LEASE_MS,
  DEFAULT_AFFILIATE_PIPELINE_CRON,
  DEFAULT_AFFILIATE_PIPELINE_INTERVAL_HOURS,
  type PipelineLockRepository,
} from '../types/pipeline-lock.js';
import { BOOTSTRAP_USER_ID } from '../types/user-context.js';
import type { AffiliateContentPipelineService, RunAffiliatePipelineInput } from './affiliate-content-pipeline-service.js';

export type AffiliatePipelineScheduleAction = 'ran' | 'skipped' | 'failed';

export type AffiliatePipelineSkipReason =
  | 'disabled'
  | 'not_due'
  | 'locked'
  | 'cron_mismatch';

export interface AffiliatePipelineScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  leaseMs: number;
  pipeline: RunAffiliatePipelineInput;
}

export interface AffiliatePipelineScheduleOutcome {
  action: AffiliatePipelineScheduleAction;
  reason?: AffiliatePipelineSkipReason;
  result?: PipelineRunResult;
  error?: string;
}

export class AffiliatePipelineSchedulerService {
  constructor(
    private readonly pipelineService: AffiliateContentPipelineService,
    private readonly lockRepository: PipelineLockRepository,
    private readonly logger: Logger,
    private readonly config: AffiliatePipelineScheduleConfig,
  ) {}

  async runScheduled(now: Date): Promise<AffiliatePipelineScheduleOutcome> {
    if (!this.config.enabled) {
      this.logger.info('Affiliate pipeline cron skipped because it is disabled', {
        operation: 'affiliatePipeline.cron',
        status: 'skipped',
        reason: 'disabled',
      });
      return { action: 'skipped', reason: 'disabled' };
    }

    const notDue = await this.isNotDueYet(now);
    if (notDue) {
      this.logger.info('Affiliate pipeline cron skipped because interval has not elapsed', {
        operation: 'affiliatePipeline.cron',
        status: 'skipped',
        reason: 'not_due',
        intervalHours: this.config.intervalHours,
      });
      return { action: 'skipped', reason: 'not_due' };
    }

    const ownerId = crypto.randomUUID();
    const acquired = await this.lockRepository.tryAcquire(
      AFFILIATE_PIPELINE_JOB_NAME,
      ownerId,
      now,
      this.config.leaseMs,
    );

    if (!acquired) {
      this.logger.info('Affiliate pipeline cron skipped because another run holds the lock', {
        operation: 'affiliatePipeline.cron',
        status: 'skipped',
        reason: 'locked',
      });
      return { action: 'skipped', reason: 'locked' };
    }

    const start = Date.now();
    this.logger.info('Affiliate pipeline cron started', {
      operation: 'affiliatePipeline.cron',
      status: 'started',
      ownerId,
      limit: this.config.pipeline.limit,
    });

    try {
      const result = await this.pipelineService.run(
        { userId: BOOTSTRAP_USER_ID },
        this.config.pipeline,
      );

      await this.lockRepository.complete(AFFILIATE_PIPELINE_JOB_NAME, ownerId, now, {
        requested: result.requested,
        created: result.created,
        skipped: result.skipped,
        failed: result.failed,
      });

      this.logger.info('Affiliate pipeline cron completed', {
        operation: 'affiliatePipeline.cron',
        status: 'completed',
        ownerId,
        duration: Date.now() - start,
        created: result.created,
        skipped: result.skipped,
        failed: result.failed,
      });

      return { action: 'ran', result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Affiliate pipeline cron failed';
      await this.lockRepository.fail(AFFILIATE_PIPELINE_JOB_NAME, ownerId, now, message);

      this.logger.error('Affiliate pipeline cron failed', {
        operation: 'affiliatePipeline.cron',
        status: 'failed',
        ownerId,
        duration: Date.now() - start,
        errorCode: 'AFFILIATE_PIPELINE_CRON_ERROR',
        error: message,
      });

      return { action: 'failed', error: message };
    }
  }

  private async isNotDueYet(now: Date): Promise<boolean> {
    const state = await this.lockRepository.getState(AFFILIATE_PIPELINE_JOB_NAME);
    if (!state?.lastCompletedAt) return false;

    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    return now.getTime() < state.lastCompletedAt.getTime() + intervalMs;
  }
}

export function parseAffiliatePipelineScheduleConfig(env: {
  AFFILIATE_PIPELINE_ENABLED?: string;
  AFFILIATE_PIPELINE_INTERVAL_HOURS?: string;
  AFFILIATE_PIPELINE_LIMIT?: string;
  AFFILIATE_PIPELINE_KEYWORD?: string;
  AFFILIATE_PIPELINE_DUPLICATE_WINDOW_HOURS?: string;
  AFFILIATE_PIPELINE_GENERATE_MEDIA?: string;
  AFFILIATE_PIPELINE_TONE?: string;
  AFFILIATE_PIPELINE_LANGUAGE?: string;
}): AffiliatePipelineScheduleConfig {
  return {
    enabled: env.AFFILIATE_PIPELINE_ENABLED !== 'false',
    intervalHours: parsePositiveNumber(
      env.AFFILIATE_PIPELINE_INTERVAL_HOURS,
      DEFAULT_AFFILIATE_PIPELINE_INTERVAL_HOURS,
    ),
    leaseMs: AFFILIATE_PIPELINE_LEASE_MS,
    pipeline: {
      limit: parsePositiveInt(env.AFFILIATE_PIPELINE_LIMIT, 5),
      keyword: env.AFFILIATE_PIPELINE_KEYWORD,
      duplicateWindowHours: env.AFFILIATE_PIPELINE_DUPLICATE_WINDOW_HOURS
        ? parsePositiveInt(env.AFFILIATE_PIPELINE_DUPLICATE_WINDOW_HOURS, 168)
        : undefined,
      generateMedia: env.AFFILIATE_PIPELINE_GENERATE_MEDIA !== 'false',
      tone: env.AFFILIATE_PIPELINE_TONE,
      language: env.AFFILIATE_PIPELINE_LANGUAGE,
    },
  };
}

export function isAffiliatePipelineCron(
  cronExpression: string,
  configuredCron?: string,
): boolean {
  const expected = configuredCron?.trim() || DEFAULT_AFFILIATE_PIPELINE_CRON;
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
