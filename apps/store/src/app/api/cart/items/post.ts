import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { firestoreCollections } from "@luratha/schemas";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import {
  CartRepositoryError,
  cartItemInputSchema,
  createCartsRepository,
} from "@/src/lib/repositories/cartsRepository";

export const runtime = "nodejs";

/**
 * POST /api/cart/items
 *
 * Adds an item to the authenticated user's cart. Idempotent on
 * (productId, variantId): re-adding the same variant increments quantity
 * (capped at the per-item limit enforced by the repository).
 *
 * Validates against the canonical product document:
 *   - product must exist and be `isPurchasable`
 *   - variantId (when provided) must exist in product.variants
 *   - sku snapshot must match the product/variant sku
 *   - unitPrice must match the current product/variant sale or list price
 *
 * These checks make the cart a faithful, non-spoofable snapshot of the
 * catalog at add-time. We re-validate at checkout, but trusting the cart
 * here is what lets the UI show prices without an extra round-trip.
 */
export async function POST(request: Request) {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

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

  let parsed;
  try {
    parsed = cartItemInputSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do item inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Falha ao validar item." }, { status: 400 });
  }

  const productRef = adminDb
    .collection(firestoreCollections.products)
    .doc(parsed.productId)
    .withConverter(adminProductConverter);
  const productSnap = await productRef.get();
  if (!productSnap.exists) {
    return NextResponse.json(
      { message: `Produto "${parsed.productId}" não encontrado.` },
      { status: 404 },
    );
  }
  const product = productSnap.data()!;

  if (!product.isPurchasable || product.status !== "active") {
    return NextResponse.json(
      { message: "Produto indisponível para compra." },
      { status: 409 },
    );
  }

  let expectedSku: string;
  if (parsed.variantId) {
    const variant = product.variants?.find((v) => v.id === parsed.variantId);
    if (!variant) {
      return NextResponse.json(
        { message: `Variante "${parsed.variantId}" não encontrada no produto.` },
        { status: 404 },
      );
    }
    if (variant.active === false) {
      return NextResponse.json(
        { message: "Variante indisponível para compra." },
        { status: 409 },
      );
    }
    expectedSku = variant.sku;
  } else {
    if (product.variants && product.variants.length > 0) {
      return NextResponse.json(
        { message: "Este produto possui variantes — variantId é obrigatório." },
        { status: 400 },
      );
    }
    expectedSku = product.sku;
  }

  if (parsed.variantSku !== expectedSku) {
    return NextResponse.json(
      { message: "SKU da variante não confere com o catálogo." },
      { status: 409 },
    );
  }

  const catalogPrice =
    product.price.salePrice !== null ? product.price.salePrice : product.price.price;
  if (parsed.unitPrice !== catalogPrice) {
    return NextResponse.json(
      { message: "unitPrice não confere com o preço atual do produto." },
      { status: 409 },
    );
  }

  if (parsed.productSlug !== product.slug) {
    return NextResponse.json(
      { message: "productSlug não confere com o catálogo." },
      { status: 409 },
    );
  }

  const repository = createCartsRepository(adminDb);
  try {
    // `dimensions` é derivado do produto (server-side) — o cliente não envia.
    const snapshot = await repository.addItem(authedUser.uid, {
      ...parsed,
      dimensions: product.dimensions,
    });
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    if (error instanceof CartRepositoryError) {
      return mapRepositoryError(error);
    }
    throw error;
  }
}

function mapRepositoryError(error: CartRepositoryError): NextResponse {
  switch (error.code) {
    case "validation":
      return NextResponse.json({ message: error.message }, { status: 400 });
    case "quantity_exceeded":
      return NextResponse.json({ message: error.message }, { status: 409 });
    case "too_many_items":
      return NextResponse.json({ message: error.message }, { status: 409 });
    case "not_found":
      return NextResponse.json({ message: error.message }, { status: 404 });
    default:
      return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
