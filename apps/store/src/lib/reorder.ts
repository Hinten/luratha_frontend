import type { OrderItem, Product, ProductVariant, Stock } from "@luratha/schemas";
import type { CartItemInput } from "@/src/contexts/CartContext";

/**
 * Mapeamento puro `OrderItem` → `CartItemInput` para o fluxo "Pedir novamente".
 *
 * `Order.items` é um snapshot imutável: preço, slug, imagem, estoque e até a
 * existência do produto podem ter mudado desde a compra. O `POST /api/cart/items`
 * revalida cada item contra o catálogo atual (preço, slug, sku, isPurchasable,
 * variante ativa) e rejeita divergências — então o reorder precisa reconstruir o
 * item a partir do produto **atual**, não do snapshot do pedido.
 *
 * Esta função recebe o produto e o estoque já resolvidos (a rota faz as leituras
 * no Firestore) e devolve um `CartItemInput` pronto, ou a razão pela qual o item
 * deve ser pulado. Mantê-la pura permite cobri-la por teste unitário sem rede.
 */

/** Cap por item aplicado pelo repositório de carrinho (`MAX_QUANTITY_PER_ITEM`). */
const MAX_QUANTITY_PER_ITEM = 99;

export type ReorderSkipReason = "removido" | "indisponível" | "sem estoque" | "sem imagem";

export type ReorderItemResult =
  | { ok: true; item: CartItemInput }
  | { ok: false; reason: ReorderSkipReason };

export function buildReorderItem(
  orderItem: OrderItem,
  product: Product | null,
  stock: Stock | null,
): ReorderItemResult {
  if (!product) return { ok: false, reason: "removido" };
  if (!product.isPurchasable || product.status !== "active") {
    return { ok: false, reason: "indisponível" };
  }

  // Resolve a variante e o SKU esperado contra o catálogo atual.
  let variant: ProductVariant | null = null;
  let variantSku: string;
  if (orderItem.variantId) {
    variant = product.variants?.find((v) => v.id === orderItem.variantId) ?? null;
    if (!variant || variant.active === false) {
      return { ok: false, reason: "indisponível" };
    }
    variantSku = variant.sku;
  } else {
    // O item foi comprado como produto simples. Se hoje o produto tem variantes,
    // não há como decidir qual usar — pula.
    if (product.variants && product.variants.length > 0) {
      return { ok: false, reason: "indisponível" };
    }
    variantSku = product.sku;
  }

  // Estoque — o `/api/cart/items` não checa estoque; aqui é requisito do reorder.
  const availableQty = resolveAvailableQty(product, stock, orderItem.variantId);
  if (availableQty <= 0) {
    return { ok: false, reason: "sem estoque" };
  }

  // Imagem — `CartItemInput.imageUrl` exige URL absoluta válida (z.url()), então
  // o fallback relativo de UI (`/image_404.png`) não serve: sem asset, pula.
  const photo = resolvePhoto(product, orderItem.photoId, variant);
  if (!photo) {
    return { ok: false, reason: "sem imagem" };
  }

  const unitPrice = product.price.salePrice ?? product.price.price;
  const variantLabel = buildVariantLabel(variant);

  return {
    ok: true,
    item: {
      productId: product.id,
      ...(orderItem.variantId ? { variantId: orderItem.variantId } : {}),
      variantSku,
      productSlug: product.slug,
      name: product.title,
      photoId: photo.photoId,
      imageUrl: photo.imageUrl,
      ...(variantLabel ? { variantLabel } : {}),
      unitPrice,
      currency: "BRL",
      quantity: Math.min(orderItem.quantity, MAX_QUANTITY_PER_ITEM),
    },
  };
}

/** Quantidade disponível para o item, priorizando o estoque por variante. */
function resolveAvailableQty(
  product: Product,
  stock: Stock | null,
  variantId: string | undefined,
): number {
  if (stock?.hasVariants && variantId) {
    return stock.variants?.[variantId] ?? 0;
  }
  if (stock) {
    return stock.quantity;
  }
  // Sem doc de estoque, cai no total denormalizado do produto.
  return product.totalStock;
}

/**
 * Resolve um par `{ photoId, imageUrl }` consistente a partir do catálogo atual.
 * Preferência de `photoId`: o do pedido (se ainda existir) → 1ª foto da variante
 * → 1ª foto do produto. Devolve `null` quando o produto não tem nenhuma imagem.
 */
function resolvePhoto(
  product: Product,
  orderPhotoId: string,
  variant: ProductVariant | null,
): { photoId: string; imageUrl: string } | null {
  const assetById = new Map(product.photoAssets.map((asset) => [asset.id, asset]));

  const candidates: string[] = [];
  if (assetById.has(orderPhotoId)) candidates.push(orderPhotoId);
  if (variant) candidates.push(...variant.photoIds);
  const firstAssetId = product.photoAssets[0]?.id;
  if (firstAssetId) candidates.push(firstAssetId);

  for (const photoId of candidates) {
    const asset = assetById.get(photoId);
    if (!asset) continue;
    const imageUrl = asset.resolutions.card?.downloadUrl ?? asset.resolutions.mobile.downloadUrl;
    return { photoId, imageUrl };
  }
  return null;
}

/** Rótulo legível da variante (ex.: "Verde / M"), espelhando o SizeSelector. */
function buildVariantLabel(variant: ProductVariant | null): string | undefined {
  if (!variant) return undefined;
  const parts = [variant.color?.[0] ?? null, variant.size?.[0] ?? null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" / ") : undefined;
}
