# Facebook / Meta Graph API — Post analytics research

**Date:** 2026-09-07  
**Purpose:** Decide what Phase 7 can implement against the **current** official Meta Graph API for published Page post metrics.

Primary sources (public, fetched 2026-09-07):

- [Post Insights reference (v26.0)](https://developers.facebook.com/docs/graph-api/reference/post/insights/)
- [Page Post Insights reference (v26.0)](https://developers.facebook.com/docs/graph-api/reference/page-post/insights/)
- [Get Page Insights guide](https://developers.facebook.com/docs/platforminsights/page/)

---

## 1. Executive summary

Phase 7 tracks published affiliate content performance on Facebook Pages using:

| Data source | Endpoint | Notes |
|-------------|----------|-------|
| Engagement counts | `GET /{post-id}?fields=reactions.summary(true),comments.limit(0).summary(true),shares` | Works when token has post read access |
| Insights metrics | `GET /{post-id}/insights?metric=...&period=lifetime` | Requires `read_insights` permission |

The adapter maps provider-specific responses into nullable provider-neutral metrics in `packages/core`.

---

## 2. Capability matrix

| Capability | Status | Evidence |
|------------|--------|----------|
| Read post reactions total | YES | Post object `reactions.summary(true)` |
| Read post comments total | YES | Post object `comments.limit(0).summary(true)` |
| Read post shares count | PARTIAL | `shares.count` available for some post types |
| Organic impressions | YES | Insights metric `post_impressions_organic` (lifetime) |
| Post clicks | YES | Insights metric `post_clicks` (lifetime) |
| Reach / unique impressions | DEPRECATED | `post_impressions_unique` deprecated above Graph API v25 |
| `read_insights` permission | REQUIRES APPROVAL | Empty dataset returned without permission |
| Insights for every Page token | NO | Some tokens/pages return partial or empty metrics |
| TikTok analytics | OUT OF SCOPE | Phase 7 |

---

## 3. Implementation notes

- Fetch engagement fields and insights separately; tolerate partial failures.
- Store nullable metrics when a source is unavailable.
- Persist raw provider payloads in `post_metric_snapshots.raw_metrics` for debugging.
- Refresh published posts on a schedule (`0 */6 * * *` UTC default).
- Backfill `post_publications` from published `scheduled_posts` rows that have `external_post_id`.

---

## 4. Metrics requested in Phase 7

Insights (lifetime):

- `post_impressions_organic`
- `post_clicks`
- `post_reactions_by_type_total`

Engagement object fields:

- `reactions.summary(true)`
- `comments.limit(0).summary(true)`
- `shares`

Mapped to provider-neutral fields:

- `impressions`, `reach`, `clicks`, `reactions`, `comments`, `shares`, `engagements`

`reach` remains `null` when Meta no longer returns a supported unique reach metric for the post/token.
