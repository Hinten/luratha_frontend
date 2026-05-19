import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCategoryConverter } from "@luratha/firestore/adminCategoryConverter";
import { firestoreCollections } from "@luratha/schemas";

export const runtime = "nodejs";

/**
 * GET /api/categories/:id
 *
 * Fetches the category identified by :id.
 *
 * Returns 404 if the category does not exist.
 * Returns 200 with the category on success.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const categoryRef = adminDb
    .collection(firestoreCollections.categories)
    .doc(id)
    .withConverter(adminCategoryConverter);

  const snapshot = await categoryRef.get();

  if (!snapshot.exists) {
    return NextResponse.json(
      { message: `Categoria com id "${id}" não encontrada.` },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot.data(), { status: 200 });
}
