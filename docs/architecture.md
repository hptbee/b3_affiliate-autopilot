# Architecture

TikTok-first Cloudflare Worker. See the [README](../README.md) and [implementation plan](./IMPLEMENTATION-PLAN.md).

## Layering

```
Route (Hono) → Zod → UserContext → application command → repository → D1
```

Business logic lives in `packages/core`. TikTok HTTP belongs in `packages/social` (not implemented yet). Video bytes belong in R2.

## Worker runtime

One deployable (`apps/api`):

```ts
fetch()      // HTTP
scheduled()  // Cron due-post scan
queue()      // TikTok publish consumer
```

Handlers: `apps/api/src/handlers/scheduled.ts`, `apps/api/src/handlers/queue.ts`.

## Lifecycle

```text
Content:        draft → approved → archived | cancelled
ScheduledPost:  scheduled → publishing → published
                  publishing → failed | uncertain | dead
```

A published ScheduledPost must not set Content to `published`.

## Publishing reliability

1. Cron reclaims stale `publishing` (lease ~10 minutes, no `externalPostId`).
2. Claim with `queuedAt` before enqueue.
3. Queue payload is `{ scheduledPostId }` only.
4. If `externalPostId` exists, ack and skip.
5. CAS lock: `scheduled` | `failed` → `publishing` + `publishingStartedAt`.
6. Ambiguous TikTok timeout → `uncertain` (never auto-retry).

## Tokens

```text
ScheduledPost → SocialAccount.accessTokenRef → TokenStore (Worker-only)
```

Browser and API JSON never receive access or refresh tokens. Encryption lands in Phase 1A.

## Media

D1: `assetId`, `r2Key` (`key`), `mimeType`, `size`, `duration`, `createdAt`.  
R2: video object. No binaries in D1.
