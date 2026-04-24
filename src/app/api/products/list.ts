import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminProductConverter } from "@/src/lib/firestore/adminProductConverter";
import { firestoreCollections } from "@/src/schemas/firestore";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/**
 * GET /api/products
 *
 * Lists products with optional filtering.
 *
 * Query parameters:
 *   - `status`     — Filter by product status (e.g. "active", "archived")
 *   - `categoryId` — Filter by category ID
 *   - `limit`      — Max results to return (default 24, max 100)
 *
 * Returns 200 with an array of products.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const status = url.searchParams.get("status") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT, MAX_LIMIT),
  );

  const base = adminDb
    .collection(firestoreCollections.products)
    .withConverter(adminProductConverter)
    .orderBy("updatedAt", "desc");

  const withStatus = status ? base.where("status", "==", status) : base;
  const withCategory = categoryId ? withStatus.where("categoryId", "==", categoryId) : withStatus;
  const finalQuery = withCategory.limit(limit);

  const snapshot = await finalQuery.get();
  const products = snapshot.docs.map((d) => d.data());

  return NextResponse.json(products, { status: 200 });
}
