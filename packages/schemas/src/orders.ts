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
import { ADDRESS_PATH_REGEX } from "@luratha/schemas/addresses";
import { shippingProviderIdSchema } from "@luratha/schemas/siteSettings";

/**
 * Snapshot da opção de frete escolhida no checkout.
 *
 * É um snapshot intencional — o documento não referencia configuração mutável
 * de `siteSettings`. Mudar tarifas/transportadoras no futuro não rescreve
 * pedidos antigos.
 */
export const orderShippingMethodSchema = z.object({
  providerId: shippingProviderIdSchema,
  carrier: nonEmptyStringSchema.max(60),
  service: nonEmptyStringSchema.max(60),
  serviceCode: nonEmptyStringSchema.max(40),
  /** Preço cobrado do cliente (pode ser 0 quando aplicou frete grátis). */
  price: nonNegativeMoneySchema,
  /** Preço cheio retornado pelo provider antes de qualquer desconto. */
  basePrice: nonNegativeMoneySchema,
  /** true quando a regra de frete grátis foi aplicada (loja absorve `basePrice - price`). */
  freeShippingApplied: z.boolean().default(false),
  estimatedDays: z.number().int().min(0).max(60),
});

export const orderItemSchema = z.object({
  id: nonEmptyStringSchema,
  productId: nonEmptyStringSchema,
  /** Id da variação dentro do produto. Ausente quando o produto não tem variantes. */
  variantId: nonEmptyStringSchema.optional(),
  /**
   * SKU efetivamente vendido — sku da variação se houver, caso contrário sku do produto.
   * É um snapshot do que foi cobrado, então não precisa bater com a versão atual do catálogo.
   */
  itemSku: skuSchema,
  name: nonEmptyStringSchema,
  photoId: nonEmptyStringSchema,
  quantity: quantitySchema,
  unitPrice: moneySchema,
  lineTotal: moneySchema,
  currency: z.literal("BRL"),
});

export const orderSchema = z
  .object({
    id: nonEmptyStringSchema,
    userId: uidSchema,
    orderNumber: z.string().trim().regex(/^[A-Z0-9-]{8,32}$/),
    status: z.enum([
      "pending_payment",
      "paid",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ]),
    paymentMethod: z.enum(["pix", "credit_card", "boleto"]),
    paymentStatus: z.enum(["pending", "authorized", "paid", "failed", "refunded"]),
    /**
     * Id do pagamento no provider (MercadoPago). Preenchido por
     * `POST /api/checkout/payment-intent` e usado para correlacionar o webhook.
     * Opcional para retro-compatibilidade com pedidos anteriores à integração.
     */
    paymentIntentId: nonEmptyStringSchema.max(64).optional(),
    items: z.array(orderItemSchema).min(1),
    itemCount: quantitySchema,
    subtotal: moneySchema,
    discountTotal: nonNegativeMoneySchema.default(0),
    shippingTotal: nonNegativeMoneySchema.default(0),
    grandTotal: moneySchema,
    currency: z.literal("BRL"),
    couponCode: nonEmptyStringSchema.optional(),
    /**
     * Caminho Firestore do endereço escolhido, no formato
     * `userProfiles/{uid}/addresses/{addressId}`.
     *
     * Salvamos apenas a referência (não o snapshot) — quem precisar dos
     * campos do endereço para emitir NF-e ou exibir na conta deve
     * carregá-los pelo path. Isso evita drift de dados entre o cadastro
     * do usuário e o pedido.
     */
    shippingAddressPath: z.string().regex(ADDRESS_PATH_REGEX),
    /** Snapshot da opção de frete contratada. Opcional para retro-compatibilidade
     *  com pedidos antigos que não tinham essa informação estruturada. */
    shippingMethod: orderShippingMethodSchema.optional(),
    /** Código de rastreio fornecido pela transportadora (MVP — preenchimento manual). */
    trackingCode: nonEmptyStringSchema.max(80).optional(),
    /** URL pública de rastreio. Quando ausente, a UI monta uma URL padrão pelo carrier. */
    trackingUrl: z.url().optional(),
    /** Quando o pagamento foi confirmado pelo provider (webhook do MercadoPago). */
    paidAt: timestampSchema.optional(),
    shippedAt: timestampSchema.optional(),
    deliveredAt: timestampSchema.optional(),
    notes: z.string().trim().max(500).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((order, ctx) => {
    const calculatedItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    if (calculatedItemCount !== order.itemCount) {
      ctx.addIssue({
        code: "custom",
        path: ["itemCount"],
        message: "itemCount must match the sum of all item quantities",
      });
    }

    for (const item of order.items) {
      if (toCents(item.lineTotal) !== toCents(item.unitPrice) * item.quantity) {
        ctx.addIssue({
          code: "custom",
          path: ["items"],
          message: "lineTotal must equal unitPrice multiplied by quantity",
        });
      }
    }

    const calculatedGrandTotalCents =
      toCents(order.subtotal) - toCents(order.discountTotal) + toCents(order.shippingTotal);

    if (toCents(order.grandTotal) !== calculatedGrandTotalCents || order.grandTotal <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["grandTotal"],
        message: "grandTotal must match subtotal - discountTotal + shippingTotal",
      });
    }
  });

export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderShippingMethod = z.infer<typeof orderShippingMethodSchema>;
export type Order = z.infer<typeof orderSchema>;

export function validateOrder(input: unknown): Order {
  return orderSchema.parse(input);
}
