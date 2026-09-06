# TikTok Autopilot

An AI-powered TikTok content automation platform built on Cloudflare.

**Status:** v0.1 foundation — TikTok-first domain, mock publisher, no live TikTok API yet.

## Product

```text
Topic / Idea
    ↓
AI Content Generation
    ↓
Draft
    ↓
Human Approval
    ↓
Schedule
    ↓
Cron
    ↓
Cloudflare Queue
    ↓
TikTok Publisher
    ↓
TikTok
    ↓
Published / Failed / Uncertain
```

TikTok is the only MVP destination. Other platforms may be added later; they are not in scope now.

## MVP

1. Create content
2. Generate TikTok content with AI
3. Human approval
4. Upload video (R2)
5. Connect TikTok account
6. Schedule TikTok post
7. Cron discovers due posts
8. Queue publishing job
9. Publisher publishes to TikTok
10. Persist publishing result
11. Handle failed / uncertain publishing without duplicate posts

This repo is **not** at MVP yet. Next implementation step is **Phase 1A: TikTok OAuth**.

## Cloudflare architecture

```text
React Dashboard
      ↓
Cloudflare Worker + Hono (`apps/api`: `fetch` + `scheduled` + `queue`)
      ↓
D1 ──────────────── R2
 │                   │
 │                   └── Video assets
 │
 └── Content / Posts / Accounts / encrypted token refs

Cron
  ↓
Queue
  ↓
Publisher
  ↓
TikTok API

AI
  ↓
Workers AI / OpenAI
```

| Service | Role |
|---------|------|
| Workers | HTTP API, Cron, and Queue consumer (`apps/api`) |
| D1 | Users, content, scheduled posts, account metadata, token *refs* |
| R2 | Video binaries (metadata stays in D1) |
| Queues | `{ scheduledPostId }` publish jobs |
| Cron | Find due posts, claim `queuedAt`, enqueue |
| Worker Secrets | `OPENAI_API_KEY`, later TikTok client secret + `TOKEN_WRAP_KEY` |
| Workers AI | Default generate in development |
| OpenAI | Optional structured-generation provider |

Do **not** introduce Redis, PostgreSQL, Temporal, SQS, Durable Objects, Kubernetes, or extra microservices.

`apps/api` is the only deployable Worker. Cron and Queue handlers live in `apps/api/src/handlers/`.

## Domain

**Content** (creative artifact): `draft → approved → archived | cancelled`  
Publishing status does **not** live here.

**ScheduledPost** (TikTok job): `scheduled → publishing → published`  
Failures: `publishing → failed` (retryable) or `uncertain` (do not retry) or `dead`.

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
| GET | `/api/social-accounts` | List TikTok accounts (no tokens) |

`userId` is never taken from the request body. `UserContext` is set in middleware (bootstrap user today).

## Commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm cf:dev
```

## Testing

Unit tests cover Content/ScheduledPost transitions, approval-before-schedule, owner scoping, publish idempotency, uncertain/dead outcomes, and mock TikTok publisher. No live TikTok or AI calls.

## Roadmap

See [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md).

- **Phase 0** — Architecture hardening (complete)
- **Phase 1** — TikTok MVP (OAuth, R2 video, publisher, schedule E2E)
- **Phase 2** — TikTok AI drafts
- **Phase 3** — AI video pipeline
- **Phase 4** — Research
- **Phase 5** — Autonomous agent
- **Phase 6** — MCP
- **Phase 7** — Analytics

## Out of MVP

LinkedIn, X, Meta, Instagram, IdP, teams, billing, autonomous publish, MCP, analytics, AI video generation, Redis, Postgres, Temporal, Durable Objects, extra services.

## License

MIT
