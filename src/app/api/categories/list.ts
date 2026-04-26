import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminCategoryConverter } from "@/src/lib/firestore/adminCategoryConverter";
import { firestoreCollections } from "@/src/schemas/firestore";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * GET /api/categories
 *
 * Lists categories, optionally filtered by parentId.
 *
 * Query parameters:
 *   - `parentId` — Filter by parent category ID
 *   - `limit`    — Max results to return (default 100, max 500)
 *
 * Returns 200 with an array of categories.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const parentId = url.searchParams.get("parentId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT, MAX_LIMIT),
  );

  const base = adminDb
    .collection(firestoreCollections.categories)
    .withConverter(adminCategoryConverter)
    .orderBy("name", "asc");

  const withParent = parentId ? base.where("parentId", "==", parentId) : base;
  const snapshot = await withParent.limit(limit).get();
  const categories = snapshot.docs.map((d) => d.data());

  return NextResponse.json(categories, { status: 200 });
}
