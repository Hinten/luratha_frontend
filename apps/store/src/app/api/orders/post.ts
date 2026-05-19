import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { firestoreCollections, validateOrder } from "@luratha/schemas";
import { authErrorResponse, requireUser } from "@/src/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * POST /api/orders
 *
 * Creates a new order from the request body. Used by the checkout flow once
 * the cart, address and payment fields are known.
 *
 * The endpoint does NOT decrement stock or create a payment intent — those are
 * handled by the (future) /api/checkout/* endpoints (PR 4). This handler is
 * intentionally side-effect-free so it can be exercised in isolation.
 *
 * Server-controlled fields:
 *   - `id`         — generated as a UUID
 *   - `createdAt`  — current ISO-8601 timestamp
 *   - `updatedAt`  — current ISO-8601 timestamp
 *
 * Returns 400 on validation failure, 409 if the generated id collides
 * (extremely unlikely, but handled), and 201 with the persisted Order on
 * success.
 */
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

  let order;
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

  const existing = await orderRef.get();
  if (existing.exists) {
    return NextResponse.json(
      { message: `Pedido com id "${order.id}" já existe.` },
      { status: 409 },
    );
  }

  await orderRef.set(order);

  return NextResponse.json(order, { status: 201 });
}
