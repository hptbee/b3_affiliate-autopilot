export const DEFAULT_AFFILIATE_PIPELINE_CRON = '0 2 * * *';
export const DEFAULT_AFFILIATE_PIPELINE_INTERVAL_HOURS = 24;
export const AFFILIATE_PIPELINE_JOB_NAME = 'affiliate-content-pipeline';
export const AFFILIATE_PIPELINE_LEASE_MS = 30 * 60 * 1000;

export type PipelineJobStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface PipelineJobState {
  jobName: string;
  status: PipelineJobStatus;
  ownerId: string | null;
  startedAt: Date | null;
  leaseExpiresAt: Date | null;
  lastCompletedAt: Date | null;
  lastResult: Record<string, unknown> | null;
  lastError: string | null;
  updatedAt: Date;
}

export interface PipelineLockRepository {
  getState(jobName: string): Promise<PipelineJobState | null>;
  tryAcquire(jobName: string, ownerId: string, now: Date, leaseMs: number): Promise<boolean>;
  complete(
    jobName: string,
    ownerId: string,
    now: Date,
    result: Record<string, unknown>,
  ): Promise<void>;
  fail(jobName: string, ownerId: string, now: Date, error: string): Promise<void>;
}
