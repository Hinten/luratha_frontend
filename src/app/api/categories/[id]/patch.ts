import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminCategoryConverter } from "@/src/lib/firestore/adminCategoryConverter";
import { firestoreCollections, validateCategory } from "@/src/schemas/firestore";

export const runtime = "nodejs";

/**
 * PATCH /api/categories/:id
 *
 * Partially updates the category identified by :id.
 *
 * Field update rules:
 *   - Field absent from the payload   → kept unchanged
 *   - Field present in payload as null → set to null (only for optional fields)
 *   - Field present in payload with a value → updated to that value
 *
 * `id` is always preserved from the URL parameter.
 *
 * Returns 404 if the category does not exist.
 * Returns 400 on invalid JSON or validation failure.
 * Returns 200 with the updated category on success.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const categoryRef = adminDb
    .collection(firestoreCollections.categories)
    .doc(id)
    .withConverter(adminCategoryConverter);

  const existing = await categoryRef.get();
  if (!existing.exists) {
    return NextResponse.json(
      { message: `Categoria com id "${id}" não encontrada.` },
      { status: 404 },
    );
  }

  const existingData = existing.data()!;
  const payload = body as Record<string, unknown>;

  // Merge: only keys that are explicitly present in the payload are updated.
  // This correctly handles null values (set to null) vs missing keys (unchanged).
  const merged: Record<string, unknown> = {
    ...existingData,
    ...payload,
    id, // always controlled by the server
  };

  let category;
  try {
    category = validateCategory(merged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados da categoria inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  await categoryRef.set(category);

  return NextResponse.json(category, { status: 200 });
}
