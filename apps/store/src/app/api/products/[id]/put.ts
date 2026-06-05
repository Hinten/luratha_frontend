import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminApp } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { firestoreCollections, validateProduct } from "@luratha/schemas";
import { createEmbeddingService, EmbeddingGenerationError } from "@luratha/core/embeddingService";
import { logger } from "@luratha/core/logging/logger";
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

  const bodyRaw = body as Record<string, unknown>;
  const input: Record<string, unknown> = {
    ...bodyRaw,
    id,
    createdAt: existingData.createdAt,
    updatedAt: now,
    // Auto-generate an immutable id for any variant that doesn't supply one.
    variants: assignVariantIds(bodyRaw.variants),
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
    throw error;
  }

  // Regenerate vectorEmbedding (title only) and searchEmbedding (rich text).
  // Embedding failure is non-fatal — the product keeps its existing embeddings
  // and the operation succeeds. We narrow on Error so unknown thrown values
  // (e.g. strings) still surface; that's distinct from `instanceof Error`
  // being the *only* check, which the convention forbids.
  try {
    const embeddingService = createEmbeddingService({
      credential: adminApp.options.credential,
    });
    const embeddings = await generateProductEmbeddings(product, embeddingService);
    product = { ...product, ...embeddings };
  } catch (embeddingError) {
    if (embeddingError instanceof EmbeddingGenerationError) {
      logger.warn("[PUT /api/products] Embedding generation skipped", {
        message: embeddingError.message,
      });
    } else {
      throw embeddingError;
    }
  }

  await productRef.set(product);

  return NextResponse.json(product, { status: 200 });
}

/**
 * Assigns a unique immutable `id` to each variant that does not already have one.
 * Existing IDs are preserved (idempotent for update flows).
 */
function assignVariantIds(variants: unknown): unknown {
  if (!Array.isArray(variants)) return variants;
  return variants.map((variant) => {
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) return variant;
    const v = variant as Record<string, unknown>;
    return v.id ? v : { ...v, id: randomUUID() };
  });
}
