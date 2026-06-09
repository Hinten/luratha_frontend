import { NextResponse } from "next/server";
import {
  and,
  execute,
  field,
  or,
  type BooleanExpression,
  type PipelineSnapshot,
} from "firebase/firestore/pipelines";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { searchDb } from "@luratha/firestore/firebaseSearchDb";
import { firestoreCollections, validateProduct } from "@luratha/schemas";
import type { Product } from "@luratha/schemas";
import { VectorValue } from "firebase/firestore";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/**
 * GET /api/products
 *
 * Lists or searches products.
 *
 * Query parameters:
 *   - `q`          — Full-text search term (title or SKU). When provided, uses
 *                    the Firestore Pipeline API for regex matching.
 *   - `status`     — Filter by product status (e.g. "active", "archived")
 *   - `categoryId` — Filter by category ID
 *   - `limit`      — Max results to return (default 24, max 100)
 *
 * Returns 200 with an array of products.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const q = url.searchParams.get("q")?.trim() || undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT, MAX_LIMIT),
  );

  if (q) {
    const products = await searchByQuery(q, status, categoryId, limit);
    return NextResponse.json(products, { status: 200 });
  }

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

/**
 * Pipeline-based search for the admin GET /api/products?q= endpoint.
 *
 * Searches by title OR sku using case-insensitive regex matching, with
 * optional status and categoryId filters. Uses the client SDK pipeline API
 * (firebase/firestore/pipelines) via a server-only Firestore instance since
 * firebase-admin/firestore does not expose the pipeline API.
 */
async function searchByQuery(
  q: string,
  status: string | undefined,
  categoryId: string | undefined,
  limit: number,
): Promise<Product[]> {
  const regex = escapeRegex(q.toLowerCase());

  const pipelineFilters: BooleanExpression[] = [
    or(field("title").toLower().regexMatch(regex), field("sku").toLower().regexMatch(regex)),
  ];

  if (status) {
    pipelineFilters.push(field("status").equal(status));
  }
  if (categoryId) {
    pipelineFilters.push(field("categoryId").equal(categoryId));
  }

  let pipeline = searchDb.pipeline().collection(firestoreCollections.products);
  pipeline = pipeline.where(combineWithAnd(pipelineFilters)).limit(limit);

  const snapshot = await execute(pipeline);
  return mapSearchSnapshot(snapshot);
}

function mapSearchSnapshot(snapshot: PipelineSnapshot): Product[] {
  return snapshot.results.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    const raw = data ?? {};
    return validateProduct({
      ...raw,
      id: (raw.id as string | undefined) ?? entry.id ?? "",
      vectorEmbedding:
        raw.vectorEmbedding instanceof VectorValue
          ? raw.vectorEmbedding.toArray()
          : raw.vectorEmbedding,
      searchEmbedding:
        raw.searchEmbedding instanceof VectorValue
          ? raw.searchEmbedding.toArray()
          : raw.searchEmbedding,
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
