import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminApp } from "@/src/lib/firestore/firebaseAdmin";
import { adminProductConverter } from "@/src/lib/firestore/adminProductConverter";
import { firestoreCollections, validateProduct } from "@/src/schemas/firestore";
import { createEmbeddingService, EmbeddingGenerationError } from "@/src/lib/embeddingService";
import { generateProductEmbeddings } from "@/src/lib/productEmbeddings";

export const runtime = "nodejs";
export { GET } from "./list";

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

  const now = new Date().toISOString();
  const id = randomUUID();

  const inputRaw = body as Record<string, unknown>;
  const input: Record<string, unknown> = {
    ...inputRaw,
    id,
    createdAt: now,
    updatedAt: now,
    // Auto-generate an immutable id for any variant that doesn't supply one.
    variants: assignVariantIds(inputRaw.variants),
  };

  let product;
  try {
    product = validateProduct(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do produto inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  // Generate vectorEmbedding (title only) and searchEmbedding (title + description +
  // category + variants) using the admin app credential for automatic token refresh.
  // Embedding failure is non-fatal — the product is saved with null embeddings.
  try {
    const embeddingService = createEmbeddingService({
      credential: adminApp.options.credential,
    });
    const embeddings = await generateProductEmbeddings(product, embeddingService);
    product = { ...product, ...embeddings };
  } catch (embeddingError) {
    if (embeddingError instanceof EmbeddingGenerationError) {
      console.warn("[POST /api/products] Embedding generation skipped:", embeddingError.message);
    } else {
      throw embeddingError;
    }
  }

  const productRef = adminDb
    .collection(firestoreCollections.products)
    .doc(product.id)
    .withConverter(adminProductConverter);
  const existing = await productRef.get();
  if (existing.exists) {
    return NextResponse.json(
      { message: `Produto com id "${product.id}" já existe.` },
      { status: 409 },
    );
  }

  await productRef.set(product);

  return NextResponse.json(product, { status: 201 });
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

