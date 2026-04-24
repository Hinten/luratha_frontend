import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { firestoreCollections } from "@/src/schemas/firestore";

export const runtime = "nodejs";

/**
 * DELETE /api/products/:id
 *
 * Deletes the product identified by :id.
 *
 * Returns 404 if the product does not exist.
 * Returns 204 (No Content) on successful deletion.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const productRef = adminDb.collection(firestoreCollections.products).doc(id);

  const existing = await productRef.get();
  if (!existing.exists) {
    return NextResponse.json(
      { message: `Produto com id "${id}" não encontrado.` },
      { status: 404 },
    );
  }

  await productRef.delete();

  return new NextResponse(null, { status: 204 });
}
