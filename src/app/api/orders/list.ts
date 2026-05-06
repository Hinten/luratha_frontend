import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminOrderConverter } from "@/src/lib/firestore/adminOrderConverter";
import { firestoreCollections } from "@/src/schemas/firestore";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

const ALLOWED_STATUSES = new Set([
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

/**
 * GET /api/orders
 *
 * Lists orders. The `userId` query parameter is required while route-level
 * authentication is not in place (added by the middleware in PR 6). Once
 * authenticated requests are available, `userId` will be derived from the
 * session and the query param will become an admin-only override.
 *
 * Query parameters:
 *   - `userId` — required for now; filters orders by owner
 *   - `status` — optional Order["status"] filter
 *   - `limit`  — max results (default 24, max 100)
 *
 * Returns 400 if `userId` is missing, 200 with the orders array otherwise.
 * Orders are returned newest-first (`createdAt` desc).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json(
      { message: "Parâmetro 'userId' é obrigatório." },
      { status: 400 },
    );
  }

  const status = url.searchParams.get("status")?.trim() || undefined;
  if (status && !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { message: `Status '${status}' inválido.` },
      { status: 400 },
    );
  }

  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT, MAX_LIMIT),
  );

  const base = adminDb
    .collection(firestoreCollections.orders)
    .withConverter(adminOrderConverter)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc");

  const finalQuery = status ? base.where("status", "==", status).limit(limit) : base.limit(limit);

  const snapshot = await finalQuery.get();
  const orders = snapshot.docs.map((d) => d.data());

  return NextResponse.json(orders, { status: 200 });
}
