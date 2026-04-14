import { z } from "zod";
import {
  moneySchema,
  nonEmptyStringSchema,
  nonNegativeMoneySchema,
  quantitySchema,
  skuSchema,
  timestampSchema,
  uidSchema,
} from "@/src/schemas/firestore/utils";

export const cartItemSchema = z.object({
  id: nonEmptyStringSchema,
  userId: uidSchema,
  productId: nonEmptyStringSchema,
  variantSku: skuSchema,
  productSlug: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  photoId: nonEmptyStringSchema,
  unitPrice: moneySchema,
  quantity: quantitySchema,
  currency: z.literal("BRL"),
  addedAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const cartSchema = z.object({
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
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;

export function validateCartItem(input: unknown): CartItem {
  return cartItemSchema.parse(input);
}
