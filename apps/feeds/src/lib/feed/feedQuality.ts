/**
 * Pure feed-quality assessor over the `FeedProduct` shape (no Firebase imports →
 * unit-testable). Computes, for each Merchant attribute we care about, how many
 * catalog items populate it (fill-rate), and lists items missing a *required*
 * attribute. This is the internal counterpart to the external Merchant Center /
 * Commerce Manager diagnostics — it catches catalog gaps before the platforms
 * reject the ads.
 */

import type { FeedProduct } from "./googleMerchantFeed";

type FieldPredicate = (product: FeedProduct) => boolean;

/**
 * Attributes Google Merchant treats as required for apparel. A feed item missing
 * any of these is rejected, so we surface the offending products explicitly.
 */
const REQUIRED_FIELDS: Record<string, FieldPredicate> = {
  id: (p) => p.id.trim().length > 0,
  title: (p) => p.title.trim().length > 0,
  description: (p) => p.description.trim().length > 0,
  link: (p) => p.slug.trim().length > 0,
  image_link: (p) => p.photos.length > 0,
  availability: () => true,
  price: (p) => p.price > 0,
  brand: (p) => p.brandName.trim().length > 0,
  condition: (p) => p.condition.trim().length > 0,
};

/**
 * Recommended attributes — not blocking, but they materially improve ad ranking
 * and eligibility (free listings, Performance Max). Low fill-rate here is a
 * catalog-enrichment signal, not an error.
 */
const RECOMMENDED_FIELDS: Record<string, FieldPredicate> = {
  gtin: (p) => Boolean(p.gtin) || Boolean(p.variants?.some((v) => v.gtin)),
  google_product_category: (p) => Boolean(p.googleProductCategoryId),
  color: (p) => p.colors.length > 0 || Boolean(p.variants?.some((v) => v.colors.length > 0)),
  size: (p) => p.sizes.length > 0 || Boolean(p.variants?.some((v) => v.sizes.length > 0)),
  age_group: (p) => Boolean(p.ageGroup),
  gender: (p) => Boolean(p.gender),
  material: (p) => p.material.length > 0,
  shipping_weight: (p) => p.weightKg !== null,
  product_highlight: (p) => p.productHighlights.length > 0,
};

export const REQUIRED_FIELD_NAMES = Object.keys(REQUIRED_FIELDS);

export interface FieldCoverage {
  present: number;
  missing: number;
  /** Fraction of items that populate the field, 0..1. */
  fillRate: number;
}

export interface FeedQualityReport {
  totalItems: number;
  required: Record<string, FieldCoverage>;
  recommended: Record<string, FieldCoverage>;
  /** Products missing at least one required attribute, with the offending field names. */
  missingRequired: { id: string; fields: string[] }[];
}

function coverage(
  products: FeedProduct[],
  predicates: Record<string, FieldPredicate>,
): Record<string, FieldCoverage> {
  const total = products.length;
  const result: Record<string, FieldCoverage> = {};
  for (const [field, predicate] of Object.entries(predicates)) {
    const present = products.reduce((count, product) => count + (predicate(product) ? 1 : 0), 0);
    result[field] = {
      present,
      missing: total - present,
      fillRate: total === 0 ? 0 : present / total,
    };
  }
  return result;
}

export function assessFeedQuality(products: FeedProduct[]): FeedQualityReport {
  const missingRequired: { id: string; fields: string[] }[] = [];
  for (const product of products) {
    const fields = Object.entries(REQUIRED_FIELDS)
      .filter(([, predicate]) => !predicate(product))
      .map(([field]) => field);
    if (fields.length > 0) {
      missingRequired.push({ id: product.id, fields });
    }
  }

  return {
    totalItems: products.length,
    required: coverage(products, REQUIRED_FIELDS),
    recommended: coverage(products, RECOMMENDED_FIELDS),
    missingRequired,
  };
}
