# Shopee Affiliate capability research (Vietnam)

**Date:** 2026-09-07  
**Market:** Vietnam (`shopee.vn` / `affiliate.shopee.vn`)  
**Purpose:** Decide what Phase 1 can implement without inventing API behavior.

Official Open API schema pages are **login-walled**. This document uses official program pages and terms first, then the in-dashboard Open API contract as reproduced by sources that cite `https://affiliate.shopee.vn/open_api/list`. Anything not confirmed on a public official page is marked **UNKNOWN** or **REQUIRES APPROVAL**.

---

## 1. Executive summary

Shopee Vietnam runs a live Affiliate Program at [affiliate.shopee.vn](https://affiliate.shopee.vn/). Affiliates can obtain product and shop affiliate links from the website/app without an API.

A **Shopee Affiliate Open API** exists as a regional **GraphQL** service. For Vietnam the documented endpoint is:

```text
POST https://open-api.affiliate.shopee.vn/graphql
```

Verified (or strongly evidenced) capabilities:

| Business need | What exists |
|---------------|-------------|
| Product discovery | GraphQL `productOfferV2` — search/filter affiliate **offers**, not a general Shopee catalog |
| Product identity | `itemId` (+ `shopId`) |
| Product URL vs affiliate URL | `productLink` ≠ `offerLink` |
| Affiliate link from a Shopee URL | GraphQL `generateShortLink` (`originUrl` + up to 5 `subIds`) |
| Commission on an offer | `commissionRate` / seller / Shopee rate fields on offer nodes |
| Auth | App ID + Secret, SHA256 request signature. **Not OAuth.** |
| Access | Requires an approved Shopee Affiliate account **and** Open API access (`10035` if missing) |

Not the same system:

- [Shopee Open Platform](https://open.shopee.com/) seller/partner REST APIs (shop OAuth, `v2.product.*`, AMS seller campaign APIs) are **seller-side**. They are not the affiliate publisher API.
- Exact numeric rate limits, live VN field names (`itemId` vs `productId`), and whether every store URL converts are **not publicly verified**.

Phase 1 therefore implements: **import an affiliate product offer → persist Product → persist AffiliateOffer**. Live GraphQL calls run only when Worker secrets are configured. Unit tests never call Shopee.

---

## 2. Capability matrix

Status values: `YES` | `NO` | `UNKNOWN` | `REQUIRES APPROVAL`

| Capability | Available | Evidence | Notes |
| ---------- | --------- | -------- | ----- |
| Vietnam affiliate program | YES | [affiliate.shopee.vn](https://affiliate.shopee.vn/) (live VN portal, region `vn`) | Registration + approval. Official blog: [shopee.vn/blog/cach-lam-affiliate-shopee](https://shopee.vn/blog/cach-lam-affiliate-shopee/) |
| Manual product link in dashboard/app | YES | [doitac.shopee.vn/cam-nang-affiliate](https://doitac.shopee.vn/cam-nang-affiliate/) | “Lấy link” from Hoa Hồng Sản Phẩm / in-app share |
| Open API portal (docs) | REQUIRES APPROVAL | [affiliate.shopee.vn/open_api/list](https://affiliate.shopee.vn/open_api/list) exists; SPA requires login | Public fetch returns the app shell only |
| Product discovery (API) | YES | GraphQL `productOfferV2`; VN endpoint used in official-doc reproductions ([bcat95/shopee-aff](https://github.com/bcat95/shopee-aff) citing open_api/list); same query family in public BR docs | Searches **offers**, not every Shopee SKU |
| Product detail (full catalog) | UNKNOWN | `productOfferV2(itemId:)` is documented as a filter; no public confirmation of a dedicated “get item description/all images” affiliate method | Offer node has name, image, price range, rating, sales — **no description field** in documented schema |
| Product ID | YES | `itemId` on `ProductOfferV2` | Some third-party pages also show `productId`; treat `itemId` as canonical until a live schema check |
| Product URL | YES | `productLink` | Canonical store URL. Not the tracking link |
| Product images | YES | `imageUrl` (typically **one** primary image) | Multi-image gallery: UNKNOWN |
| Price | YES | `priceMin` / `priceMax` (strings in v2 docs) | Single `price` appears in older/third-party tables; mapper accepts both |
| Original / list price | UNKNOWN | No `originalPrice` on documented offer node | `priceDiscountRate` exists; do not invent original price |
| Rating | YES | `ratingStar` | String in v2 docs |
| Sales count | YES | `sales` | Some pages say `soldCount`; mapper accepts both |
| Shop information | YES | `shopId`, `shopName`, `shopType` | Store in Product `metadata`, not as core Product fields |
| Category | YES | `productCatIds` / `productCatId` filter | Metadata only |
| Commission data (offer) | YES | `commissionRate`, `sellerCommissionRate`, `shopeeCommissionRate`, `commission` | Offer-level, not a guaranteed Product field |
| Affiliate link on offer | YES | `offerLink` | Already-tracked affiliate URL from offer list |
| Affiliate link from arbitrary URL | YES | `generateShortLink(originUrl, subIds)` | VN example uses `https://open-api.affiliate.shopee.vn/graphql`. Whether **every** URL converts: UNKNOWN until live call |
| Deeplink / short link | YES | `generateShortLink` returns `shortLink` (e.g. `shope.ee/...`) | Official SG help also documents `an_redir` wrapping for feed partners — different, non-GraphQL path |
| Tracking / sub ID | YES | Up to **5** `subIds` → `utm_content` | Also `affiliate_id` + `sub_id` on `an_redir` ([Shopee Help SG](https://help.shopee.sg/portal/10/article/171184)) |
| Campaign tracking | UNKNOWN | Conversion report has `campaignType` / `campaignPartnerName`; creating seller AMS campaigns is seller Open Platform | Publisher API does not create campaigns |
| Conversion reports | YES (deferred) | `conversionReport`, `validatedReport` | Phase 6, not Phase 1 |
| API authentication | YES | SHA256 `Authorization` header; App ID + Secret | Not OAuth. Error `10035` = no API access |
| Vietnam GraphQL host | YES | `open-api.affiliate.shopee.vn` used in VN-documented examples | Live auth still REQUIRES APPROVAL |
| Individual affiliates | REQUIRES APPROVAL | Program is for KOC/KOL/individuals after registration; Open API additionally needs access grant | Tax/payment profile required to get paid ([help.shopee.vn](https://help.shopee.vn/portal/10/article/180808)) |
| Partner / seller Open Platform | NO (wrong API) | [open.shopee.com](https://open.shopee.com/) | Seller shop APIs and AMS **seller** campaign APIs |
| Numeric rate limit | UNKNOWN | Error `10030` = rate limit exceeded | Public docs do not publish QPS/quota numbers |
| Pagination (offers) | YES | `page`, `limit`, `pageInfo.hasNextPage` | BR public docs: limit 1–500, default 10 |
| Pagination (reports) | YES | `scrollId`, 30s TTL, max 500 | Not used in Phase 1 |

---

## 3. Authentication

### Affiliate Open API (publisher)

Documented request:

```text
POST {region-host}/graphql
Content-Type: application/json
Authorization: SHA256 Credential={AppId}, Timestamp={unixSeconds}, Signature={hex}

Signature = SHA256(AppId + Timestamp + Payload + Secret)
```

- **Payload** must be the exact JSON body string that is sent.
- **Timestamp** is Unix **seconds**. Clock skew causes `10020` (invalid/expired signature).
- **No OAuth**, no access/refresh tokens in this flow.
- Credentials come from the Affiliate **Open API** page after Shopee grants access.

Worker secrets (never D1, logs, or API JSON):

```text
SHOPEE_AFFILIATE_APP_ID
SHOPEE_AFFILIATE_SECRET
SHOPEE_AFFILIATE_ENDPOINT   # optional; default https://open-api.affiliate.shopee.vn/graphql
```

### Seller Open Platform (do not use for Phase 1)

HMAC-SHA256 over path + `partner_id` + timestamp + shop `access_token`. OAuth shop authorization. Different product.

### Access grant

Error **10035**: *“You currently do not have access to the Shopee Affiliate Open API Platform. Please contact us to request access.”*  
Contact form cited by VN API reproductions: [Shopee Help webform](https://help.shopee.vn/portal/webform/c2d6ebc5a2d64dd1b26f8c871730cdbd).

Brazil’s public analog requires an affiliate account plus an email request for App ID/Secret (up to ~2 weeks). Vietnam’s public pages do not spell out the same form; treat issuance as **REQUIRES APPROVAL**.

---

## 4. API constraints

### Hosts (affiliate GraphQL)

| Region | Host (as documented by integrations) |
|--------|--------------------------------------|
| Vietnam | `https://open-api.affiliate.shopee.vn/graphql` |
| Malaysia | `https://open-api.affiliate.shopee.com.my/graphql` |
| Brazil | `https://open-api.affiliate.shopee.com.br/graphql` |

Phase 1 targets Vietnam only.

### Errors (GraphQL `extensions.code`)

| Code | Meaning |
|------|---------|
| 10000 | System error |
| 10010 | Parse / GraphQL syntax |
| 10020 | Invalid signature, timestamp, credential, disabled app |
| 10030 | Rate limit exceeded |
| 10031 | Access deny |
| 10032 | Invalid affiliate id |
| 10033 | Account frozen |
| 10034 | Affiliate id blacklisted |
| 10035 | No Open API access |
| 11000 | Business error |
| 11001 | Params error |
| 11002 | Bind account error |

Exact QPS/daily quota: **UNKNOWN** (only `10030`).

### Pagination

- Offers: `page` + `limit` + `hasNextPage`.
- Reports: `scrollId` valid ~30 seconds (not implemented in Phase 1).

### ProductOfferV2 fields used for mapping

Documented v2 node (VN reproductions of open_api/list):

`itemId`, `productName`, `productLink`, `offerLink`, `imageUrl`, `priceMin`, `priceMax`, `priceDiscountRate`, `sales`, `ratingStar`, `commissionRate`, `sellerCommissionRate`, `shopeeCommissionRate`, `commission`, `shopId`, `shopName`, `shopType`, `productCatIds`, `periodStartTime`, `periodEndTime`.

**Not documented:** product description, extra image list, guaranteed original price.

---

## 5. Policy constraints

Official terms: [Điều khoản và điều kiện hợp tác chương trình Affiliate (2023-08-18)](https://shopee.vn/affiliate/dieu-kien-hop-tac-chuong-trinh-tiep-thi-lien-ket-cua-shopee-viet-nam-update-18-08-2023/).

Relevant to this product:

- Commission is owed only for **successful transactions** that originated from an official **affiliate link** (`Đường Link Tiếp Thị Liên Kết`), not a raw product URL.
- Affiliates must not impersonate Shopee, steal others’ content, use clickbait, drop cookie spam, or place links on prohibited content.
- Sharing the same affiliate link with **no surrounding content** is restricted — later AI/Facebook phases must generate real content, not bare links.
- Shopee may demand removal of promotional materials; using Shopee creative assets may need consent (KOL terms).
- Do not scrape undocumented storefront APIs; use Open API + official links.
- Product images from `imageUrl` are for identifying the offer; **rights to remix into generated video** are not granted by the API docs — Phase 3 must re-check.

Facebook/Meta affiliate-link policy is a Phase 4 concern, not Shopee API.

---

## 6. Architecture impact

```text
packages/core     Product, AffiliateOffer, capability ports (no fetch)
packages/affiliate  Shopee GraphQL adapter + mapper + errors
packages/database   products / affiliate_offers
apps/api            import + read endpoints
```

- Core stays provider-independent. Shopee HTTP, signing, and GraphQL stay in the adapter.
- `productUrl` and `affiliateUrl` are never stored in the same column.
- Identity is `provider + externalProductId` (`shopee` + `itemId`), never the affiliate URL.
- Description / originalPrice stay nullable because Shopee may not send them.
- Missing Worker secrets → configuration error, not a fake catalog.
- Conversion reports, shop-offer browsing, and seller AMS are out of Phase 1.

---

## 7. Open questions (need a real affiliate App ID)

1. Does this VN account receive App ID/Secret automatically, or only after the 10035 contact flow?
2. Exact `productOfferV2` schema on the live VN playground (`itemId` vs `productId`, `sales` vs `soldCount`, price types).
3. Numeric rate limits and burst policy.
4. Does `generateShortLink` succeed for any `shopee.vn` URL, including short `s.shopee.vn` / `shope.ee` links?
5. Is `offerLink` from `productOfferV2` sufficient for commission, or must publishers always mint `generateShortLink`?
6. Image/video reuse rights for AI-generated creatives.
7. Whether `periodEndTime` is a hard expiry for the tracking link.

Until those are answered, the adapter maps **documented fields only**, treats extra keys as metadata, and does not call Shopee from unit tests.
