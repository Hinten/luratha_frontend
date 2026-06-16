/**
 * Eventos de e-commerce GA4 (Enhanced E-commerce / Recommended events).
 *
 * Cada helper monta o payload no formato esperado pelo GA4 — `currency`,
 * `value` (Σ price·quantity) e o array `items[]` — e delega o disparo a
 * `trackEvent`. Os mapeadores (`*ToItem`) são funções puras, fáceis de testar
 * isoladamente; é onde garantimos que os valores enviados batem com o catálogo.
 *
 * Docs: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */

import type { CartItem, OrderItem, Product } from "@luratha/schemas";
import { trackEvent } from "./gtag";

const CURRENCY = "BRL" as const;

/** Item no formato GA4 (`items[]`). */
export interface Ga4Item {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  index?: number;
}

/**
 * Linha mínima de carrinho aceita por `trackAddToCart`/`trackRemoveFromCart`.
 * `CartItemInput` e `CartItem` são ambos atribuíveis a este shape.
 */
export interface CartLineInput {
  productId?: string;
  variantSku: string;
  name: string;
  unitPrice: number;
  quantity?: number;
  variantLabel?: string;
}

/** Arredonda para 2 casas, evitando ruído de ponto flutuante no `value`. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Σ price·quantity de uma lista de items GA4. */
export function sumItemsValue(items: Ga4Item[]): number {
  return round2(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
}

export function productToItem(product: Product, index?: number): Ga4Item {
  return {
    item_id: product.sku,
    item_name: product.title,
    item_brand: product.brandName,
    price: product.price.salePrice ?? product.price.price,
    quantity: 1,
    ...(index !== undefined ? { index } : {}),
  };
}

export function cartLineToItem(line: CartLineInput): Ga4Item {
  return {
    item_id: line.variantSku,
    item_name: line.name,
    ...(line.variantLabel ? { item_variant: line.variantLabel } : {}),
    price: line.unitPrice,
    quantity: line.quantity ?? 1,
  };
}

export function orderItemToItem(item: OrderItem): Ga4Item {
  return {
    item_id: item.itemSku,
    item_name: item.name,
    price: item.unitPrice,
    quantity: item.quantity,
  };
}

// ── Eventos do funil ────────────────────────────────────────────────────────

export function trackViewItem(product: Product): void {
  const item = productToItem(product);
  trackEvent("view_item", { currency: CURRENCY, value: item.price, items: [item] });
}

export function trackViewItemList(products: Product[], listName?: string): void {
  const items = products.map((p, index) => productToItem(p, index));
  trackEvent("view_item_list", {
    ...(listName ? { item_list_name: listName } : {}),
    items,
  });
}

export function trackAddToCart(line: CartLineInput): void {
  const item = cartLineToItem(line);
  trackEvent("add_to_cart", {
    currency: CURRENCY,
    value: round2(item.price * item.quantity),
    items: [item],
  });
}

export function trackRemoveFromCart(line: CartLineInput): void {
  const item = cartLineToItem(line);
  trackEvent("remove_from_cart", {
    currency: CURRENCY,
    value: round2(item.price * item.quantity),
    items: [item],
  });
}

export function trackViewCart(items: CartItem[], value?: number): void {
  const ga4Items = items.map(cartLineToItem);
  trackEvent("view_cart", {
    currency: CURRENCY,
    value: value !== undefined ? round2(value) : sumItemsValue(ga4Items),
    items: ga4Items,
  });
}

export function trackBeginCheckout(items: CartItem[], value: number, coupon?: string): void {
  trackEvent("begin_checkout", {
    currency: CURRENCY,
    value: round2(value),
    ...(coupon ? { coupon } : {}),
    items: items.map(cartLineToItem),
  });
}

export function trackAddShippingInfo(
  items: CartItem[],
  value: number,
  shippingTier?: string,
): void {
  trackEvent("add_shipping_info", {
    currency: CURRENCY,
    value: round2(value),
    ...(shippingTier ? { shipping_tier: shippingTier } : {}),
    items: items.map(cartLineToItem),
  });
}

export function trackAddPaymentInfo(items: CartItem[], value: number, paymentType?: string): void {
  trackEvent("add_payment_info", {
    currency: CURRENCY,
    value: round2(value),
    ...(paymentType ? { payment_type: paymentType } : {}),
    items: items.map(cartLineToItem),
  });
}

export interface PurchaseParams {
  transactionId: string;
  value: number;
  shipping: number;
  items: OrderItem[];
  tax?: number;
  coupon?: string;
}

export function trackPurchase({
  transactionId,
  value,
  shipping,
  items,
  tax,
  coupon,
}: PurchaseParams): void {
  trackEvent("purchase", {
    transaction_id: transactionId,
    currency: CURRENCY,
    value: round2(value),
    shipping: round2(shipping),
    ...(tax !== undefined ? { tax: round2(tax) } : {}),
    ...(coupon ? { coupon } : {}),
    items: items.map(orderItemToItem),
  });
}
