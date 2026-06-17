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
 * Fonte única dos status de um pedido. O schema (`orderSchema`), o adapter de
 * pagamento (`@luratha/payments`) e a UI derivam destes const arrays — nada de
 * redigitar o union em outro arquivo. Padrão espelha `SHIPPING_PROVIDER_IDS`
 * (`siteSettings.ts`).
 */

/** Estado de fulfillment do pedido. */
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  // Fail-safe: o pagamento veio com um status do MP que não reconhecemos. Trava
  // o fulfillment (não aparece "pago") até revisão manual. Ver `mapMpStatus`.
  "unknown",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Status de pagamento normalizado. A API de Orders do MP usa `status` (grosso) +
 * `status_detail` (substatus); `mapMpStatus` (`@luratha/payments`) combina os
 * dois (e o método) pra produzir estes valores.
 */
export const PAYMENT_STATUSES = [
  // Pagamento iniciado, ainda em processamento (cartão em análise — MP `created`/`in_process`).
  "pending",
  // Aguardando o pagador pagar, por método — MP `action_required`
  // (`waiting_transfer` p/ PIX, `waiting_payment` p/ boleto).
  "awaiting_pix",
  "awaiting_boleto",
  // Cartão autorizado, ainda não capturado — MP `action_required/waiting_capture`.
  "authorized",
  // Pago e creditado — MP `processed/accredited`.
  "paid",
  // Pago com reembolso parcial — MP `processed/partially_refunded`.
  "partially_refunded",
  // Pago e depois contestado pelo comprador (disputa em curso) — MP `charged_back/in_process`.
  "in_dispute",
  // Falha genérica de processamento — MP `failed`.
  "failed",
  // Cancelado/expirado: PIX ou boleto não pago a tempo, ou cancelamento — MP `cancelled`.
  "cancelled",
  // Recusado pelo emissor/banco (cartão) — MP `rejected` (motivo no `status_detail`).
  "rejected",
  // Reembolso total — MP `refunded`.
  "refunded",
  // Estorno involuntário emitido pelo banco/emissor após disputa — MP `charged_back/{settled,reimbursed}`.
  "charged_back",
  // Fail-safe: status do MP não reconhecido. Persistido (não silenciado) pra forçar revisão.
  "unknown",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Pagamento que não foi concluído e do qual o cliente pode tentar de novo
 * (recusa/cancelamento/falha) — distinto de estorno (`refunded`/`charged_back`),
 * que pressupõe pagamento prévio. Usado pra preservar o carrinho e pra reconhecer
 * uma falha real quando o MP não devolve o artefato (PIX/boleto).
 */
export const PAYMENT_FAILURE_STATUSES = [
  "failed",
  "cancelled",
  "rejected",
] as const satisfies readonly PaymentStatus[];

/**
 * Estados terminais sem artefato a gerar e que não avançam sozinhos — o polling
 * do client (QR do PIX / boleto) deve parar em vez de tentar por 2min.
 */
export const TERMINAL_PAYMENT_STATUSES = [
  ...PAYMENT_FAILURE_STATUSES,
  "refunded",
  "charged_back",
  "unknown",
] as const satisfies readonly PaymentStatus[];

/**
 * Pagamento ainda aguardando o pagador — o artefato (QR do PIX / boleto) segue
 * válido e **deve ser preservado** no documento (reexibição em `/conta/pedidos`).
 * Quando o webhook traz qualquer outro status (pago/falha/estorno), os artefatos
 * vencidos são apagados. Inclui `awaiting_pix`/`awaiting_boleto`, não só `pending`.
 */
export const AWAITING_PAYMENT_STATUSES = [
  "pending",
  "awaiting_pix",
  "awaiting_boleto",
] as const satisfies readonly PaymentStatus[];

/**
 * Estados de fulfillment em que o pedido ainda **não foi despachado** — só nesses
 * o fail-safe `unknown` rebaixa o `Order.status` (ver `buildStatusPatch` em
 * `@luratha/payments`). Em `shipped`/`delivered`/terminais, sobrescrever destruiria
 * o histórico sem prevenir nada (o despacho já ocorreu).
 */
export const DISPATCHABLE_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "unknown",
] as const satisfies readonly OrderStatus[];

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
    orderNumber: z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{8,32}$/),
    status: z.enum(ORDER_STATUSES),
    paymentMethod: z.enum(["pix", "credit_card", "boleto"]),
    paymentStatus: z.enum(PAYMENT_STATUSES),
    /**
     * Id do pagamento no provider (MercadoPago). Preenchido por
     * `POST /api/checkout/payment-intent` e usado para correlacionar o webhook.
     * Opcional para retro-compatibilidade com pedidos anteriores à integração.
     */
    paymentIntentId: nonEmptyStringSchema.max(64).optional(),
    /**
     * Artefatos do PIX persistidos na criação do payment-intent para que o
     * cliente possa reabrir o QR Code em `/conta/pedidos/{id}` caso saia da
     * tela de sucesso antes de pagar. Limpos pelo webhook quando o pagamento
     * deixa de estar `pending` (privacidade + tamanho do doc).
     */
    paymentPix: z
      .object({
        /** Copia-cola (EMV) do PIX. */
        qrCode: nonEmptyStringSchema,
        /** Imagem PNG do QR em base64 (sem o prefixo `data:`). */
        qrCodeBase64: nonEmptyStringSchema,
        /** ISO-8601 do vencimento do QR, quando o provider informa. */
        expiresAt: timestampSchema.optional(),
      })
      .optional(),
    /**
     * Artefatos do boleto persistidos na criação do payment-intent para que o
     * cliente possa reabrir o boleto em `/conta/pedidos/{id}`. Limpos pelo
     * webhook quando o pagamento deixa de estar `pending`.
     */
    paymentBoleto: z
      .object({
        /** URL do boleto em PDF (hospedado pelo MercadoPago). */
        url: z.url(),
        /** Linha digitável para pagamento manual. */
        digitableLine: nonEmptyStringSchema.optional(),
        /** Código de barras (FEBRABAN). */
        barcode: nonEmptyStringSchema.optional(),
        /** ISO-8601 do vencimento do boleto, quando o provider informa. */
        expiresAt: timestampSchema.optional(),
      })
      .optional(),
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
    /**
     * Bookkeeping do estoque reservado por este pedido. Controlado 100% pelo
     * servidor (o `POST /api/orders` descarta o campo do payload do cliente):
     *  - `"decremented"` — setado na criação do pedido, junto do decremento
     *    transacional dos docs de `stock`.
     *  - `"released"` — setado (uma única vez) quando o estoque volta: pagamento
     *    `failed`/`cancelled`/`rejected` ou cancelamento do pedido.
     * Ausente = pedido anterior à reserva de estoque (legado) — os caminhos de
     * release fazem no-op. Enum único em vez de dois booleans para impedir
     * estados contraditórios.
     */
    stockMovement: z.enum(["decremented", "released"]).optional(),
    notes: z.string().trim().max(500).optional(),
    /**
     * `client_id` do GA4 capturado no navegador na criação do pedido (cookie
     * `_ga`). Usado para enviar o `purchase` server-side via Measurement
     * Protocol quando o pagamento confirma de forma assíncrona (PIX, boleto ou
     * cartão liberado após análise antifraude) — atribuindo o evento ao mesmo
     * visitante. Ausente quando o cliente optou por sair (sem cookie `_ga`).
     *
     * Formato fixo do GA4 client_id (`<n>.<n>`, dois inteiros): o cliente
     * preenche este campo, então validamos o shape para impedir injeção de PII
     * (ex.: e-mail) que acabaria repassada ao GA4. O capturador (`getGaClientId`)
     * só devolve valores nesse formato ou `null`, então clientes legítimos nunca
     * caem aqui — o regex barra apenas POSTs adulterados.
     */
    ga4ClientId: z
      .string()
      .regex(/^\d+\.\d+$/, 'ga4ClientId deve ter o formato do GA4 client_id ("<n>.<n>")')
      .max(64)
      .optional(),
    /**
     * Flag de dedup do envio server-side do `purchase` (Measurement Protocol).
     * Setada (uma única vez) após o webhook confirmar o pagamento e despachar o
     * evento, impedindo reenvio em re-entregas/retries do webhook. Controlada
     * 100% pelo servidor (o `POST /api/orders` descarta o campo do payload).
     */
    ga4PurchaseSent: z.boolean().optional(),
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

    const calculatedSubtotalCents = order.items.reduce(
      (sum, item) => sum + toCents(item.lineTotal),
      0,
    );
    if (toCents(order.subtotal) !== calculatedSubtotalCents) {
      ctx.addIssue({
        code: "custom",
        path: ["subtotal"],
        message: "subtotal must equal the sum of all item lineTotals",
      });
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
