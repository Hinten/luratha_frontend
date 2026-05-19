import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { firestoreCollections, type Product } from "@luratha/schemas";
import { authErrorResponse, requireUser } from "@/src/lib/auth/requireUser";
import {
  CartRepositoryError,
  cartItemInputSchema,
  createCartsRepository,
  type CartItemWrite,
} from "@/src/lib/repositories/cartsRepository";

export const runtime = "nodejs";

const mergePayloadSchema = z.object({
  items: z.array(cartItemInputSchema).max(50),
});

/**
 * POST /api/cart/merge
 *
 * Merges a list of items (typically the localStorage cart from a guest
 * session that just signed in) into the authenticated user's server cart.
 *
 * Items invalid against the current catalog (deleted product, archived
 * status, mismatched price/SKU, removed variant) are silently dropped — we
 * don't want a single stale local item to fail the whole login UX. The
 * response includes a `dropped` array so the client can surface a toast if
 * desired.
 *
 * Quantities are summed with the existing server cart, then capped per
 * item by the repository.
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
    parsed = mergePayloadSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload de merge inválido.", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Falha ao validar merge." }, { status: 400 });
  }

  const productIds = Array.from(new Set(parsed.items.map((i) => i.productId)));
  const products = new Map<string, Product>();
  if (productIds.length > 0) {
    const refs = productIds.map((id) =>
      adminDb
        .collection(firestoreCollections.products)
        .doc(id)
        .withConverter(adminProductConverter),
    );
    const snaps = await adminDb.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) {
        const product = snap.data() as Product;
        products.set(product.id, product);
      }
    }
  }

  const accepted: CartItemWrite[] = [];
  const dropped: Array<{ productId: string; variantId?: string; reason: string }> = [];

  for (const item of parsed.items) {
    const product = products.get(item.productId);
    if (!product) {
      dropped.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "product_not_found",
      });
      continue;
    }
    if (!product.isPurchasable || product.status !== "active") {
      dropped.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "product_unavailable",
      });
      continue;
    }

    let expectedSku: string;
    if (item.variantId) {
      const variant = product.variants?.find((v) => v.id === item.variantId);
      if (!variant || variant.active === false) {
        dropped.push({
          productId: item.productId,
          variantId: item.variantId,
          reason: "variant_unavailable",
        });
        continue;
      }
      expectedSku = variant.sku;
    } else {
      if (product.variants && product.variants.length > 0) {
        dropped.push({ productId: item.productId, reason: "variant_required" });
        continue;
      }
      expectedSku = product.sku;
    }

    if (item.variantSku !== expectedSku) {
      dropped.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "sku_mismatch",
      });
      continue;
    }

    const catalogPrice =
      product.price.salePrice !== null ? product.price.salePrice : product.price.price;
    // Refresh price/slug/dimensions from catalog instead of trusting the
    // localStorage snapshot. `dimensions` is server-derived (anti-spoof).
    accepted.push({
      ...item,
      unitPrice: catalogPrice,
      productSlug: product.slug ?? item.productSlug,
      variantSku: expectedSku,
      dimensions: product.dimensions,
    });
  }

  const repository = createCartsRepository(adminDb);
  try {
    const snapshot = await repository.mergeItems(authedUser.uid, accepted);
    return NextResponse.json({ ...snapshot, dropped }, { status: 200 });
  } catch (error) {
    if (error instanceof CartRepositoryError) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    throw error;
  }
}
