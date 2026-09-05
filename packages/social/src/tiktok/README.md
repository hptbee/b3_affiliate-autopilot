# TikTok publisher (Phase 1 — not implemented)

MVP target modules (do not add real OAuth or TikTok HTTP here yet):

```text
packages/social/src/tiktok/
  TikTokClient.ts
  TikTokOAuth.ts
  TikTokPublisher.ts
  TikTokErrors.ts
```

Until Phase 1C, `MockTikTokPublisher` is the only publisher. It must never be mistaken for a production TikTok client.

Video files are uploaded to R2; this package only receives metadata + a Worker-resolved access token at publish time.
