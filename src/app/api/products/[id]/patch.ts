import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminApp } from "@/src/lib/firestore/firebaseAdmin";
import { adminProductConverter } from "@/src/lib/firestore/adminProductConverter";
import { firestoreCollections, validateProduct } from "@/src/schemas/firestore";
import { createEmbeddingService } from "@/src/lib/embeddingService";
import { generateProductEmbeddings } from "@/src/lib/productEmbeddings";

export const runtime = "nodejs";

/**
 * PATCH /api/products/:id
 *
 * Partially updates the product identified by :id.
 *
 * Field update rules:
 *   - Field absent from the payload   → kept unchanged
 *   - Field present in payload as null → set to null
 *   - Field present in payload with a value → updated to that value
 *
 * `id` and `createdAt` are always preserved from the stored document.
 * `updatedAt` is set to the current timestamp.
 *
 * Embeddings are regenerated when `title` or `description` is present in the
 * payload: vectorEmbedding from the new title, searchEmbedding from title +
 * description + categoryId + variant attributes.
 *
 * Returns 404 if the product does not exist.
 * Returns 400 on validation failure.
 * Returns 200 with the updated product on success.
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

  const productRef = adminDb
    .collection(firestoreCollections.products)
    .doc(id)
    .withConverter(adminProductConverter);

  const existing = await productRef.get();
  if (!existing.exists) {
    return NextResponse.json(
      { message: `Produto com id "${id}" não encontrado.` },
      { status: 404 },
    );
  }

  const existingData = existing.data()!;
  const payload = body as Record<string, unknown>;
  const now = new Date().toISOString();

  // Merge: only keys that are explicitly present in the payload are updated.
  // This correctly handles null values (set to null) vs missing keys (unchanged).
  const merged: Record<string, unknown> = {
    ...existingData,
    ...payload,
    // These fields are always controlled by the server:
    id,
    createdAt: existingData.createdAt,
    updatedAt: now,
  };

  // Remove slug from the merged data so the schema always regenerates it
  // based on the current title + sku (avoids slug-mismatch validation errors
  // when title or sku is updated via PATCH).
  const { slug: _slug, ...mergedWithoutSlug } = merged;

  let product;
  try {
    product = validateProduct(mergedWithoutSlug);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do produto inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Falha ao validar o produto." }, { status: 400 });
  }

  // Re-generate embeddings only when the text content may have changed.
  // Spreads only the successfully generated embeddings onto the product,
  // so existing embeddings are preserved if the new generation fails.
  const embeddingFieldsChanged = "title" in payload || "description" in payload;
  if (embeddingFieldsChanged) {
    try {
      const embeddingService = createEmbeddingService({
        credential: adminApp.options.credential,
      });
      const embeddings = await generateProductEmbeddings(product, embeddingService);
      product = { ...product, ...embeddings };
    } catch (embeddingError) {
      console.warn(
        "[PATCH /api/products] Embedding generation skipped:",
        embeddingError instanceof Error ? embeddingError.message : embeddingError,
      );
    }
  }

  await productRef.set(product);

  return NextResponse.json(product, { status: 200 });
}

