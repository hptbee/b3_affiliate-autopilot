# Facebook publisher (Phase 4 — not implemented)

Facebook is the **first** distribution target. Do not add real OAuth or Graph API HTTP here yet.

Before implementation: verify current Facebook/Meta API capabilities, permissions, publishing requirements, supported page/account types, and affiliate-link policies.

Planned modules:

```text
packages/social/src/facebook/
  FacebookClient.ts
  FacebookOAuth.ts
  FacebookPublisher.ts
  FacebookErrors.ts
```

Until Phase 4, `MockFacebookPublisher` is the only Facebook publisher. It must never be mistaken for a production Facebook client.

The adapter should receive approved Content + MediaAsset metadata + an already-resolved affiliate URL. It must not generate tracking links or put Facebook-specific fields on the core Content entity.
