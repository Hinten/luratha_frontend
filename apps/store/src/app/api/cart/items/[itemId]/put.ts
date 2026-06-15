import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import { CartRepositoryError, createCartsRepository } from "@luratha/repositories/cartsRepository";

export const runtime = "nodejs";

/**
 * PUT /api/cart/items/:itemId
 *
 * Sets the quantity of an existing cart item. A quantity ≤ 0 removes the
 * item — the response still returns the resulting cart snapshot, never 204,
 * so the client can re-render off a single payload.
 *
 * Estoque NÃO é checado aqui — a disponibilidade é revalidada em bulk no
 * `/api/cart/validate` (carrinho/checkout) e de forma autoritativa em
 * `POST /api/orders`.
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
