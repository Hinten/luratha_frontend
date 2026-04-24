import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminApp } from "@/src/lib/firestore/firebaseAdmin";
import { adminProductConverter } from "@/src/lib/firestore/adminProductConverter";
import { firestoreCollections, validateProduct } from "@/src/schemas/firestore";
import { createEmbeddingService } from "@/src/lib/embeddingService";

export const runtime = "nodejs";
export { GET } from "./list";

export async function POST(request: Request) {
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

  const now = new Date().toISOString();
  const id = randomUUID();

  const input: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
    id,
    createdAt: now,
    updatedAt: now,
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
    return NextResponse.json({ message: "Falha ao validar o produto." }, { status: 400 });
  }

  // Generate embeddings from title + description using the admin app credential for
  // automatic token refresh (no VERTEX_AI_ACCESS_TOKEN env var required).
  const embeddingText = `${product.title} ${product.description}`;
  try {
    const embeddingService = createEmbeddingService({
      credential: adminApp.options.credential,
    });
    const embedding = await embeddingService.embed(embeddingText);
    product = { ...product, vectorEmbedding: embedding, searchEmbedding: embedding };
  } catch (embeddingError) {
    console.warn(
      "[POST /api/products] Embedding generation skipped:",
      embeddingError instanceof Error ? embeddingError.message : embeddingError,
    );
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

