import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCartItemConverter } from "@luratha/firestore/adminCartConverter";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { firestoreCollections } from "@luratha/schemas";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import { resolveAvailableQty } from "@luratha/payments/orderStock";
import { logger } from "@luratha/core/logging/logger";
import { CartRepositoryError, createCartsRepository } from "@luratha/repositories/cartsRepository";

export const runtime = "nodejs";

/**
 * PUT /api/cart/items/:itemId
 *
 * Sets the quantity of an existing cart item. A quantity ≤ 0 removes the
 * item — the response still returns the resulting cart snapshot, never 204,
 * so the client can re-render off a single payload.
 *
 * Increases are soft-gated by available stock (variant-aware): a quantity
 * above the current availability returns 409 `out_of_stock`. O carrinho não
 * reserva estoque — a checagem autoritativa acontece em `POST /api/orders`.
 * Se o produto sumiu do catálogo desde o add, o gate é pulado (warn) e o
 * checkout barra o item depois.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const { itemId } = await params;

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

  const quantity = (body as { quantity?: unknown }).quantity;
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || !Number.isInteger(quantity)) {
    return NextResponse.json(
      { message: "Campo 'quantity' deve ser um número inteiro." },
      { status: 400 },
    );
  }

  // Soft gate de estoque só faz sentido para quantidades positivas (≤ 0 vira
  // remoção no repositório). Resolve produto/variante a partir do snapshot do
  // próprio item — fonte dos ids sem depender do formato do itemId.
  if (quantity > 0) {
    const itemRef = adminDb
      .collection(firestoreCollections.carts)
      .doc(authedUser.uid)
      .collection(firestoreCollections.cartItems)
      .doc(itemId)
      .withConverter(adminCartItemConverter);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) {
      return NextResponse.json(
        { message: `Item "${itemId}" não encontrado no carrinho.` },
        { status: 404 },
      );
    }
    const item = itemSnap.data()!;

    const productRef = adminDb
      .collection(firestoreCollections.products)
      .doc(item.productId)
      .withConverter(adminProductConverter);
    const stockRef = adminDb
      .collection(firestoreCollections.stock)
      .doc(item.productId)
      .withConverter(adminStockConverter);
    const [productSnap, stockSnap] = await Promise.all([productRef.get(), stockRef.get()]);

    if (productSnap.exists) {
      const availableQty = resolveAvailableQty(
        productSnap.data()!,
        stockSnap.exists ? stockSnap.data()! : null,
        item.variantId,
      );
      if (quantity > availableQty) {
        const message =
          availableQty <= 0
            ? "Produto esgotado."
            : `Estoque insuficiente. Disponível: ${availableQty}.`;
        return NextResponse.json({ message, code: "out_of_stock" }, { status: 409 });
      }
    } else {
      logger.warn(
        "[PUT /api/cart/items] produto do item não existe mais — gate de estoque pulado",
        {
          itemId,
          productId: item.productId,
        },
      );
    }
  }

  const repository = createCartsRepository(adminDb);
  try {
    const snapshot = await repository.setItemQuantity(authedUser.uid, itemId, quantity);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    if (error instanceof CartRepositoryError) {
      switch (error.code) {
        case "validation":
          return NextResponse.json({ message: error.message }, { status: 400 });
        case "not_found":
          return NextResponse.json({ message: error.message }, { status: 404 });
        case "quantity_exceeded":
          return NextResponse.json({ message: error.message }, { status: 409 });
        default:
          return NextResponse.json({ message: error.message }, { status: 500 });
      }
    }
    throw error;
  }
}
