import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCategoryConverter } from "@luratha/firestore/adminCategoryConverter";
import { firestoreCollections, validateCategory } from "@luratha/schemas";

export const runtime = "nodejs";
export { GET } from "./list";

/**
 * POST /api/categories
 *
 * Creates a new category.
 * - `id` is always server-generated (any `id` in the body is overridden).
 * - `name` and `slug` are required.
 * - `parentId` is optional.
 *
 * Returns 400 on invalid JSON or validation failure.
 * Returns 409 if a category with the generated ID already exists.
 * Returns 201 with the created category on success.
 */
export async function POST(request: Request) {
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

  const id = randomUUID();
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

  const categoryRef = adminDb
    .collection(firestoreCollections.categories)
    .doc(category.id)
    .withConverter(adminCategoryConverter);

  const existing = await categoryRef.get();
  if (existing.exists) {
    return NextResponse.json(
      { message: `Categoria com id "${category.id}" já existe.` },
      { status: 409 },
    );
  }

  await categoryRef.set(category);

  return NextResponse.json(category, { status: 201 });
}
