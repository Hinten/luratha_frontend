import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminApp } from "@/src/lib/firestore/firebaseAdmin";
import { adminProductConverter } from "@/src/lib/firestore/adminProductConverter";
import { firestoreCollections, validateProduct } from "@/src/schemas/firestore";
import { createEmbeddingService } from "@/src/lib/embeddingService";
import { generateProductEmbeddings } from "@/src/lib/productEmbeddings";

export const runtime = "nodejs";

/**
 * PUT /api/products/:id
 *
 * Completely replaces the product identified by :id.
 * - `id` is always taken from the URL; any `id` field in the body is ignored.
 * - `createdAt` is preserved from the existing document.
 * - `updatedAt` is set to the current timestamp.
 * - Embeddings are regenerated: vectorEmbedding from title, searchEmbedding
 *   from title + description + categoryId + variant attributes.
 *
 * Returns 404 if the product does not exist.
 * Returns 400 on validation failure.
 * Returns 200 with the updated product on success.
 */
export async function PUT(
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
  const now = new Date().toISOString();

  const input: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
    id,
    createdAt: existingData.createdAt,
    updatedAt: now,
  };

  // Remove slug so the schema always regenerates it from the new title + sku.
  const { slug: _slug, ...inputWithoutSlug } = input;

  let product;
  try {
    product = validateProduct(inputWithoutSlug);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do produto inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Falha ao validar o produto." }, { status: 400 });
  }

  // Regenerate vectorEmbedding (title only) and searchEmbedding (rich text).
  try {
    const embeddingService = createEmbeddingService({
      credential: adminApp.options.credential,
    });
    const embeddings = await generateProductEmbeddings(product, embeddingService);
    product = { ...product, ...embeddings };
  } catch (embeddingError) {
    console.warn(
      "[PUT /api/products] Embedding generation skipped:",
      embeddingError instanceof Error ? embeddingError.message : embeddingError,
    );
  }

  await productRef.set(product);

  return NextResponse.json(product, { status: 200 });
}

