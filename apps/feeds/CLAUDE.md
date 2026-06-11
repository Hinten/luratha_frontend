# @luratha/feeds — product catalog feeds

Standalone feed generator — its **own App Hosting backend** (`luratha-app-feeds`, dev port 3003).
No user-facing UI (only a noindex landing at `/`); serves the product catalog as XML/JSON so
external ad platforms can ingest it.
Kept isolated from `@luratha/store` on purpose: generating the whole-catalog feed is a heavy read
that must never compete with storefront traffic for CPU/memory.

Endpoints:
- `GET /api/feeds/products.xml` — Google Merchant Center feed (RSS 2.0 + `g:` namespace), which
  the Facebook/Meta Catalog also ingests. ISR-cached (`revalidate = 3600`) so Firestore is read at
  most ~once/hour regardless of bot traffic.
- `GET /api/feeds/quality.json` — internal feed-quality report (field fill-rate + items missing
  required Merchant fields). `noindex`. Used to catch catalog gaps before the platforms reject ads.

Data path (`src/lib/feed/`):
- `fetchFeedProducts.ts` — reads `status == active && isPurchasable == true` via the **Enterprise
  Pipeline API** (`searchDb` from `@luratha/firestore/firebaseSearchDb`), projecting only the
  feed-relevant fields (embeddings excluded to save bandwidth/memory). The project runs on
  Firestore Enterprise, so the pipeline is always available — **there is no Core-query fallback**.
  The filter is backed by the `(status, isPurchasable)` composite index declared in
  `firestore.indexes.json`; deploy it with `firebase deploy --only firestore:indexes` and the
  planner uses it automatically. (The SDK's `execute({ indexMode: "recommended" })` option is
  **rejected by this backend** — `INVALID_ARGUMENT: Unsupported option: index_mode` — so don't
  re-add it; it breaks the route's build-time prerender.)
- `googleMerchantFeed.ts` — pure XML builder over the `FeedProduct` shape (no Firebase imports →
  unit-testable). Expands one `<item>` per variant (and per size); each offer's `g:id` is a **SKU**
  (variant SKU, or the product SKU for simple products) and `g:item_group_id` = parent product id.
- `feedQuality.ts` — pure fill-rate assessor over the same `FeedProduct` shape.

Known limitation (v1): variants carry no per-variant `stock`/`price`; availability and price are
inherited from the parent product (`totalStock`, `price`). A sold-out size can still show
`in stock`. Tracked for a follow-up that adds per-variant stock.

`SITE_URL` (`src/lib/constants.ts`) is duplicated from the storefront's canonical domain because
apps can't import across workspaces — keep it in sync with `apps/store` if the domain changes.
