import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { adminCouponConverter } from "@luratha/firestore/adminCouponConverter";
import {
  firestoreCollections,
  type Coupon,
  type Order,
  type Product,
  type Stock,
  validateOrder,
} from "@luratha/schemas";
import { toCents } from "@luratha/schemas/utils";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import { logger } from "@luratha/core/logging/logger";
import { planStockDecrement } from "@luratha/payments/orderStock";
import { evaluateCoupon } from "@/src/lib/coupons/couponEvaluation";

export const runtime = "nodejs";

/**
 * POST /api/orders
 *
 * Creates a new order from the request body. Used by the checkout flow once
 * the cart, address and payment fields are known.
 *
 * The handler is the commitment point of the purchase, so nothing money- or
 * inventory-relevant is trusted from the client. Inside a single Firestore
 * transaction it:
 *   1. re-validates every item against the catalog (product purchasable +
 *      active, variant active, SKU match, unitPrice == current sale/list
 *      price) — `subtotal == Σ lineTotal` is enforced by the order schema;
 *   2. validates and **decrements stock** (variant-aware; see
 *      `@luratha/payments/orderStock`), marking the order with
 *      `stockMovement: "decremented"` so payment-failure/cancel paths can
 *      release it exactly once;
 *   3. re-validates the coupon (same `evaluateCoupon` used by
 *      /api/coupons/validate, over `subtotal + shippingTotal`) and increments
 *      its `usageCount`;
 *   4. checks `shippingTotal` against the `shippingMethod.price` snapshot.
 *      (No live re-quote: dragging the freight provider into order creation
 *      adds latency/flakiness and quotes legitimately drift; the residual
 *      spoof risk is bounded to the freight value. Follow-up idea: HMAC-signed
 *      quote tokens issued by /api/checkout/shipping.)
 *
 * Validation failures return 409 with a machine-readable `code`
 * (`catalog_mismatch` | `price_mismatch` | `out_of_stock` | `coupon_invalid`
 * | `discount_mismatch` | `shipping_mismatch`) consumed by the checkout UI.
 *
 * Server-controlled fields (forced, never read from the payload):
 *   - `id`, `createdAt`, `updatedAt`
 *   - `status: "pending_payment"`, `paymentStatus: "pending"` — a freshly
 *     created order can never start paid/shipped
 *   - `stockMovement`, `paymentIntentId`, `paymentPix`, `paymentBoleto`,
 *     `paidAt`, `trackingCode`, `trackingUrl`, `shippedAt`, `deliveredAt`
 *
 * Returns 400 on validation failure, 409 on business-rule conflicts (with
 * `code`), and 201 with the persisted Order on success.
 */

/** Campos que só o servidor pode escrever — descartados do payload do cliente. */
const SERVER_ONLY_FIELDS = [
  "status",
  "paymentStatus",
  "paymentIntentId",
  "paymentPix",
  "paymentBoleto",
  "paidAt",
  "trackingCode",
  "trackingUrl",
  "shippedAt",
  "deliveredAt",
  "stockMovement",
] as const;

/** Erro de regra de negócio lançado de dentro da transação → resposta 409. */
class OrderConflictError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = "OrderConflictError";
    this.code = code;
    this.details = details;
  }
}

interface CatalogIssue {
  productId: string;
  variantId?: string;
  reason: string;
}

/**
 * Re-valida os itens contra o catálogo atual — mesmas regras do merge de
 * carrinho (`/api/cart/merge`), mas comparando `item.itemSku` e falhando o
 * pedido inteiro em vez de drop silencioso (o usuário precisa ver o problema
 * antes de pagar).
 */
function validateItemsAgainstCatalog(order: Order, products: Map<string, Product>): void {
  const catalogIssues: CatalogIssue[] = [];
  const priceIssues: Array<{ productId: string; variantId?: string; expected: number }> = [];

  for (const item of order.items) {
    const product = products.get(item.productId);
    if (!product) {
      catalogIssues.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "product_not_found",
      });
      continue;
    }
    if (!product.isPurchasable || product.status !== "active") {
      catalogIssues.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "product_unavailable",
      });
      continue;
    }

    let expectedSku: string;
    if (item.variantId) {
      const variant = product.variants?.find((v) => v.id === item.variantId);
      if (!variant || variant.active === false) {
        catalogIssues.push({
          productId: item.productId,
          variantId: item.variantId,
          reason: "variant_unavailable",
        });
        continue;
      }
      expectedSku = variant.sku;
    } else {
      if (product.variants && product.variants.length > 0) {
        catalogIssues.push({ productId: item.productId, reason: "variant_required" });
        continue;
      }
      expectedSku = product.sku;
    }

    if (item.itemSku !== expectedSku) {
      catalogIssues.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "sku_mismatch",
      });
      continue;
    }

    const catalogPrice =
      product.price.salePrice !== null ? product.price.salePrice : product.price.price;
    if (toCents(item.unitPrice) !== toCents(catalogPrice)) {
      priceIssues.push({
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        expected: catalogPrice,
      });
    }
  }

  if (catalogIssues.length > 0) {
    throw new OrderConflictError(
      "Itens do pedido ficaram desatualizados em relação ao catálogo.",
      "catalog_mismatch",
      catalogIssues,
    );
  }
  if (priceIssues.length > 0) {
    throw new OrderConflictError(
      "Os preços de itens do pedido mudaram desde que foram adicionados ao carrinho.",
      "price_mismatch",
      priceIssues,
    );
  }
}

/** Valida cupom/desconto. Retorna o cupom a incrementar (ou null sem cupom). */
function validateCouponForOrder(order: Order, coupon: Coupon | null): Coupon | null {
  if (!order.couponCode) {
    if (toCents(order.discountTotal) !== 0) {
      throw new OrderConflictError(
        "Desconto aplicado sem cupom correspondente.",
        "discount_mismatch",
      );
    }
    return null;
  }

  if (!coupon) {
    throw new OrderConflictError("Cupom não encontrado.", "coupon_invalid");
  }

  // Mesma base usada pelo CouponField no checkout: subtotal + frete.
  const result = evaluateCoupon(coupon, order.subtotal + order.shippingTotal);
  if (!result.valid) {
    throw new OrderConflictError(result.reason, "coupon_invalid");
  }
  if (toCents(result.discount) !== toCents(order.discountTotal)) {
    throw new OrderConflictError(
      "O desconto do cupom não confere com o valor recalculado.",
      "discount_mismatch",
      { expected: result.discount },
    );
  }
  return coupon;
}

function validateShippingForOrder(order: Order): void {
  if (order.shippingMethod) {
    if (toCents(order.shippingTotal) !== toCents(order.shippingMethod.price)) {
      throw new OrderConflictError(
        "O valor do frete não confere com a opção selecionada.",
        "shipping_mismatch",
      );
    }
    return;
  }
  if (toCents(order.shippingTotal) !== 0) {
    throw new OrderConflictError(
      "Frete cobrado sem método de envio registrado.",
      "shipping_mismatch",
    );
  }
}

export async function POST(request: Request) {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Corpo da requisição inválido. Esperado JSON." },
        { status: 400 },
      );
    }
    throw err;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { message: "Corpo da requisição deve ser um objeto JSON." },
      { status: 400 },
    );
  }

  const bodyUserId = (body as { userId?: unknown }).userId;
  if (typeof bodyUserId !== "string" || bodyUserId !== authedUser.uid) {
    return NextResponse.json(
      { message: "userId do corpo não confere com a sessão." },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  const input: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
    id,
    createdAt: now,
    updatedAt: now,
  };
  for (const field of SERVER_ONLY_FIELDS) {
    delete input[field];
  }
  // Um pedido recém-criado nunca nasce pago/enviado.
  input.status = "pending_payment";
  input.paymentStatus = "pending";

  let order: Order;
  try {
    order = validateOrder(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do pedido inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const orderRef = adminDb
    .collection(firestoreCollections.orders)
    .doc(order.id)
    .withConverter(adminOrderConverter);

  const productIds = Array.from(new Set(order.items.map((i) => i.productId)));
  const productRefs = productIds.map((pid) =>
    adminDb.collection(firestoreCollections.products).doc(pid).withConverter(adminProductConverter),
  );
  const stockRefs = productIds.map((pid) =>
    adminDb.collection(firestoreCollections.stock).doc(pid).withConverter(adminStockConverter),
  );

  try {
    const persisted = await adminDb.runTransaction(async (tx) => {
      // ── Leituras (todas antes de qualquer escrita) ──────────────────────
      const existing = await tx.get(orderRef);
      if (existing.exists) {
        throw new OrderConflictError(`Pedido com id "${order.id}" já existe.`, "duplicate_order");
      }

      const [productSnaps, stockSnaps] = await Promise.all([
        tx.getAll(...productRefs),
        tx.getAll(...stockRefs),
      ]);

      let couponSnap = null;
      if (order.couponCode) {
        const couponQuery = adminDb
          .collection(firestoreCollections.coupons)
          .where("code", "==", order.couponCode.toUpperCase())
          .limit(1)
          .withConverter(adminCouponConverter);
        const couponResult = await tx.get(couponQuery);
        couponSnap = couponResult.empty ? null : couponResult.docs[0];
      }

      const products = new Map<string, Product>();
      for (const snap of productSnaps) {
        if (!snap.exists) continue;
        // getAll perde o tipo do converter (DocumentData) — cast como em cart/merge.
        const product = snap.data() as Product;
        products.set(product.id, product);
      }
      const stocks = new Map<string, Stock>();
      for (const snap of stockSnaps) {
        if (!snap.exists) continue;
        const stock = snap.data() as Stock;
        stocks.set(stock.productId, stock);
      }

      // ── Validações de negócio ───────────────────────────────────────────
      validateItemsAgainstCatalog(order, products);

      const stockPlan = planStockDecrement(order.items, products, stocks, now);
      if (!stockPlan.ok) {
        const names = Array.from(new Set(stockPlan.insufficient.map((s) => s.name)));
        throw new OrderConflictError(
          `Estoque insuficiente para: ${names.join(", ")}. Ajuste as quantidades no carrinho.`,
          "out_of_stock",
          stockPlan.insufficient,
        );
      }
      if (stockPlan.warnings.length > 0) {
        logger.warn("[POST /api/orders] plano de estoque degradado", {
          orderId: order.id,
          warnings: stockPlan.warnings,
        });
      }

      const coupon = validateCouponForOrder(order, couponSnap ? couponSnap.data() : null);
      validateShippingForOrder(order);

      // ── Escritas ────────────────────────────────────────────────────────
      for (const nextStock of stockPlan.nextStocks) {
        const ref = adminDb
          .collection(firestoreCollections.stock)
          .doc(nextStock.productId)
          .withConverter(adminStockConverter);
        tx.set(ref, nextStock);
      }
      for (const [productId, totalStock] of stockPlan.nextTotalStockByProduct) {
        // Update parcial do espelho denormalizado (update() não passa pelo
        // converter, mas o ref converter-bound mantém a tipagem do campo).
        const ref = adminDb
          .collection(firestoreCollections.products)
          .doc(productId)
          .withConverter(adminProductConverter);
        tx.update(ref, { totalStock });
      }
      if (coupon && couponSnap) {
        tx.update(couponSnap.ref, { usageCount: coupon.usageCount + 1 });
      }

      const finalOrder = validateOrder({ ...order, stockMovement: "decremented" });
      tx.set(orderRef, finalOrder);
      return finalOrder;
    });

    return NextResponse.json(persisted, { status: 201 });
  } catch (error) {
    if (error instanceof OrderConflictError) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          ...(error.details !== undefined ? { items: error.details } : {}),
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
