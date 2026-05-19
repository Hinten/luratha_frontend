import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { firestoreCollections } from "@luratha/schemas";

export const runtime = "nodejs";

/**
 * DELETE /api/categories/:id
 *
 * Deletes the category identified by :id.
 *
 * Returns 404 if the category does not exist.
 * Returns 204 (No Content) on successful deletion.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const categoryRef = adminDb.collection(firestoreCollections.categories).doc(id);

  const existing = await categoryRef.get();
  if (!existing.exists) {
    return NextResponse.json(
      { message: `Categoria com id "${id}" não encontrada.` },
      { status: 404 },
    );
  }

  await categoryRef.delete();

  return new NextResponse(null, { status: 204 });
}
