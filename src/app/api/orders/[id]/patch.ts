import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminOrderConverter } from "@/src/lib/firestore/adminOrderConverter";
import { firestoreCollections, validateOrder } from "@/src/schemas/firestore";

export const runtime = "nodejs";

/**
 * PATCH /api/orders/:id
 *
 * Partially updates an existing order. The PATCH semantics match the project
 * convention (see CLAUDE.md):
 *   - Field absent from the payload   → kept unchanged
 *   - Field present in payload as null → set to null
 *   - Field present with a value      → updated
 *
 * Server-controlled (always preserved/overwritten):
 *   - `id`, `userId`, `createdAt` are taken from the stored document
 *   - `updatedAt` is set to the current timestamp
 *
 * Returns 404 if the order does not exist, 400 on validation failure, 200
 * with the updated order on success.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Corpo da requisição inválido. Esperado JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { message: "Corpo da requisição deve ser um objeto JSON." },
      { status: 400 },
    );
  }

  const orderRef = adminDb
    .collection(firestoreCollections.orders)
    .doc(id)
    .withConverter(adminOrderConverter);

  const existing = await orderRef.get();
  if (!existing.exists) {
    return NextResponse.json(
      { message: `Pedido com id "${id}" não encontrado.` },
      { status: 404 },
    );
  }

  const existingData = existing.data()!;
  const payload = body as Record<string, unknown>;
  const now = new Date().toISOString();

  const merged: Record<string, unknown> = {
    ...existingData,
    ...payload,
    id,
    userId: existingData.userId,
    createdAt: existingData.createdAt,
    updatedAt: now,
  };

  let order;
  try {
    order = validateOrder(merged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do pedido inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Falha ao validar o pedido." }, { status: 400 });
  }

  await orderRef.set(order);

  return NextResponse.json(order, { status: 200 });
}
