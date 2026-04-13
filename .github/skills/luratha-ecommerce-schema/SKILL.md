---
name: luratha-ecommerce-schema
description: Activate when asked to implement or review e-commerce schema.org for Google Shopping (Product merchant listing, product snippet, product variants, loyalty program, return policy, shipping policy) and Merchant Center data alignment.
compatibility: Next.js 16+ App Router, JSON-LD, schema.org Product/Offer/ProductGroup/MerchantReturnPolicy/ShippingService/MemberProgram, Google Search + Merchant Center.
---

# Luratha E-commerce Schema Specialist

## Scope

Use this skill for schema-specific e-commerce work:
- Loyalty program (`MemberProgram`) at organization level
- Return policy (`MerchantReturnPolicy`) at organization or offer level
- Shipping policy (`ShippingService` at org level, `OfferShippingDetails` at offer level)

For Product/ProductGroup implementation details, use `../luratha-product-schema/SKILL.md`.
For broad metadata/robots/sitemap/llms.txt tasks, complement with `luratha-seo`.

---

## Canonical decision tree

1. **Policy is store-wide?**
   - Yes: nest in `Organization` (`hasMerchantReturnPolicy`, `hasShippingService`, `hasMemberProgram`).
   - No: use offer-level policy subset in `Offer`.
2. **Product/ProductGroup fields needed?**
   - Yes: switch to `../luratha-product-schema/SKILL.md`.

---

## Google policy guardrails (must pass)

- Markup must reflect visible page content.
- Use a **detail page** (not list/category page) for product rich results.
- No misleading/spammy markup.
- Keep price/availability synchronized with rendered page and feeds.
- Prefer server-rendered JSON-LD in initial HTML; JS-injected markup is allowed but can reduce Shopping crawl quality for fast-changing fields.

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
- Use one cohesive block per entity set (e.g. `[ProductGroup, OfferShippingDetails, MerchantReturnPolicy]`).

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
- [ ] Required policy properties present
- [ ] Recommended policy properties added where data exists
- [ ] Store-wide loyalty/return/shipping modeled in `Organization` (or justified offer-level override)
- [ ] Merchant Center feed fields aligned with schema/page content
- [ ] Rich Results Test has no critical errors
