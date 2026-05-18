import { z } from "zod";
import { nonEmptyStringSchema, skuSchema, timestampSchema } from "@/src/schemas/firestore/utils";

/**
 * Firestore collection: "stock"
 * Document ID: productId
 *
 * One document per product.
 * - Simple products  (hasVariants = false): quantity holds the total, variants = null.
 * - Variable products (hasVariants = true):  variants maps each variantId → quantity;
 *   quantity equals the sum of all variant quantities (denormalised for fast filtering).
 *
 * The variant map key is the variant's immutable `id` field (not the variant SKU).
 * This ensures stock records remain stable even when a variant's SKU is changed.
 */
export const stockSchema = z
  .object({
    productId: nonEmptyStringSchema.max(50),
    sku: skuSchema,
    quantity: z.number().int().min(0),
    hasVariants: z.boolean(),
    variants: z.record(z.string(), z.number().int().min(0)).nullable().default(null),
    updatedAt: timestampSchema,
  })
  .superRefine((stock, ctx) => {
    if (stock.hasVariants && stock.variants === null) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "variants must be provided when hasVariants is true",
      });
    }

    if (!stock.hasVariants && stock.variants !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "variants must be null when hasVariants is false",
      });
    }

    if (stock.hasVariants && stock.variants !== null) {
      const totalVariantQuantity = Object.values(stock.variants).reduce((a, b) => a + b, 0);
      if (totalVariantQuantity !== stock.quantity) {
        ctx.addIssue({
          code: "custom",
          path: ["quantity"],
          message: `quantity (${stock.quantity}) must equal the sum of all variant quantities (${totalVariantQuantity})`,
        });
      }
    }
  });

export type Stock = z.infer<typeof stockSchema>;

export function validateStock(input: unknown): Stock {
  return stockSchema.parse(input);
}
