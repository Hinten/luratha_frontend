import { NextResponse } from "next/server";
import {
  and,
  execute,
  field,
  or,
  type BooleanExpression,
  type PipelineSnapshot,
} from "firebase/firestore/pipelines";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminCategoryConverter } from "@/src/lib/firestore/adminCategoryConverter";
import { searchDb } from "@/src/lib/firestore/firebaseSearchDb";
import { firestoreCollections, validateCategory } from "@luratha/schemas";
import type { Category } from "@luratha/schemas";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * GET /api/categories
 *
 * Lists or searches categories.
 *
 * Query parameters:
 *   - `q`        — Search term (name or slug). When provided, uses the
 *                  Firestore Pipeline API for case-insensitive regex matching.
 *   - `parentId` — Filter by parent category ID
 *   - `limit`    — Max results to return (default 100, max 500)
 *
 * Returns 200 with an array of categories.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const q = url.searchParams.get("q")?.trim() || undefined;
  const parentId = url.searchParams.get("parentId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT, MAX_LIMIT),
  );

  if (q) {
    const categories = await searchByQuery(q, parentId, limit);
    return NextResponse.json(categories, { status: 200 });
  }

  const base = adminDb
    .collection(firestoreCollections.categories)
    .withConverter(adminCategoryConverter)
    .orderBy("name", "asc");

  const withParent = parentId ? base.where("parentId", "==", parentId) : base;
  const snapshot = await withParent.limit(limit).get();
  const categories = snapshot.docs.map((d) => d.data());

  return NextResponse.json(categories, { status: 200 });
}

/**
 * Pipeline-based search for the GET /api/categories?q= endpoint.
 *
 * Searches by name OR slug using case-insensitive regex matching, with an
 * optional parentId filter. Uses the client SDK pipeline API
 * (firebase/firestore/pipelines) via a server-only Firestore instance since
 * firebase-admin/firestore does not expose the pipeline API.
 */
async function searchByQuery(
  q: string,
  parentId: string | undefined,
  limit: number,
): Promise<Category[]> {
  const regex = escapeRegex(q.toLowerCase());

  const pipelineFilters: BooleanExpression[] = [
    or(
      field("name").toLower().regexMatch(regex),
      field("slug").toLower().regexMatch(regex),
    ),
  ];

  if (parentId) {
    pipelineFilters.push(field("parentId").equal(parentId));
  }

  let pipeline = searchDb.pipeline().collection(firestoreCollections.categories);
  pipeline = pipeline.where(combineWithAnd(pipelineFilters)).limit(limit);

  const snapshot = await execute(pipeline);
  return mapSearchSnapshot(snapshot);
}

function mapSearchSnapshot(snapshot: PipelineSnapshot): Category[] {
  return snapshot.results.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    const raw = data ?? {};
    return validateCategory({
      ...raw,
      id: (raw.id as string | undefined) ?? entry.id ?? "",
    });
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function combineWithAnd(conditions: BooleanExpression[]): BooleanExpression {
  if (conditions.length === 0) {
    throw new Error("At least one pipeline condition is required.");
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  const [first, second, ...rest] = conditions;
  return and(first, second, ...rest);
}
