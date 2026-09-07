# Shopee Affiliate adapter

Vietnam GraphQL Open API adapter. See [docs/research/shopee-affiliate.md](../../../docs/research/shopee-affiliate.md).

```text
POST https://open-api.affiliate.shopee.vn/graphql
Authorization: SHA256 Credential={AppId}, Timestamp={unix}, Signature={sha256}
```

Implemented:

- `productOfferV2` → `DiscoveredProduct`
- `generateShortLink` → affiliate URL (`productUrl` stays separate)

Not implemented: conversion reports, seller Open Platform, live calls from unit tests.

Credentials: Worker secrets `SHOPEE_AFFILIATE_APP_ID` and `SHOPEE_AFFILIATE_SECRET`. Without them the adapter throws `unavailable` rather than inventing catalog data.
