# AI Affiliate Content Autopilot

An affiliate-first content automation platform built on Cloudflare.

**Status:** v0.1 foundation — Phase 0 domain refactor. Shopee is the first affiliate provider. Facebook is the first distribution target. TikTok is a **PENDING / FUTURE** distribution channel. No live Shopee, Facebook, or TikTok APIs yet.

## Product

The core is **Affiliate → Content → Media → Distribution → Analytics**, not TikTok → Content.

```text
Affiliate Product
      ↓
Product Research / Selection
      ↓
Affiliate Link
      ↓
AI Content Generation
      ↓
Video / Media
      ↓
Human Approval
      ↓
Schedule
      ↓
Distribution
      ↓
Analytics / Conversion
```

Near-term path (current roadmap):

```text
Shopee
  ↓
Affiliate Product
  ↓
AI Content
  ↓
Media
  ↓
Approval
  ↓
Scheduling
  ↓
Distribution
  ↓
Facebook
```

TikTok remains an additional future distribution adapter on the same `SocialPublisher` port. It is not removed, and it is not the center of the domain.

## MVP

1. Product can be imported/discovered
2. Product can have an AffiliateOffer
3. AI can generate affiliate-oriented content
4. User can review/approve content
5. Media can eventually be attached
6. Content can be scheduled
7. Queue can process distribution jobs
8. Facebook is the first publishing target
9. Publishing is idempotent
10. Failed / uncertain publishing is handled safely

This repo is **not** at MVP yet. Next implementation step is **Phase 1: verify Shopee Affiliate/API capabilities**, then the Shopee provider abstraction. Do not implement live Shopee, Facebook, or TikTok integrations in this phase.

## Cloudflare architecture

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
        │               │          Workers AI /
        │               │             OpenAI
        │               │
        ▼               ▼
    Products        Media Assets
    Affiliate
    Content
    Campaigns
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

| Service | Role |
|---------|------|
| Workers | HTTP API, Cron, and Queue consumer (`apps/api`: `fetch` + `scheduled` + `queue`) |
| D1 | Users, products, affiliate offers, content, scheduled posts, account metadata, token *refs* |
| R2 | Media assets (images, audio, video, thumbnails). Metadata stays in D1 |
| Queues | `{ scheduledPostId }` distribution jobs |
| Cron | Find due posts, claim `queuedAt`, enqueue |
| Worker Secrets | `OPENAI_API_KEY`; later Shopee / Facebook secrets + `TOKEN_WRAP_KEY` |
| Workers AI | Default generate in development |
| OpenAI | Optional structured-generation provider |

Do **not** introduce Redis, PostgreSQL, Temporal, SQS, Durable Objects, Kubernetes, or extra microservices.

`apps/api` is the only deployable Worker. Cron and Queue handlers live in `apps/api/src/handlers/`.

## Domain

**Product** — an affiliate-provider listing (Shopee first). Product URL ≠ affiliate URL.

**AffiliateOffer** — the monetization link/tracking relationship for a product.

**Content** — platform-independent creative artifact: `draft → approved → archived | cancelled`. Publishing status does **not** live here. Facebook/TikTok/Shopee fields do not belong on the core Content entity.

**MediaAsset** — image / audio / video / thumbnail / rendered video. Binary in R2, metadata in D1. Pipeline not implemented yet.

**ScheduledPost** — a distribution job: `scheduled → publishing → published`. Failures: `publishing → failed` (retryable) or `uncertain` (do not retry) or `dead`.

**Distribution** — publishing destinations. Facebook is first. TikTok is PENDING / FUTURE. Instagram and YouTube are later.

Scheduling requires `Content.status === approved`.

## Local setup

Prerequisites: Node.js 20+, pnpm 9+.

```bash
pnpm install

pnpm db:migrate
pnpm --filter @social-autopilot/api exec wrangler d1 execute social-autopilot-db --local --file=../../scripts/seed.sql

pnpm cf:dev
pnpm --filter @social-autopilot/web dev
```

`pnpm db:migrate` applies SQL migrations to local D1 via Wrangler. Use `pnpm db:generate` after editing the Drizzle schema.

Optional `apps/api/.dev.vars`:

```
OPENAI_API_KEY=sk-your-key
AI_PROVIDER=openai
```

## Cloudflare setup

```bash
wrangler d1 create social-autopilot-db
wrangler r2 bucket create social-autopilot-media
wrangler queues create social-autopilot-publish
wrangler queues create social-autopilot-publish-dlq
cd apps/api
wrangler d1 migrations apply social-autopilot-db --remote
wrangler secret put OPENAI_API_KEY --env production
```

Fill real `database_id` values in `wrangler.jsonc`. Resources are not created automatically.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/content` | List current user's content |
| POST | `/api/content` | Create draft |
| GET | `/api/content/:id` | Get content (owner only) |
| PATCH | `/api/content/:id` | Update draft copy (no status) |
| POST | `/api/content/:id/approve` | Approve draft |
| POST | `/api/content/:id/cancel` | Cancel content |
| DELETE | `/api/content/:id` | Delete content |
| GET | `/api/scheduled-posts` | List current user's jobs |
| POST | `/api/scheduled-posts` | Schedule approved content |
| POST | `/api/scheduled-posts/:id/cancel` | Cancel job |
| GET | `/api/social-accounts` | List distribution accounts (no tokens) |

`userId` is never taken from the request body. `UserContext` is set in middleware (bootstrap user today).

Product, AffiliateOffer, and media-upload HTTP APIs are not in this phase.

## Commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm cf:dev
```

## Testing

Unit tests cover Content/ScheduledPost transitions, approval-before-schedule, owner scoping, publish idempotency, uncertain/dead outcomes, and mock distribution publishers. No live Shopee, Facebook, TikTok, or AI calls.

## Roadmap

See [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md).

- **Phase 0** — Architecture & domain refactor (this change)
- **Phase 1** — Shopee Affiliate foundation (verify API first)
- **Phase 2** — AI affiliate content
- **Phase 3** — Media / video pipeline
- **Phase 4** — Facebook distribution (verify Meta API first)
- **Phase 5** — Scheduling & automation (reuse existing Cron/Queue/lock design)
- **Phase 6** — Analytics / conversion
- **Phase 7** — Autonomous affiliate agent
- **Phase 8** — MCP / advanced automation

TikTok live integration is **PENDING / FUTURE**, after Facebook distribution.

## Out of MVP

TikTok live integration, Instagram, LinkedIn, X, YouTube, autonomous publishing, autonomous agents, MCP, advanced analytics, AI video generation, billing, teams, multi-tenant enterprise features, Redis, Postgres, Temporal, Durable Objects, extra services.

## License

MIT
