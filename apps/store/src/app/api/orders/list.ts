import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { firestoreCollections } from "@luratha/schemas";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";

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
  // Fail-safe de pagamento desconhecido — ops precisa filtrar `?status=unknown`
  // pra enumerar os pedidos travados pra revisão manual.
  "unknown",
]);

/**
 * GET /api/orders
 *
 * Lista pedidos. Sem `userId`, retorna os pedidos do usuário autenticado.
 * Com `userId` diferente do uid da sessão, exige claim admin.
 *
 * Query parameters:
 *   - `userId` — opcional; default = uid da sessão
 *   - `status` — opcional Order["status"] filter
 *   - `limit`  — max results (default 24, max 100)
 */
export async function GET(request: Request) {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId")?.trim();
  const userId = requestedUserId || authedUser.uid;

  if (userId !== authedUser.uid && !authedUser.isAdmin) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
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
