import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCategoryConverter } from "@luratha/firestore/adminCategoryConverter";
import { firestoreCollections, validateCategory } from "@luratha/schemas";

export const runtime = "nodejs";

/**
 * PUT /api/categories/:id
 *
 * Completely replaces the category identified by :id.
 * - `id` is always taken from the URL; any `id` field in the body is ignored.
 *
 * Returns 404 if the category does not exist.
 * Returns 400 on invalid JSON or validation failure.
 * Returns 200 with the updated category on success.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const input: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
    id,
  };

  let category;
  try {
    category = validateCategory(input);
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
