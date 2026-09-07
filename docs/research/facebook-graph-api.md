# Facebook / Meta Graph API — Page publishing research

**Date:** 2026-09-07  
**Purpose:** Decide what Phase 4 can implement against the **current** official Meta Graph API without inventing behavior.

Primary sources (public, fetched 2026-09-07):

- [Page Feed reference (v26.0)](https://developers.facebook.com/docs/graph-api/reference/page/feed/)
- [Page Photos reference (v26.0)](https://developers.facebook.com/docs/graph-api/reference/page/photos/)

---

## 1. Executive summary

Phase 4 publishes **approved affiliate content** to a **Facebook Page** (not personal profiles). The adapter uses Graph API **v26.0** (current docs default).

Verified flow for MVP:

| Content | Graph endpoint | Notes |
|---------|----------------|-------|
| Text / link post | `POST /{page-id}/feed` | Requires `message` or `link` |
| Single photo post | `POST /{page-id}/photos` | Multipart `source` upload or public `url` |
| SVG cover from Phase 3 | **Not supported** | Official photo specs: `.jpeg`, `.bmp`, `.png`, `.gif`, `.tiff` only — **no SVG** |

Token model for MVP: **Page access token** supplied at connect time, stored in Worker-only `TokenStore`. Full OAuth login flow is deferred; manual Page token connect is sufficient for development.

---

## 2. Capability matrix

| Capability | Status | Evidence |
|------------|--------|----------|
| Publish to Facebook Page | YES | Page Feed **Publishing** section — `POST /{page-id}/feed` |
| Page access token | YES | Photos + Feed docs require Page token from person with `CREATE_CONTENT` |
| Text post (`message`) | YES | Feed publishing parameters |
| Link post (`link`) | YES | Feed publishing parameters |
| Photo via multipart `source` | YES | Page Photos **Creating** — multipart/form-data |
| Photo via public `url` | YES | Page Photos **Creating** — requires internet-accessible URL |
| SVG images | NO | Photo specs list jpeg/bmp/png/gif/tiff only |
| Personal profile posts | NO | Docs are Page-specific |
| `pages_manage_posts` | YES | Required for publishing |
| `pages_show_list` | YES | Listed as dependency for page listing / connect |
| `pages_read_engagement` | YES | Required for Photos edge |
| App Review + Business Verification | REQUIRES APPROVAL | Standard Meta production gate — not blocking dev with test Page |
| Non-expiring Page token | YES (typical) | Page token from long-lived user token — standard Meta pattern |
| OAuth login UI | DEFERRED | Phase 4 uses manual Page token connect; OAuth module stubbed for later |
| Affiliate link policy | UNKNOWN | Meta may restrict certain link/affiliate patterns — monitor `error_subcode` in production |
| Video / Reels | OUT OF SCOPE | Phase 4 — text + single raster photo only |
| Multi-photo albums | OUT OF SCOPE | Two-step upload + `attached_media` — future |
| Scheduling via Graph API | OUT OF SCOPE | We schedule in-app; Graph `scheduled_publish_time` not used in Phase 4 |

---

## 3. Authentication & tokens

- **Token type:** Page access token (not User token for publish calls).
- **Storage:** `SocialAccount.accessTokenRef` → `TokenStore` (AES-GCM encrypted in D1, key from `TOKEN_WRAP_KEY` Worker secret).
- **Verification at connect:** `GET /v26.0/{page-id}?fields=id,name` with the supplied token.
- **Invalid token errors:** Graph error code `190` → treat as `dead` (do not retry).
- **Permission errors:** Graph error code `10` → treat as `dead`.

OAuth (`FacebookOAuth.ts`) is **not implemented** in Phase 4. Connect endpoint accepts `pageId` + `pageAccessToken` for development and test Pages.

---

## 4. Publishing behavior (implemented)

### Message composition

Adapter builds post text from generic `Content`:

```text
{title}

{body}
```

Affiliate URLs are expected to already appear in `body` from Phase 2 AI generation. The adapter does **not** generate tracking links.

### Media handling

1. `PublishingService` loads `MediaAsset` rows for the content and fetches bytes from R2.
2. `FacebookPublisher` selects the first **publishable** image attachment:
   - `mediaType === 'image'`
   - `mimeType` is **not** `image/svg+xml`
   - MIME is one of `image/jpeg`, `image/png`, `image/gif`, `image/bmp`, `image/tiff`
3. If publishable image exists → `POST /{page-id}/photos` with multipart `source` + `message` (caption).
4. Otherwise → `POST /{page-id}/feed` with `message` only (covers SVG-only content).

### External post ID

Photos API returns `{ id, post_id? }`. Prefer `post_id` when present; otherwise use `id`.

### Error → retry mapping

| Condition | Outcome |
|-----------|---------|
| HTTP 429 | `failed` (retry) |
| HTTP 5xx / network timeout after send | `uncertain` |
| HTTP 4xx codes 190, 10, 200 (permission) | `dead` |
| Other 4xx | `failed` or `dead` based on subcode |

---

## 5. Phase 4 limitations

- No Facebook Login / OAuth redirect flow.
- No public media URL endpoint — photos uploaded via multipart from R2 bytes (not `url=` param).
- SVG covers are skipped; post is text-only.
- Single photo only (first eligible raster image).
- TikTok, Instagram, scheduling automation changes, analytics — not in Phase 4.
- Production requires Meta App Review for `pages_manage_posts` on non-admin test users.

---

## 6. Implementation references

```text
packages/social/src/facebook/
  client.ts          # Graph HTTP
  errors.ts          # Map Graph errors → SocialPublishError
  publisher.ts       # SocialPublisher adapter
  connect.ts         # Page verify + connect helper

packages/database/src/token/
  encrypted-token-store.ts

docs/research/facebook-graph-api.md  # this file
```
