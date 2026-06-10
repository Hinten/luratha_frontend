import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { firestoreCollections, type Product, type Stock } from "@luratha/schemas";
import { authErrorResponse, requireOwnerOrAdmin, requireUser } from "@luratha/auth/requireUser";
import { logger } from "@luratha/core/logging/logger";
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

  // Rastro do resultado: quantos itens do snapshot ainda são compráveis e por
  // que os demais foram pulados. Sem isso, uma falha do "Pedir novamente" fica
  // opaca (o cliente só vê o aviso, sem o motivo no log).
  const logPayload = {
    orderId: id,
    total: order.items.length,
    resolved: response.items.length,
    unavailable: response.unavailable,
  };
  if (response.items.length === 0) {
    logger.warn("[POST /api/orders/:id/reorder] nenhum item disponível", logPayload);
  } else {
    logger.info("[POST /api/orders/:id/reorder] resolved", logPayload);
  }

  return NextResponse.json(response, { status: 200 });
}

async function loadProducts(ids: string[]): Promise<Map<string, Product>> {
  const map = new Map<string, Product>();
  if (ids.length === 0) return map;
  const refs = ids.map((id) =>
    adminDb.collection(firestoreCollections.products).doc(id).withConverter(adminProductConverter),
  );
  const snaps = await adminDb.getAll(...refs);
  for (const snap of snaps) {
    if (!snap.exists) continue;
    // getAll perde o tipo do converter (DocumentData) — cast como em cart/merge.
    const product = snap.data() as Product;
    map.set(product.id, product);
  }
  return map;
}

async function loadStocks(ids: string[]): Promise<Map<string, Stock>> {
  const map = new Map<string, Stock>();
  if (ids.length === 0) return map;
  const refs = ids.map((id) =>
    adminDb.collection(firestoreCollections.stock).doc(id).withConverter(adminStockConverter),
  );
  const snaps = await adminDb.getAll(...refs);
  for (const snap of snaps) {
    if (!snap.exists) continue;
    // getAll perde o tipo do converter (DocumentData) — cast como em cart/merge.
    const stock = snap.data() as Stock;
    map.set(stock.productId, stock);
  }
  return map;
}
