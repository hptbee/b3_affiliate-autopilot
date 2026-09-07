# Domain model (conceptual)

Phase 1 persists Product and AffiliateOffer in D1. See [research/shopee-affiliate.md](./research/shopee-affiliate.md). Owner-scoped uniqueness is `(userId, provider, externalProductId)`. `description` and `originalPrice` are nullable because Shopee `productOfferV2` does not document them.

## Core chain

```text
Affiliate → Content → Media → Distribution → Analytics
```

## Product

A listing discovered or imported from an affiliate provider. Shopee is the first provider.

```text
Product
├── id
├── userId
├── provider              # e.g. shopee
├── externalProductId
├── title
├── description
├── price
├── originalPrice
├── rating
├── salesCount
├── images
├── productUrl            # canonical store URL — not the affiliate link
└── metadata
```

## AffiliateOffer

The monetization relationship for a product. Product URL ≠ affiliate URL.

```text
AffiliateOffer
├── id
├── userId
├── productId
├── provider
├── affiliateUrl          # tracking / commission link
├── trackingCode
├── commissionRate
├── createdAt
└── expiresAt
```

## Content

Platform-independent creative artifact. Do not put Facebook-, TikTok-, or Shopee-specific fields on this entity without a strong domain reason.

Conceptual copy:

```text
Content
├── hook
├── script
├── caption
├── CTA
├── hashtags
├── language
├── tone
└── status                # draft → approved → archived | cancelled
```

Current persistence still uses `title` / `body` / `contentType` / `status`. Phase 2 may persist structured copy. Until then, generated drafts pack hook into `title` and the remaining fields into `body`.

Publishing status does **not** live on Content.

## MediaAsset

Storage-backed creative files. R2 holds bytes; D1 holds metadata. Pipeline not implemented yet.

```text
MediaAsset
├── image
├── audio
├── video
├── thumbnail
└── rendered video
```

Existing `Media` persistence is the same concept (today primarily video metadata).

## Distribution

Publishing destinations, via `SocialPublisher`:

```text
Distribution
├── Facebook       ← first target
├── TikTok         ← PENDING / FUTURE
├── Instagram      ← future
└── YouTube        ← future
```

`ScheduledPost` is a distribution job against a `SocialAccount` on one of these channels.

## Analytics (Phase 6)

Conceptual metrics only. No implementation in Phase 0.

```text
Views → Clicks → CTR → Conversions → Commission → Revenue
```
