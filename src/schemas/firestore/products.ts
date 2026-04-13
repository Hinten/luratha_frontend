import { z } from "zod";
import {
  colorHexSchema,
  moneySchema,
  nonEmptyStringSchema,
  skuSchema,
  timestampSchema,
} from "@/src/schemas/firestore/utils";

export const productVariantSchema = z.object({
  sku: skuSchema,
  size: nonEmptyStringSchema,
  colorName: nonEmptyStringSchema.optional(),
  colorHex: colorHexSchema.optional(),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  stock: z.number().int().min(0),
  photoIds: z.array(nonEmptyStringSchema).min(1),
  active: z.boolean().default(true),
});

export const productSchema = z
  .object({
    id: nonEmptyStringSchema,
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    categorySlug: nonEmptyStringSchema,
    subcategorySlug: nonEmptyStringSchema.optional(),
    tags: z.array(nonEmptyStringSchema).max(50).default([]),
    materialTags: z.array(nonEmptyStringSchema).max(20).default([]),
    seasonalTags: z.array(nonEmptyStringSchema).max(20).default([]),
    priceMin: moneySchema,
    priceMax: moneySchema,
    currency: z.literal("BRL"),
    ratingAverage: z.number().min(0).max(5).default(0),
    reviewCount: z.number().int().min(0).default(0),
    totalStock: z.number().int().min(0),
    status: z.enum(["draft", "active", "archived"]),
    photoIds: z.array(nonEmptyStringSchema).min(1),
    primaryPhotoId: nonEmptyStringSchema,
    variants: z.array(productVariantSchema).min(1),
    searchText: nonEmptyStringSchema,
    searchableTokens: z.array(nonEmptyStringSchema).max(200),
    searchEmbedding: z.array(z.number()).max(4096).optional(),
    publishedAt: timestampSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((product, ctx) => {
    if (product.priceMax < product.priceMin) {
      ctx.addIssue({
        code: "custom",
        path: ["priceMax"],
        message: "priceMax must be greater than or equal to priceMin",
      });
    }

    if (!product.photoIds.includes(product.primaryPhotoId)) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryPhotoId"],
        message: "primaryPhotoId must exist in photoIds",
      });
    }

    const variantSkus = new Set<string>();
    for (const variant of product.variants) {
      if (variant.compareAtPrice !== undefined && variant.compareAtPrice <= variant.price) {
        ctx.addIssue({
          code: "custom",
          path: ["variants"],
          message: "compareAtPrice must be greater than variant price when provided",
        });
      }

      if (variantSkus.has(variant.sku)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants"],
          message: "variant SKU must be unique inside the product",
        });
      }
      variantSkus.add(variant.sku);

      const unknownPhoto = variant.photoIds.find((photoId) => !product.photoIds.includes(photoId));
      if (unknownPhoto) {
        ctx.addIssue({
          code: "custom",
          path: ["variants"],
          message: "all variant photoIds must exist in product photoIds",
        });
      }
    }
  });

export type ProductVariant = z.infer<typeof productVariantSchema>;
export type Product = z.infer<typeof productSchema>;

export function validateProduct(input: unknown): Product {
  return productSchema.parse(input);
}
