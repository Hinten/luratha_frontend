/**
 * Builds a valid `Product` for the SEO suite's structured-data assertions.
 * Mirrors the canonical fixture used elsewhere in the unit tests; accepts
 * narrow overrides for the fields that drive the `Product` JSON-LD branches
 * (price/salePrice, stock → availability, rating → aggregateRating).
 */
import { buildProductSlug, validateProduct, type Product } from "@luratha/schemas";

export interface SeoProductOverrides {
  title?: string;
  sku?: string;
  price?: Partial<Product["price"]>;
  ratingAverage?: number | null;
  reviewCount?: number | null;
  totalStock?: number;
}

export function makeSeoProduct(overrides: SeoProductOverrides = {}): Product {
  const title = overrides.title ?? "Vestido Bordado Floral";
  const sku = overrides.sku ?? "LURATHA_001";

  const input = {
    id: "prod_seo_test",
    title,
    slug: buildProductSlug(title, sku),
    description:
      "Um vestido artesanal bordado à mão com motivos florais delicados, feito em linho leve para durar.",
    isPurchasable: true,
    brandName: "Luratha",
    sku,
    categoryId: "cat_vestidos",
    tags: ["vestido", "bordado"],
    materialTags: ["linho"],
    seasonalTags: ["verao"],
    price: {
      price: 389,
      salePrice: 289 as number | null,
      priceMin: 289,
      priceMax: 389,
      currency: "BRL",
      startDate: null,
      endDate: null,
      ...(overrides.price ?? {}),
    },
    ratingAverage: 4.8 as number | null,
    reviewCount: 24 as number | null,
    totalStock: 12,
    status: "active",
    photoAssets: [],
    lifeStylePhotos: [],
    variants: [
      {
        id: "var_001",
        sku: "LURATHA_001_P",
        gtin: null,
        mpn: null,
        item_group_id: "LURATHA_001",
        size: ["P"],
        color: ["Azul"],
        photoIds: [],
        active: true,
      },
    ],
    vectorEmbedding: [0.01, 0.22, 0.09, 0.41, 0.37, 0.12, 0.08, 0.74],
    searchEmbedding: [0.01, 0.22, 0.09, 0.41, 0.37, 0.12, 0.08, 0.74],
    createdAt: "2026-04-13T16:00:00.000Z",
    updatedAt: "2026-04-13T16:00:00.000Z",
  };

  if ("ratingAverage" in overrides) input.ratingAverage = overrides.ratingAverage ?? null;
  if ("reviewCount" in overrides) input.reviewCount = overrides.reviewCount ?? null;
  if (overrides.totalStock !== undefined) input.totalStock = overrides.totalStock;

  return validateProduct(input);
}
