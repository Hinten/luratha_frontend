/**
 * Eventos de e-commerce do Meta (Facebook) Pixel.
 *
 * Cada helper monta o payload no formato esperado pelo Pixel — `content_ids`,
 * `contents` (`{id, quantity, item_price}`), `content_type`, `currency`, `value`
 * e `num_items` — e delega o disparo a `trackPixelEvent`. Os mapeadores
 * (`*ToContent`) são funções puras, fáceis de testar isoladamente.
 *
 * **Match com o catálogo:** `content_ids`/`contents[].id` usam o **SKU**, o
 * mesmo identificador do feed do Merchant/Catálogo (`g:id`) e do GA4
 * (`item_id`). Isso garante que os Anúncios Dinâmicos / Advantage+ casem os
 * eventos com os produtos do Commerce Manager. `content_type` é sempre
 * `"product"`.
 *
 * Cobrimos os eventos padrão do funil. Eventos GA4 sem equivalente padrão no
 * Meta (`remove_from_cart`, `view_cart`, `add_shipping_info`) ficam de fora.
 *
 * Docs: https://developers.facebook.com/docs/meta-pixel/reference
 */

import type { CartItem, OrderItem, Product } from "@luratha/schemas";
import { trackPixelEvent } from "./fbq";
import type { CartLineInput } from "./ecommerce";

const CURRENCY = "BRL" as const;
const CONTENT_TYPE = "product" as const;

/** Item no formato `contents[]` do Pixel. */
export interface PixelContent {
  id: string;
  quantity: number;
  item_price: number;
}

/** Arredonda para 2 casas, evitando ruído de ponto flutuante no `value`. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Σ item_price·quantity de uma lista de contents. */
function sumContentsValue(contents: PixelContent[]): number {
  return round2(contents.reduce((sum, c) => sum + c.item_price * c.quantity, 0));
}

/** Σ quantity — preenche `num_items`. */
function sumContentsCount(contents: PixelContent[]): number {
  return contents.reduce((sum, c) => sum + c.quantity, 0);
}

// content_ids/contents[].id = SKU, mesmo identificador do feed (g:id) e do GA4
// (item_id) — é o que casa o evento com o catálogo do Commerce Manager.
export function productToContent(product: Product): PixelContent {
  return {
    id: product.sku,
    quantity: 1,
    item_price: product.price.salePrice ?? product.price.price,
  };
}

export function cartLineToContent(line: CartLineInput): PixelContent {
  return {
    id: line.variantSku,
    quantity: line.quantity ?? 1,
    item_price: line.unitPrice,
  };
}

export function orderItemToContent(item: OrderItem): PixelContent {
  return {
    id: item.itemSku,
    quantity: item.quantity,
    item_price: item.unitPrice,
  };
}

// ── Eventos do funil ────────────────────────────────────────────────────────

export function trackPixelViewContent(product: Product): void {
  const content = productToContent(product);
  trackPixelEvent("ViewContent", {
    content_ids: [content.id],
    contents: [content],
    content_type: CONTENT_TYPE,
    content_name: product.title,
    currency: CURRENCY,
    value: content.item_price,
  });
}

export function trackPixelViewCategory(products: Product[], categoryName?: string): void {
  const contents = products.map(productToContent);
  trackPixelEvent("ViewCategory", {
    content_ids: contents.map((c) => c.id),
    contents,
    content_type: CONTENT_TYPE,
    ...(categoryName ? { content_category: categoryName, content_name: categoryName } : {}),
    currency: CURRENCY,
    value: sumContentsValue(contents),
  });
}

export function trackPixelAddToCart(line: CartLineInput): void {
  const content = cartLineToContent(line);
  trackPixelEvent("AddToCart", {
    content_ids: [content.id],
    contents: [content],
    content_type: CONTENT_TYPE,
    content_name: line.name,
    currency: CURRENCY,
    value: round2(content.item_price * content.quantity),
  });
}

export function trackPixelInitiateCheckout(items: CartItem[], value: number): void {
  const contents = items.map(cartLineToContent);
  trackPixelEvent("InitiateCheckout", {
    content_ids: contents.map((c) => c.id),
    contents,
    content_type: CONTENT_TYPE,
    num_items: sumContentsCount(contents),
    currency: CURRENCY,
    value: round2(value),
  });
}

export function trackPixelAddPaymentInfo(items: CartItem[], value: number): void {
  const contents = items.map(cartLineToContent);
  trackPixelEvent("AddPaymentInfo", {
    content_ids: contents.map((c) => c.id),
    contents,
    content_type: CONTENT_TYPE,
    num_items: sumContentsCount(contents),
    currency: CURRENCY,
    value: round2(value),
  });
}

export interface PixelPurchaseParams {
  /** Id do pedido — vira `eventID` para dedupe com a Conversions API. */
  transactionId: string;
  value: number;
  items: OrderItem[];
}

export function trackPixelPurchase({ transactionId, value, items }: PixelPurchaseParams): void {
  const contents = items.map(orderItemToContent);
  trackPixelEvent(
    "Purchase",
    {
      content_ids: contents.map((c) => c.id),
      contents,
      content_type: CONTENT_TYPE,
      num_items: sumContentsCount(contents),
      currency: CURRENCY,
      value: round2(value),
    },
    { eventID: transactionId },
  );
}
