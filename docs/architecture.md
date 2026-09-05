# Architecture

See the main [README](../README.md) for the full architecture diagram and setup guide.

## Layering

```
Route (Hono) → Validation (Zod) → Application Service → Repository → D1
```

Business logic lives in `packages/core`. Cloudflare-specific adapters live in `packages/database` and worker entrypoints.

## Workers

| Worker | Trigger | Responsibility |
|--------|---------|----------------|
| `apps/api` | HTTP | REST API, queue producer |
| `workers/scheduler` | Cron (every 5 min) | Find due posts, enqueue |
| `workers/publisher` | Queue consumer | Idempotent publish |
| `workers/workflow` | Workflow | Long-running pipelines (stub) |

## Idempotency

Publishing uses optimistic locking via D1:

1. Load `ScheduledPost` by ID from queue message
2. Skip if already `published`
3. `UPDATE ... SET status = 'publishing' WHERE status IN ('scheduled', 'failed')`
4. If 0 rows updated, another worker owns the job
5. Publish via `SocialPublisher`
6. Store `externalPostId`, mark `published`

## Token Storage

OAuth tokens are stored as opaque references (`accessTokenRef`, `refreshTokenRef`), not raw values. This allows migration to Cloudflare Secrets Store or a dedicated vault later.
