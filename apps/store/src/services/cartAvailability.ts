import "server-only";
import type { Firestore as AdminFirestore } from "firebase-admin/firestore";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { firestoreCollections, type Product, type Stock } from "@luratha/schemas";
import type { CartItemInput } from "@luratha/repositories/cartsRepository";
import { classifyCartItems, type CartAvailabilityResult } from "./classifyCartItems";

export type {
  CartItemDropReason,
  CartAvailabilityDrop,
  CartAvailabilityAccepted,
  CartAvailabilityResult,
} from "./classifyCartItems";
export { classifyCartItems } from "./classifyCartItems";

/** Carrega produtos + estoque dos `productIds` distintos em uma única leva. */
async function loadCatalogMaps(
  adminDb: AdminFirestore,
  productIds: string[],
): Promise<{ products: Map<string, Product>; stocks: Map<string, Stock> }> {
  const products = new Map<string, Product>();
  const stocks = new Map<string, Stock>();
  if (productIds.length === 0) return { products, stocks };

  const refs = productIds.map((id) =>
    // eslint-disable-next-line no-restricted-syntax -- ref read-only (getAll p/ revalidar disponibilidade); converter-bound, sem escrita
    adminDb.collection(firestoreCollections.products).doc(id).withConverter(adminProductConverter),
  );
  const stockRefs = productIds.map((id) =>
    // eslint-disable-next-line no-restricted-syntax -- ref read-only (getAll p/ revalidar disponibilidade); converter-bound, sem escrita
    adminDb.collection(firestoreCollections.stock).doc(id).withConverter(adminStockConverter),
  );
  const [snaps, stockSnaps] = await Promise.all([
    adminDb.getAll(...refs),
    adminDb.getAll(...stockRefs),
  ]);
  for (const snap of snaps) {
    if (snap.exists) {
      const product = snap.data() as Product;
      products.set(product.id, product);
    }
  }
  for (const snap of stockSnaps) {
    if (snap.exists) {
      const stock = snap.data() as Stock;
      stocks.set(stock.productId, stock);
    }
  }
  return { products, stocks };
}

/**
 * Entrypoint com IO: lê o catálogo + estoque dos itens em bulk (uma leva de
 * `getAll`, sem o limite de 30 do `in`) e delega para `classifyCartItems`.
 * Fonte única usada por `/api/cart/merge` (no login) e `/api/cart/validate`
 * (revisão do carrinho/checkout).
 */
export async function resolveCartAvailability(
  adminDb: AdminFirestore,
  items: readonly CartItemInput[],
): Promise<CartAvailabilityResult> {
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const { products, stocks } = await loadCatalogMaps(adminDb, productIds);
  return classifyCartItems(items, products, stocks);
}
