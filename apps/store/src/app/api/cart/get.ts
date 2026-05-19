import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { authErrorResponse, requireUser } from "@/src/lib/auth/requireUser";
import { createCartsRepository } from "@/src/lib/repositories/cartsRepository";

export const runtime = "nodejs";

/**
 * GET /api/cart
 *
 * Returns the authenticated user's cart with its items.
 * If the cart does not exist yet, returns an empty cart shape.
 */
export async function GET() {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const repository = createCartsRepository(adminDb);
  const snapshot = await repository.getCart(authedUser.uid);
  return NextResponse.json(snapshot, { status: 200 });
}
