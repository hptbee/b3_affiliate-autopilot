import type {
  PipelineJobState,
  PipelineJobStatus,
  PipelineLockRepository,
} from '@social-autopilot/core';
import { pipelineJobLocks } from '../schema/index.js';
import type * as schema from '../schema/index.js';
import { and, eq, lte, or, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

function mapState(row: typeof pipelineJobLocks.$inferSelect): PipelineJobState {
  return {
    jobName: row.jobName,
    status: row.status as PipelineJobStatus,
    ownerId: row.ownerId,
    startedAt: row.startedAt,
    leaseExpiresAt: row.leaseExpiresAt,
    lastCompletedAt: row.lastCompletedAt,
    lastResult: row.lastResult ?? null,
    lastError: row.lastError,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePipelineLockRepository implements PipelineLockRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async getState(jobName: string): Promise<PipelineJobState | null> {
    const rows = await this.db
      .select()
      .from(pipelineJobLocks)
      .where(eq(pipelineJobLocks.jobName, jobName))
      .limit(1);
    return rows[0] ? mapState(rows[0]) : null;
  }

  async tryAcquire(
    jobName: string,
    ownerId: string,
    now: Date,
    leaseMs: number,
  ): Promise<boolean> {
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const existing = await this.getState(jobName);

    if (existing) {
      const result = await this.db
        .update(pipelineJobLocks)
        .set({
          status: 'running',
          ownerId,
          startedAt: now,
          leaseExpiresAt,
          lastError: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(pipelineJobLocks.jobName, jobName),
            or(
              sql`${pipelineJobLocks.status} != 'running'`,
              lte(pipelineJobLocks.leaseExpiresAt, now),
              sql`${pipelineJobLocks.leaseExpiresAt} IS NULL`,
            ),
          ),
        );
      return (result.meta?.changes ?? 0) > 0;
    }

    try {
      await this.db.insert(pipelineJobLocks).values({
        jobName,
        status: 'running',
        ownerId,
        startedAt: now,
        leaseExpiresAt,
        lastCompletedAt: null,
        lastResult: null,
        lastError: null,
        updatedAt: now,
      });
      return true;
    } catch {
      return false;
    }
  }

  async complete(
    jobName: string,
    ownerId: string,
    now: Date,
    result: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(pipelineJobLocks)
      .set({
        status: 'completed',
        ownerId,
        lastCompletedAt: now,
        lastResult: result,
        lastError: null,
        leaseExpiresAt: now,
        updatedAt: now,
      })
      .where(and(eq(pipelineJobLocks.jobName, jobName), eq(pipelineJobLocks.ownerId, ownerId)));
  }

  async fail(jobName: string, ownerId: string, now: Date, error: string): Promise<void> {
    await this.db
      .update(pipelineJobLocks)
      .set({
        status: 'failed',
        ownerId,
        lastError: error,
        leaseExpiresAt: now,
        updatedAt: now,
      })
      .where(and(eq(pipelineJobLocks.jobName, jobName), eq(pipelineJobLocks.ownerId, ownerId)));
  }
}
