# TikTok integration (Phase 1)

## OAuth scopes (Content Posting API)

Confirm against current TikTok docs before production:

- `user.info.basic`
- `video.upload`
- `video.publish`

## Modules

```text
packages/social/src/tiktok/
  TikTokOAuth.ts      OAuth start/callback/refresh
  TikTokClient.ts     init upload, upload bytes, publish status
  TikTokPublisher.ts  SocialPublisher implementation
  TikTokErrors.ts     failed / uncertain / dead mapping
```

When Worker secrets are missing, `MockTikTokPublisher` remains the default publisher.

## Token storage

```text
SocialAccount.accessTokenRef / refreshTokenRef
  → EncryptedD1TokenStore (TOKEN_WRAP_KEY)
  → token_blobs table
```

Tokens never leave the Worker. API responses omit refs.

## Video flow

```text
Browser upload → Worker → R2
D1 media row (contentId, key, mimeType, size)
Publish resolves video by scheduledPost.contentId
```
