# Luratha Product Schema Agent (Specialist)

Use this guide when acting as the specialist agent for Product schema implementation in Google Shopping / Merchant Center contexts.

## Scope

- Merchant listing (`Product` + `Offer`) for purchasable PDPs
- Product snippet (`Product` + `Review`/`AggregateRating`) when page is non-purchasable/editorial
- Product variants (`ProductGroup` + `hasVariant` / `isVariantOf`)
- Firebase product document → metadata + JSON-LD mapping for SEO/AEO/GEO/Rich Results

## Mandatory references (consult when needed)

- Merchant listing docs: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing?hl=pt-br
- Product variants docs: https://developers.google.com/search/docs/appearance/structured-data/product-variants?hl=pt-br
- Product overview: https://developers.google.com/search/docs/appearance/structured-data/product?hl=pt-br
- Structured data policies: https://developers.google.com/search/docs/appearance/structured-data/sd-policies?hl=pt-br

## Workflow

1. Validate Firebase payload with Zod.
2. Decide page intent (merchant listing vs snippet).
3. Detect and model variants with `ProductGroup` when applicable.
4. Generate JSON-LD in Server Component (`JsonLd`) and keep parity with visible content.
5. Validate with Rich Results Test + Search Console.

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
}).superRefine((data, ctx) => {
  if (!data.sku && !data.gtin14 && !data.mpn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["product_identifiers"],
      message: "Provide at least one product identifier: sku, gtin14, or mpn.",
    });
  }
});
```

> `currency` defaults to `BRL` by design for Luratha's catalog baseline. Override with source value whenever the Firebase document uses another ISO currency.

## Mapping helper example (Firebase → Product JSON-LD)

```ts
type FirebaseProduct = z.infer<typeof firebaseProductDocumentSchema>;

const availabilityMap: Record<FirebaseProduct["availability"], string> = {
  InStock: "https://schema.org/InStock",
  OutOfStock: "https://schema.org/OutOfStock",
  BackOrder: "https://schema.org/BackOrder",
};

export function toMerchantListingProduct(product: FirebaseProduct, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.gtin14 ? { gtin14: product.gtin14 } : {}),
    ...(product.mpn ? { mpn: product.mpn } : {}),
    brand: { "@type": "Brand", name: product.brand },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/produto/${product.slug}`,
      price: product.price,
      priceCurrency: product.currency,
      availability: availabilityMap[product.availability],
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
```

> For Merchant Center parity, keep at least one stable product identifier (`gtin*`, or `mpn` + `brand`, or internal `sku/id`) aligned between Firebase document, schema, and feed.

## Output checklist

- [ ] Product detail page intent validated
- [ ] Required Product/Offer fields present
- [ ] Variant modeling complete when applicable
- [ ] Schema matches visible page content and canonical URL
- [ ] Zod validation used before JSON-LD mapping
- [ ] Rich Results Test has no critical errors
