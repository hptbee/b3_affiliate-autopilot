# Architecture

Affiliate-first Cloudflare Worker. See the [README](../README.md), [domain model](./domain.md), and [implementation plan](./IMPLEMENTATION-PLAN.md).

The product core is:

```text
Affiliate → Content → Media → Distribution → Analytics
```

Shopee is the first affiliate provider. Facebook is the first distribution target. TikTok is a **PENDING / FUTURE** distribution channel.

## Layering

```
Route (Hono) → Zod → UserContext → application command → repository → D1
```

Business logic lives in `packages/core`. Provider HTTP belongs in adapters:

- Affiliate HTTP (Shopee) — not implemented; Phase 1 after API verification
- Distribution HTTP (Facebook, later TikTok) — `packages/social` mocks only
- Media bytes belong in R2

## Worker runtime

One deployable (`apps/api`):

```ts
fetch()      // HTTP
scheduled()  // Cron due-post scan
queue()      // distribution publish consumer
```

Handlers: `apps/api/src/handlers/scheduled.ts`, `apps/api/src/handlers/queue.ts`.

## Target topology

```text
                    Dashboard
                        │
                        ▼
                Cloudflare Worker
                     Hono
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
       D1               R2               AI
        │               │                │
        ▼               ▼                ▼
    Products        Media Assets    Workers AI /
    Affiliate                         OpenAI
    Content
    Posts
        │
        ▼
      Queue
        │
   ┌────┴─────┐
   ▼          ▼
Facebook    TikTok
(first)     (FUTURE)
```

## Lifecycle

```text
Content:        draft → approved → archived | cancelled
ScheduledPost:  scheduled → publishing → published
                  publishing → failed | uncertain | dead
```

A published ScheduledPost must not set Content to `published`.

Content is platform-independent. Facebook/TikTok/Shopee-specific fields belong in adapters or join records, not on the core Content entity.

## Publishing reliability

1. Cron reclaims stale `publishing` (lease ~10 minutes, no `externalPostId`).
2. Claim with `queuedAt` before enqueue.
3. Queue payload is `{ scheduledPostId }` only.
4. If `externalPostId` exists, ack and skip.
5. CAS lock: `scheduled` | `failed` → `publishing` + `publishingStartedAt`.
6. Ambiguous provider timeout → `uncertain` (never auto-retry).

These rules are distribution-channel-agnostic. Adapters map provider errors onto `failed` / `uncertain` / `dead`.

## Tokens

```text
ScheduledPost → SocialAccount.accessTokenRef → TokenStore (Worker-only)
```

Browser and API JSON never receive access or refresh tokens. Encryption lands with the first live OAuth (Facebook, Phase 4).

## Media

D1: `assetId`, `r2Key` (`key`), `mimeType`, `size`, `duration`, `createdAt`.  
R2: object bytes (image, audio, video, thumbnail, rendered video). No binaries in D1.

The media / TTS / renderer pipeline is Phase 3. Do not implement it here.

## Affiliate vs distribution

Product URL and affiliate URL are different fields. Distribution adapters receive an already-resolved `AffiliateOffer.affiliateUrl`; they must not invent tracking links.

TikTok-specific HTTP, OAuth, and error mapping stay under `packages/social/src/tiktok/` as future work. Facebook-specific details stay under `packages/social/src/facebook/`.
