import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminProductConverter } from "@/src/lib/firestore/adminProductConverter";
import { firestoreCollections, validateStock } from "@/src/schemas/firestore";
import { skuSchema, nonEmptyStringSchema } from "@/src/schemas/firestore/utils";

export const runtime = "nodejs";

/**
 * POST /api/stock
 *
 * Creates or updates a stock document for a product.
 *
 * The product can be identified by `productId` or `sku` (at least one is required).
 * When both are supplied, `productId` takes precedence and `sku` is ignored.
 *
 * For a **simple product** (no variants), supply `quantity`:
 * ```json
 * { "productId": "prod_abc", "quantity": 10 }
 * ```
 *
 * For a **variable product**, supply `variants` (a map of variantSku → quantity).
 * The top-level `quantity` is computed automatically as the sum:
 * ```json
 * { "productId": "prod_abc", "variants": { "LURATHA_001_P": 4, "LURATHA_001_M": 6 } }
 * ```
 *
 * Returns 200 with the stored stock document.
 * Returns 400 on validation failure.
 * Returns 404 when product is not found (only when looked up by `sku`).
 */
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

  // ── Validate request body ─────────────────────────────────────────────────
  const parseResult = stockUpdateRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { message: "Dados de estoque inválidos.", errors: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { productId: bodyProductId, sku, quantity, variants } = parseResult.data;

  // ── Resolve productId ─────────────────────────────────────────────────────
  let resolvedProductId: string;
  let resolvedSku: string;

  if (bodyProductId) {
    // Look up product by id to confirm it exists and get its sku
    const productRef = adminDb
      .collection(firestoreCollections.products)
      .doc(bodyProductId)
      .withConverter(adminProductConverter);

    const productSnapshot = await productRef.get();
    if (!productSnapshot.exists) {
      return NextResponse.json(
        { message: `Produto com id "${bodyProductId}" não encontrado.` },
        { status: 404 },
      );
    }

    resolvedProductId = bodyProductId;
    resolvedSku = productSnapshot.data()!.sku;
  } else {
    // Look up product by SKU
    const productsSnapshot = await adminDb
      .collection(firestoreCollections.products)
      .withConverter(adminProductConverter)
      .where("sku", "==", sku!)
      .limit(1)
      .get();

    if (productsSnapshot.empty) {
      return NextResponse.json(
        { message: `Produto com SKU "${sku}" não encontrado.` },
        { status: 404 },
      );
    }

    const product = productsSnapshot.docs[0].data();
    resolvedProductId = product.id;
    resolvedSku = product.sku;
  }

  // ── Build stock document ──────────────────────────────────────────────────
  const now = new Date().toISOString();
  let stockDoc: ReturnType<typeof validateStock>;

  if (variants) {
    const totalQuantity = Object.values(variants).reduce((sum, qty) => sum + qty, 0);

    try {
      stockDoc = validateStock({
        productId: resolvedProductId,
        sku: resolvedSku,
        quantity: totalQuantity,
        hasVariants: true,
        variants,
        updatedAt: now,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { message: "Dados de estoque inválidos.", errors: error.issues },
          { status: 400 },
        );
      }
      throw error;
    }
  } else {
    try {
      stockDoc = validateStock({
        productId: resolvedProductId,
        sku: resolvedSku,
        quantity: quantity!,
        hasVariants: false,
        variants: null,
        updatedAt: now,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { message: "Dados de estoque inválidos.", errors: error.issues },
          { status: 400 },
        );
      }
      throw error;
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  await adminDb
    .collection(firestoreCollections.stock)
    .doc(resolvedProductId)
    .set(stockDoc);

  return NextResponse.json(stockDoc, { status: 200 });
}

// ── Request schema ────────────────────────────────────────────────────────────

const variantsMapSchema = z
  .record(z.string().min(1), z.number().int().min(0))
  .refine((m) => Object.keys(m).length > 0, { message: "variants deve ter pelo menos uma entrada." });

const stockUpdateRequestSchema = z
  .object({
    productId: nonEmptyStringSchema.max(50).optional(),
    sku: skuSchema.optional(),
    quantity: z.number().int().min(0).optional(),
    variants: variantsMapSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.productId && !data.sku) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Informe productId ou sku para identificar o produto.",
      });
    }

    if (data.quantity === undefined && data.variants === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Informe quantity (produto simples) ou variants (produto com variações).",
      });
    }

    if (data.quantity !== undefined && data.variants !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Informe apenas quantity ou variants, não ambos.",
      });
    }
  });
