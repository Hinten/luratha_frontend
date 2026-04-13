---
name: luratha-product-schema
description: Activate when the task is to model Product schema.org for Google Shopping and rich results, including merchant listing, product snippet, and product variants from Firebase product documents.
license: CC-BY-4.0
compatibility: Next.js 16+ App Router, TypeScript, JSON-LD, schema.org Product/Offer/ProductGroup, Google Search rich results + Merchant Center alignment.
metadata:
  protocol: agentskills.io
  focus: "SEO AEO GEO rich-results"
---

# Luratha Product Schema Specialist

## When to use

Use this skill for:
- `Product` + `Offer` (merchant listing on purchasable PDPs)
- `Product` snippet contexts (`Review` / `AggregateRating` when applicable)
- `ProductGroup` + variants (`hasVariant` / `isVariantOf`)
- Firebase product document → typed model → JSON-LD mapping

For organization-level loyalty/return/shipping policies, use `../luratha-ecommerce-schema/SKILL.md`.

---

## Agentskills.io protocol notes (applied)

- Skill is self-contained with valid frontmatter and `name` matching folder.
- Main instructions are concise; deeper references stay in `references/`.
- Workflow is step-based and designed for progressive disclosure.

If any field compatibility is uncertain, consult:
- `references/GOOGLE-PRODUCT-CHECKLIST.md`
- Official docs linked in that file.

---

## Mandatory workflow

1. Validate source payload from Firebase using Zod models below.
2. Decide schema mode:
   - Purchasable PDP: merchant listing (`Product` + `Offer`)
   - Non-purchasable editorial/aggregator: product snippet
3. Detect variants:
   - If size/color/material/pattern vary, model `ProductGroup`.
4. Build JSON-LD in Server Component (prefer pre-rendered HTML).
5. Validate in Rich Results Test and URL Inspection.

---

## Zod models (Firebase input)

```ts
import { z } from "zod";

export const firebaseVariantSchema = z.object({
  sku: z.string().min(1),
  slug: z.string().min(1),
  color: z.string().optional(),
  size: z.string().optional(),
  pattern: z.string().optional(),
  material: z.string().optional(),
  gtin14: z.string().optional(),
  image: z.string().url(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("BRL"),
  availability: z.enum(["InStock", "OutOfStock", "BackOrder"]).default("InStock"),
});

export const firebaseProductDocumentSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  brand: z.string().default("Luratha"),
  images: z.array(z.string().url()).min(1),
  sku: z.string().optional(),
  gtin14: z.string().optional(),
  mpn: z.string().optional(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("BRL"),
  availability: z.enum(["InStock", "OutOfStock", "BackOrder"]).default("InStock"),
  ratingValue: z.number().min(1).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  variants: z.array(firebaseVariantSchema).default([]),
});
```

---

## Mapping helpers (Firebase → JSON-LD)

```ts
type FirebaseProduct = z.infer<typeof firebaseProductDocumentSchema>;

const availabilityMap: Record<FirebaseProduct["availability"], string> = {
  InStock: "https://schema.org/InStock",
  OutOfStock: "https://schema.org/OutOfStock",
  BackOrder: "https://schema.org/BackOrder",
};

export function toMerchantListingProduct(product: FirebaseProduct, siteUrl: string) {
  const canonical = `${siteUrl}/produto/${product.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.sku,
    gtin14: product.gtin14,
    mpn: product.mpn,
    brand: { "@type": "Brand", name: product.brand },
    aggregateRating:
      product.ratingValue && product.reviewCount !== undefined
        ? {
            "@type": "AggregateRating",
            ratingValue: product.ratingValue,
            reviewCount: product.reviewCount,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      url: canonical,
      price: product.price,
      priceCurrency: product.currency,
      availability: availabilityMap[product.availability],
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
```

---

## Variants model (`ProductGroup`) example

```ts
export function toProductGroup(product: FirebaseProduct, siteUrl: string) {
  const variesBy = [
    product.variants.some((v) => v.size) ? "https://schema.org/size" : null,
    product.variants.some((v) => v.color) ? "https://schema.org/color" : null,
    product.variants.some((v) => v.material) ? "https://schema.org/material" : null,
    product.variants.some((v) => v.pattern) ? "https://schema.org/pattern" : null,
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: product.name,
    description: product.description,
    productGroupID: product.id,
    brand: { "@type": "Brand", name: product.brand },
    variesBy,
    hasVariant: product.variants.map((variant) => ({
      "@type": "Product",
      sku: variant.sku,
      gtin14: variant.gtin14,
      name: `${product.name}${variant.color ? ` - ${variant.color}` : ""}${variant.size ? ` - ${variant.size}` : ""}`,
      description: product.description,
      image: [variant.image],
      color: variant.color,
      size: variant.size,
      material: variant.material,
      pattern: variant.pattern,
      offers: {
        "@type": "Offer",
        url: `${siteUrl}/produto/${variant.slug}`,
        price: variant.price,
        priceCurrency: variant.currency,
        availability: availabilityMap[variant.availability],
      },
    })),
  };
}
```

---

## Next.js usage pattern

```tsx
import JsonLd from "@/src/components/JsonLd";

// inside page component:
const parsed = firebaseProductDocumentSchema.parse(productFromFirestore);
const jsonLd = parsed.variants.length
  ? toProductGroup(parsed, "https://www.luratha.com.br")
  : toMerchantListingProduct(parsed, "https://www.luratha.com.br");

return (
  <>
    <JsonLd data={jsonLd} />
    {/* page content */}
  </>
);
```

---

## Output checklist

- [ ] Product page is a detail page and purchasable when using merchant listing
- [ ] Required fields are present (`name`, `image`, `offers.price`, `offers.priceCurrency`)
- [ ] Variant entities have stable unique IDs (`sku`/`gtin`) and group ID
- [ ] JSON-LD matches visible content and canonical URL
- [ ] Firebase mapping validated by Zod before rendering
- [ ] Rich Results Test has no critical errors

For field-level edge cases, consult `references/GOOGLE-PRODUCT-CHECKLIST.md` and then the official Google docs linked there.
