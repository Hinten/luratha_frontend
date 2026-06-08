import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { firestoreCollections } from "@luratha/schemas";

export const runtime = "nodejs";

/**
 * GET /api/products/:id
 *
 * Fetches the product identified by :id.
 *
 * Returns 404 if the product does not exist.
 * Returns 200 with the product on success.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const productRef = adminDb
    .collection(firestoreCollections.products)
    .doc(id)
    .withConverter(adminProductConverter);

  const snapshot = await productRef.get();

  if (!snapshot.exists) {
    return NextResponse.json(
      { message: `Produto com id "${id}" não encontrado.` },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot.data(), { status: 200 });
}
