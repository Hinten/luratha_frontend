---
name: luratha-ecommerce-schema
description: Activate when asked to implement or review e-commerce schema.org for Google Shopping (Product merchant listing, product snippet, product variants, loyalty program, return policy, shipping policy) and Merchant Center data alignment.
compatibility: Next.js 16+ App Router, JSON-LD, schema.org Product/Offer/ProductGroup/MerchantReturnPolicy/ShippingService/MemberProgram, Google Search + Merchant Center.
---

# Luratha E-commerce Schema Specialist

## Scope

Use this skill for schema-specific e-commerce work:
- Merchant listing (`Product` + `Offer`) for purchasable PDPs
- Product snippet (`Product` + `Review`/`AggregateRating`) for editorial/aggregator pages
- Product variants (`ProductGroup` + `hasVariant` / `isVariantOf`)
- Loyalty program (`MemberProgram`) at organization level
- Return policy (`MerchantReturnPolicy`) at organization or offer level
- Shipping policy (`ShippingService` at org level, `OfferShippingDetails` at offer level)

For broad metadata/robots/sitemap/llms.txt tasks, complement with `luratha-seo`.

---

## Canonical decision tree

1. **User can buy on this page?**
   - Yes: use **merchant listing** markup (`Product` with `Offer`).
   - No: use **product snippet** markup.
2. **Has color/size/material variants?**
   - Yes: use `ProductGroup` + variant modeling.
3. **Policy is store-wide?**
   - Yes: nest in `Organization` (`hasMerchantReturnPolicy`, `hasShippingService`, `hasMemberProgram`).
   - No: use offer-level policy subset in `Offer`.

---

## Google policy guardrails (must pass)

- Markup must reflect visible page content.
- Use a **detail page** (not list/category page) for product rich results.
- No misleading/spammy markup.
- Keep price/availability synchronized with rendered page and feeds.
- Prefer server-rendered JSON-LD in HTML inicial; JS-injected markup is allowed but can reduce Shopping crawl quality for fast-changing fields.

---

## Merchant listing baseline (PDP purchasable)

### Required minimum
- `Product.name`
- `Product.image` (crawlable/indexable)
- `Product.offers` (`Offer`, not `AggregateOffer` for merchant listing)
- `Offer.price` (or `priceSpecification.price`)
- `Offer.priceCurrency` (ISO 4217)

### Strongly recommended
- `Offer.availability`
- `Product.brand`
- `Product.description`
- `Product.sku` and/or `gtin*`/`mpn`
- `Product.aggregateRating` (only when real ratings exist)

### Price patterns
- **Active price**: plain `price` or `UnitPriceSpecification`.
- **Strikethrough**: `priceSpecification.priceType = https://schema.org/StrikethroughPrice`.
- **Member price**: `priceSpecification.validForMemberTier` (don’t combine with `priceType` in the same spec).

---

## Product variants baseline

Use `ProductGroup` when variants exist (size/color/material/pattern/etc).

### Required
- Unique variant identity (`sku` or `gtin`)
- Group identity (`productGroupID` or `inProductGroupWithID`)
- Product-level required fields still apply to each variant/product context

### Recommended
- `ProductGroup.variesBy` with full schema URLs (for example `https://schema.org/size`, `https://schema.org/color`)
- `hasVariant` (nested) or `isVariantOf` (separate entities)
- Distinct URLs that preselect each variant

For single-page variant selectors, keep a canonical group URL without preselection.

---

## Organization-level commerce policies

### Return policy (`MerchantReturnPolicy`)
Use `Organization.hasMerchantReturnPolicy`.

Required:
- Option A: `applicableCountry` + `returnPolicyCategory` (+ `merchantReturnDays` when finite window)
- Option B: `merchantReturnLink`

Recommended:
- `returnMethod`, `returnFees`, `returnShippingFeesAmount` (when applicable), `itemCondition`, `refundType`

### Shipping policy (`ShippingService`)
Use `Organization.hasShippingService`.

Required:
- `shippingConditions` (one or many rules by destination/order value/weight etc.)

Recommended:
- `name`, `description`, `fulfillmentType`, `handlingTime`, `validForMemberTier`

### Loyalty program (`MemberProgram`)
Use `Organization.hasMemberProgram`.

Required:
- `MemberProgram.name`
- `MemberProgram.description`
- `MemberProgram.hasTiers`
- `MemberProgramTier.name`
- `MemberProgramTier.hasTierBenefit`

Recommended:
- `MemberProgram.url`
- `MemberProgramTier.membershipPointsEarned`
- `MemberProgramTier.hasTierRequirement`

---

## Merchant Center feed alignment (critical)

Keep parity between page schema and feed attributes:
- `id` ↔ stable SKU/internal product id
- `title` ↔ `Product.name`
- `description` ↔ `Product.description`
- `link` ↔ canonical PDP URL
- `image_link` ↔ primary product image URL
- variant attrs (`item_group_id`, `color`, `size`) ↔ `ProductGroup` modeling

When feed and schema diverge, Google can reduce eligibility or disapprove listings.

---

## Implementation pattern for Next.js

- Prefer Server Components for JSON-LD.
- Reuse `src/components/JsonLd.tsx`.
- Keep schema close to route/page data source.
- Use one cohesive block per entity set (for example `[ProductGroup, OfferShippingDetails, MerchantReturnPolicy]`).

---

## Validation workflow (mandatory)

1. Rich Results Test: https://search.google.com/test/rich-results
2. URL Inspection in Search Console
3. Monitor reports:
   - Merchant listings report
   - Product snippets report
4. Re-submit sitemap after major schema rollout

---

## Definition of done

- [ ] Correct schema type selected for page intent
- [ ] Required properties present
- [ ] Recommended properties added where data exists
- [ ] Variant modeling complete (when applicable)
- [ ] Store-wide loyalty/return/shipping modeled in `Organization` (or justified offer-level override)
- [ ] Merchant Center feed fields aligned with schema/page content
- [ ] Rich Results Test has no critical errors
