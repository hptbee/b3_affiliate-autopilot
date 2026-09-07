# TikTok-specific assumptions (Phase 0 review)

Inventory of TikTok-centered assumptions found in the repository after the affiliate-first rework. Categories:

- **KEEP** — still valid (TikTok remains a future channel, or the behavior is actually generic)
- **GENERALIZE** — TikTok wording or hard-coding moved to a channel-neutral core
- **MOVE BEHIND ADAPTER** — TikTok details belong in `packages/social/src/tiktok/`
- **DEFER** — real TikTok integration, later
- **REMOVE** — TikTok-as-center-of-domain wording that must not remain

No live TikTok, Facebook, or Shopee clients were added in this phase.

## KEEP

| Location | Assumption | Why |
|----------|------------|-----|
| `packages/social/src/tiktok/` | Future TikTok publisher module layout | TikTok is PENDING / FUTURE, not deleted |
| `SOCIAL_PLATFORMS` includes `'tiktok'` | TikTok remains a valid distribution channel | Product must not depend on TikTok, but the channel stays |
| `MockTikTokPublisher` | Dev/test stand-in | Must not be mistaken for a live client |
| Publishing lock, lease, `uncertain`, `dead`, retries | Originally documented as TikTok risks | They are generic at-least-once distribution rules |
| Content approval before schedule | Human gate | Unchanged for all channels |
| Queue payload `{ scheduledPostId }` | Job identity | Channel-agnostic |
| Historical git history / old migration filenames | `0001_tiktok_publishing.sql` | Leave applied SQL filename; comment clarified |

## GENERALIZE

| Location | Was | Now |
|----------|-----|-----|
| README, implementation plan, architecture | TikTok-first product | Affiliate-first; Facebook first distribution target |
| `packages/ai` draft schema / prompts | `tiktokContentDraftSchema`, TikTok voice | `affiliateContentDraftSchema`; TikTok names re-exported as aliases |
| `SocialPublisher.platform` | Effectively TikTok-only | `'facebook' \| 'tiktok'` |
| `ScheduledPostService` | Rejected non-TikTok accounts | Accepts known distribution platforms |
| `PublishingService` already-published result | Hard-coded `platform: 'tiktok'` | Uses the account's platform |
| `GET /api/social-accounts` | Filtered to TikTok | Returns all distribution accounts (no tokens) |
| Dashboard copy | "TikTok Autopilot" | "Affiliate Autopilot" |
| `Media` types | `'video'` only | MediaAsset kinds include image, audio, video, thumbnail |
| Seed data | TikTok mock account only | Facebook mock (first target) + TikTok mock (future) |
| Agent tool descriptions | "TikTok draft/post" | Channel-neutral / affiliate wording |

## MOVE BEHIND ADAPTER

| Location | Detail |
|----------|--------|
| `packages/social/src/tiktok/README.md` | Planned `TikTokClient`, `TikTokOAuth`, `TikTokPublisher`, `TikTokErrors` |
| `MockTikTokPublisher` | Stays in `packages/social`; live HTTP must not enter `packages/core` |
| Future TikTok caption/hashtag limits, video constraints | Adapter-owned, not Content fields |
| Future TikTok OAuth token refresh | TokenStore + TikTok adapter, Phase future |

## DEFER

| Item | Until |
|------|--------|
| TikTok OAuth / Content Posting API | After Facebook distribution is proven |
| TikTok live publisher replacing the mock | Future distribution phase |
| TikTok-specific analytics | Phase 6+ |
| TikTok as MVP destination | Never; Facebook is first |
| Shopee Affiliate HTTP/OAuth | Phase 1 after API verification |
| Facebook Graph API / OAuth | Phase 4 after Meta API verification |
| TTS, video renderer, analytics APIs | Phases 3 and 6 |
| Autonomous agents, MCP | Phases 7 and 8 |

## REMOVE

| Was | Action |
|-----|--------|
| "TikTok Autopilot" as product name | Replaced in README, dashboard, `index.html`, package description |
| "TikTok is the only MVP destination" | Removed |
| "Next step: Phase 1A TikTok OAuth" | Replaced with Shopee capability verification |
| "Out of MVP: Meta" | Meta/Facebook is now the first distribution target |
| Hard-coded "MVP only supports TikTok accounts" | Removed |

Do not blindly delete every "TikTok" string. Future-adapter docs, mock publisher tests, and this inventory keep the word on purpose.
