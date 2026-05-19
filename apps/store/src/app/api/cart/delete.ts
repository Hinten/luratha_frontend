import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { authErrorResponse, requireUser } from "@/src/lib/auth/requireUser";
import { createCartsRepository } from "@/src/lib/repositories/cartsRepository";

export const runtime = "nodejs";

/**
 * DELETE /api/cart
 *
 * Wipes the authenticated user's cart (cart doc + all items). Idempotent —
 * always returns 204 regardless of whether a cart existed.
 */
export async function DELETE() {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const repository = createCartsRepository(adminDb);
  await repository.clear(authedUser.uid);
  return new NextResponse(null, { status: 204 });
}
