import { z } from "zod";
import {
  moneySchema,
  nonEmptyStringSchema,
  nonNegativeMoneySchema,
  quantitySchema,
  skuSchema,
  timestampSchema,
  toCents,
  uidSchema,
} from "@luratha/schemas/utils";
import { dimensionsSchema } from "@luratha/schemas/products";

export const cartItemSchema = z.object({
  id: nonEmptyStringSchema,
  userId: uidSchema,
  productId: nonEmptyStringSchema,
  /** Id imutável da variação dentro do produto. Ausente quando o produto não tem variantes. */
  variantId: nonEmptyStringSchema.optional(),
  variantSku: skuSchema,
  productSlug: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  photoId: nonEmptyStringSchema,
  /**
   * URL completa da imagem (snapshot). Mantida no carrinho para evitar uma
   * resolução por produto na hora de renderizar; é apenas um cache visual e
   * o `photoId` é a referência canônica.
   */
  imageUrl: z.url(),
  /** Rótulo legível da variante (ex: "P", "Azul / M") — snapshot para a UI do carrinho. */
  variantLabel: nonEmptyStringSchema.optional(),
  unitPrice: moneySchema,
  quantity: quantitySchema,
  currency: z.literal("BRL"),
  /**
   * Snapshot de peso/dimensões do produto, copiado server-side no add-to-cart.
   * Usado pelo cálculo de frete real do carrinho/checkout. `null` quando o
   * produto não tem `dimensions` cadastrado — o cálculo cai no peso de fallback.
   */
  dimensions: dimensionsSchema.nullable().default(null),
  addedAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const cartSchema = z
  .object({
    id: uidSchema,
    userId: uidSchema,
    itemCount: z.number().int().min(0),
    subtotal: nonNegativeMoneySchema,
    couponCode: nonEmptyStringSchema.optional(),
    discountTotal: nonNegativeMoneySchema.default(0),
    shippingTotal: nonNegativeMoneySchema.default(0),
    grandTotal: nonNegativeMoneySchema,
    currency: z.literal("BRL"),
    updatedAt: timestampSchema,
  })
  .superRefine((cart, ctx) => {
    const computedGrandTotalCents =
      toCents(cart.subtotal) - toCents(cart.discountTotal) + toCents(cart.shippingTotal);
    if (toCents(cart.grandTotal) !== Math.max(0, computedGrandTotalCents)) {
      ctx.addIssue({
        code: "custom",
        path: ["grandTotal"],
        message: "grandTotal must equal max(0, subtotal - discountTotal + shippingTotal)",
      });
    }

    if (cart.id !== cart.userId) {
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: "cart id must equal userId (one cart per user)",
      });
    }
  });

export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;

export function validateCartItem(input: unknown): CartItem {
  return cartItemSchema.parse(input);
}

export function validateCart(input: unknown): Cart {
  return cartSchema.parse(input);
}

/**
 * Builds a stable, idempotent id for a cart item.
 * - Simple products:   `${productId}`
 * - Variable products: `${productId}__${variantId}`
 *
 * The id is what dedupes "add same variant again" → existing item gets
 * its quantity incremented instead of producing a duplicate row.
 */
export function buildCartItemId(productId: string, variantId?: string | null): string {
  const trimmedProduct = productId.trim();
  if (!trimmedProduct) {
    throw new Error("productId is required to build a cart item id");
  }
  const trimmedVariant = variantId?.trim();
  return trimmedVariant ? `${trimmedProduct}__${trimmedVariant}` : trimmedProduct;
}
