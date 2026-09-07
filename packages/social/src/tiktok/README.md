# TikTok publisher (PENDING / FUTURE — not implemented)

TikTok is **not** the product center. It is a future distribution adapter behind `SocialPublisher`.

Do not add real OAuth or TikTok HTTP here yet. Facebook is the first live distribution target (Phase 4).

Planned modules:

```text
packages/social/src/tiktok/
  TikTokClient.ts
  TikTokOAuth.ts
  TikTokPublisher.ts
  TikTokErrors.ts
```

Until that phase, `MockTikTokPublisher` is the only TikTok publisher. It must never be mistaken for a production TikTok client.

Video/media files are uploaded to R2; this package only receives metadata + a Worker-resolved access token at publish time. Affiliate URLs stay separate from media assets.
