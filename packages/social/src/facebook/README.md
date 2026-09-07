# Facebook publisher

Facebook Page publishing via Meta Graph API **v26.0**.

- `FacebookClient.ts` → `client.ts` — Graph HTTP
- `FacebookPublisher.ts` → `publisher.ts` — `SocialPublisher` adapter
- `FacebookErrors.ts` → `errors.ts` — maps Graph errors to `SocialPublishError`
- OAuth (`FacebookOAuth.ts`) — deferred; connect uses manual Page access token

See `docs/research/facebook-graph-api.md` for verified capabilities and limitations.
