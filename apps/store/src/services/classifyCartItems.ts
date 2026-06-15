import type { Product, Stock } from "@luratha/schemas";
import { resolveAvailableQty } from "@luratha/payments/orderStock";
import type { CartItemInput, CartItemWrite } from "@luratha/repositories/cartsRepository";

/**
 * Lógica **pura** de disponibilidade do carrinho — sem IO. Recebe os mapas já
 * carregados de produto/estoque (por `productId`) e decide, item a item, entre
 * aceitar (com a quantidade capada no disponível e preço/slug/sku/dimensions
 * refrescados do catálogo) ou dropar com `reason`. Compartilhada por
 * `/api/cart/merge` e `/api/cart/validate` via `resolveCartAvailability`.
 *
 * Soft gate de UX (não reserva estoque). A barreira autoritativa, com
 * decremento transacional, é o `POST /api/orders`.
 */

export type CartItemDropReason =
  | "product_not_found"
  | "product_unavailable"
  | "variant_unavailable"
  | "variant_required"
  | "sku_mismatch"
  | "out_of_stock";

export interface CartAvailabilityDrop {
  productId: string;
  variantId?: string;
  reason: CartItemDropReason;
}

export interface CartAvailabilityAccepted {
  /** Payload de escrita refrescado do catálogo (preço/slug/sku/dimensions). */
  write: CartItemWrite;
  /** Quantidade pedida pelo cliente (antes do cap por estoque). */
  requestedQuantity: number;
  /** Estoque disponível resolvido (variant-aware). */
  availableQty: number;
  /** True quando a quantidade foi reduzida para caber no disponível. */
  capped: boolean;
}

export interface CartAvailabilityResult {
  accepted: CartAvailabilityAccepted[];
  dropped: CartAvailabilityDrop[];
}

export function classifyCartItems(
  items: readonly CartItemInput[],
  products: ReadonlyMap<string, Product>,
  stocks: ReadonlyMap<string, Stock>,
): CartAvailabilityResult {
  const accepted: CartAvailabilityAccepted[] = [];
  const dropped: CartAvailabilityDrop[] = [];

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) {
      dropped.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "product_not_found",
      });
      continue;
    }
    if (!product.isPurchasable || product.status !== "active") {
      dropped.push({
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
        dropped.push({
          productId: item.productId,
          variantId: item.variantId,
          reason: "variant_unavailable",
        });
        continue;
      }
      expectedSku = variant.sku;
    } else {
      if (product.variants && product.variants.length > 0) {
        dropped.push({ productId: item.productId, reason: "variant_required" });
        continue;
      }
      expectedSku = product.sku;
    }

    if (item.variantSku !== expectedSku) {
      dropped.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "sku_mismatch",
      });
      continue;
    }

    const availableQty = resolveAvailableQty(
      product,
      stocks.get(item.productId) ?? null,
      item.variantId,
    );
    if (availableQty <= 0) {
      dropped.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "out_of_stock",
      });
      continue;
    }

    const catalogPrice =
      product.price.salePrice !== null ? product.price.salePrice : product.price.price;
    const cappedQuantity = Math.min(item.quantity, availableQty);
    // Refresh price/slug/sku/dimensions do catálogo em vez de confiar no
    // snapshot do cliente. `dimensions` é server-derived (anti-spoof do peso).
    accepted.push({
      write: {
        ...item,
        unitPrice: catalogPrice,
        productSlug: product.slug ?? item.productSlug,
        variantSku: expectedSku,
        quantity: cappedQuantity,
        dimensions: product.dimensions,
      },
      requestedQuantity: item.quantity,
      availableQty,
      capped: cappedQuantity < item.quantity,
    });
  }

  return { accepted, dropped };
}
