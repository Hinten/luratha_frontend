import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { firestoreCollections, type Product, type Stock } from "@luratha/schemas";
import { authErrorResponse, requireOwnerOrAdmin, requireUser } from "@luratha/auth/requireUser";
import type { CartItemInput } from "@/src/contexts/CartContext";
import { buildReorderItem, type ReorderSkipReason } from "@/src/lib/reorder";

export const runtime = "nodejs";

interface ReorderResponse {
  items: CartItemInput[];
  unavailable: { name: string; reason: ReorderSkipReason }[];
}

/**
 * POST /api/orders/:id/reorder
 *
 * Resolve os itens do pedido contra o catálogo **atual** e devolve os
 * `CartItemInput[]` prontos para re-adicionar ao carrinho, junto da lista de
 * itens que não puderam ser refeitos (produto removido / não-comprável /
 * variante inativa / sem estoque / sem imagem). Não escreve no carrinho — o
 * cliente faz `addItem()` de cada item retornado.
 *
 * Não restringe por status do pedido: a UI controla onde o botão aparece
 * (estado PIX/boleto expirado). Exige posse do pedido (ou admin).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const orderRef = adminDb
    .collection(firestoreCollections.orders)
    .doc(id)
    .withConverter(adminOrderConverter);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) {
    return NextResponse.json({ message: `Pedido com id "${id}" não encontrado.` }, { status: 404 });
  }
  const order = snapshot.data()!;

  try {
    await requireOwnerOrAdmin(order.userId);
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  // Resolve produto + estoque atuais para cada productId único do pedido.
  const productIds = [...new Set(order.items.map((item) => item.productId))];
  const [products, stocks] = await Promise.all([loadProducts(productIds), loadStocks(productIds)]);

  const response: ReorderResponse = { items: [], unavailable: [] };
  for (const orderItem of order.items) {
    const result = buildReorderItem(
      orderItem,
      products.get(orderItem.productId) ?? null,
      stocks.get(orderItem.productId) ?? null,
    );
    if (result.ok) {
      response.items.push(result.item);
    } else {
      response.unavailable.push({ name: orderItem.name, reason: result.reason });
    }
  }

  return NextResponse.json(response, { status: 200 });
}

async function loadProducts(ids: string[]): Promise<Map<string, Product>> {
  const snaps = await Promise.all(
    ids.map((id) =>
      adminDb
        .collection(firestoreCollections.products)
        .doc(id)
        .withConverter(adminProductConverter)
        .get(),
    ),
  );
  const map = new Map<string, Product>();
  for (const snap of snaps) {
    const product = snap.data();
    if (product) map.set(product.id, product);
  }
  return map;
}

async function loadStocks(ids: string[]): Promise<Map<string, Stock>> {
  const snaps = await Promise.all(
    ids.map((id) =>
      adminDb
        .collection(firestoreCollections.stock)
        .doc(id)
        .withConverter(adminStockConverter)
        .get(),
    ),
  );
  const map = new Map<string, Stock>();
  for (const snap of snaps) {
    const stock = snap.data();
    if (stock) map.set(stock.productId, stock);
  }
  return map;
}
