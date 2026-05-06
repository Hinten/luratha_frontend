import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminOrderConverter } from "@/src/lib/firestore/adminOrderConverter";
import { firestoreCollections } from "@/src/schemas/firestore";

export const runtime = "nodejs";

/**
 * GET /api/orders/:id
 *
 * Fetches the order identified by :id. Returns 404 when the order does not
 * exist, 200 with the order on success.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const orderRef = adminDb
    .collection(firestoreCollections.orders)
    .doc(id)
    .withConverter(adminOrderConverter);

  const snapshot = await orderRef.get();

  if (!snapshot.exists) {
    return NextResponse.json(
      { message: `Pedido com id "${id}" não encontrado.` },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot.data(), { status: 200 });
}
