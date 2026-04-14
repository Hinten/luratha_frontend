import { z } from "zod";
import {
  colorHexSchema,
  moneySchema,
  nonEmptyStringSchema,
  skuSchema,
  timestampSchema,
} from "@/src/schemas/firestore/utils";

const productSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const productIdentifierSchema = z
  .object({
    type: z.enum(["sku", "gtin", "mpn_brand"]),
    value: nonEmptyStringSchema,
    brandName: nonEmptyStringSchema.optional(),
  })
  .superRefine((identifier, ctx) => {
    if (identifier.type === "mpn_brand" && !identifier.brandName) {
      ctx.addIssue({
        code: "custom",
        path: ["brandName"],
        message: "brandName is required when identifier type is mpn_brand",
      });
    }
  });

export function slugifyProductPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildProductSlug(name: string, sku: string): string {
  const normalizedName = slugifyProductPart(name);
  const normalizedSku = slugifyProductPart(sku);

  const fallbackName = normalizedName || "produto";
  const fallbackSku = normalizedSku || "sku";
  return `${fallbackName}-${fallbackSku}`;
}

export const productVariantSchema = z.object({
  sku: skuSchema,
  size: nonEmptyStringSchema,
  colorName: nonEmptyStringSchema.optional(),
  colorHex: colorHexSchema.optional(),
  attributes: z.record(nonEmptyStringSchema).default({}),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  stock: z.number().int().min(0),
  photoIds: z.array(nonEmptyStringSchema).min(1),
  availability: z
    .enum(["InStock", "OutOfStock", "PreOrder", "BackOrder", "Discontinued"])
    .default("InStock"),
  itemCondition: z.enum(["NewCondition", "UsedCondition", "RefurbishedCondition"]).default("NewCondition"),
  gtin: z
    .string()
    .trim()
    .regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/)
    .optional(),
  mpn: nonEmptyStringSchema.optional(),
  active: z.boolean().default(true),
});

const productSchemaBase = z
  .object({
    id: nonEmptyStringSchema,
    slug: productSlugSchema.optional(),
    name: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    productType: z.enum(["simple", "variable"]).default("simple"),
    schemaIntent: z.enum(["merchant_listing", "product_snippet"]).default("merchant_listing"),
    isPurchasable: z.boolean().default(true),
    brandName: nonEmptyStringSchema.default("Luratha"),
    identifier: productIdentifierSchema,
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
    defaultVariantSku: skuSchema,
    variantAxes: z.array(nonEmptyStringSchema).max(3).default([]),
    variants: z.array(productVariantSchema).min(1),
    searchText: nonEmptyStringSchema,
    searchableTokens: z.array(nonEmptyStringSchema).max(200),
    vectorEmbedding: z.array(z.number().finite()).min(8).max(4096).optional(),
    searchEmbedding: z.array(z.number().finite()).min(8).max(4096).optional(),
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

    const defaultVariant = product.variants.find((variant) => variant.sku === product.defaultVariantSku);
    if (!defaultVariant) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultVariantSku"],
        message: "defaultVariantSku must reference an existing variant sku",
      });
    }

    if (product.productType === "simple" && product.variants.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "simple products must contain exactly one variant",
      });
    }

    if (product.productType === "variable" && product.variants.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "variable products must contain at least two variants",
      });
    }

    if (product.productType === "variable" && product.variantAxes.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["variantAxes"],
        message: "variable products must declare at least one variant axis",
      });
    }

    if (product.productType === "simple" && product.variantAxes.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["variantAxes"],
        message: "simple products cannot declare variant axes",
      });
    }

    if (product.schemaIntent === "merchant_listing" && !product.isPurchasable) {
      ctx.addIssue({
        code: "custom",
        path: ["isPurchasable"],
        message: "merchant_listing products must be purchasable",
      });
    }

    if (product.schemaIntent === "product_snippet" && product.isPurchasable) {
      ctx.addIssue({
        code: "custom",
        path: ["isPurchasable"],
        message: "product_snippet products must be marked as non-purchasable",
      });
    }

    if (!product.vectorEmbedding && !product.searchEmbedding) {
      ctx.addIssue({
        code: "custom",
        path: ["vectorEmbedding"],
        message: "vectorEmbedding is required for vector search indexing",
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

    const variantPrices = product.variants.map((variant) => variant.price);
    const minVariantPrice = Math.min(...variantPrices);
    const maxVariantPrice = Math.max(...variantPrices);

    if (product.priceMin !== minVariantPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["priceMin"],
        message: "priceMin must match the minimum variant price",
      });
    }

    if (product.priceMax !== maxVariantPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["priceMax"],
        message: "priceMax must match the maximum variant price",
      });
    }

    const stockFromVariants = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
    if (product.totalStock !== stockFromVariants) {
      ctx.addIssue({
        code: "custom",
        path: ["totalStock"],
        message: "totalStock must match the sum of variant stock",
      });
    }

    if (product.identifier.type === "sku" && product.identifier.value !== product.defaultVariantSku) {
      ctx.addIssue({
        code: "custom",
        path: ["identifier", "value"],
        message: "sku identifier must match defaultVariantSku",
      });
    }

    if (product.identifier.type === "gtin") {
      const hasMatchingGtin = product.variants.some((variant) => variant.gtin === product.identifier.value);
      if (!hasMatchingGtin) {
        ctx.addIssue({
          code: "custom",
          path: ["identifier", "value"],
          message: "gtin identifier must match at least one variant gtin",
        });
      }
    }

    const expectedSlug = buildProductSlug(product.name, product.defaultVariantSku);
    if (product.slug && product.slug !== expectedSlug) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "slug must match the generated value based on name and defaultVariantSku",
      });
    }
  });

export const productSchema = productSchemaBase.transform((product) => {
  const generatedSlug = buildProductSlug(product.name, product.defaultVariantSku);
  const vectorEmbedding = product.vectorEmbedding ?? product.searchEmbedding;

  return {
    ...product,
    slug: generatedSlug,
    vectorEmbedding,
  };
});

export type ProductVariant = z.infer<typeof productVariantSchema>;
export type Product = z.infer<typeof productSchema>;

export function validateProduct(input: unknown): Product {
  return productSchema.parse(input);
}
