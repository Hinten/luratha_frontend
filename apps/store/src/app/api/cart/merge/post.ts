import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import {
  CartRepositoryError,
  cartItemInputSchema,
  createCartsRepository,
} from "@luratha/repositories/cartsRepository";
import { resolveCartAvailability } from "@/src/services/cartAvailability";

export const runtime = "nodejs";

const mergePayloadSchema = z.object({
  /**
   * Token UUID gerado no client (uma vez por "sessão de guest cart"). Permite
   * que o repository deduplique chamadas concorrentes/retries — o cliente
   * pode mandar o mesmo payload N vezes sem multiplicar quantidades.
   */
  mergeToken: z.uuid(),
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

  // Soft gate de estoque/catálogo em bulk (mesma fonte do /api/cart/validate):
  // dropa itens inválidos/esgotados (com `reason`) e capa a quantidade no
  // disponível. A checagem autoritativa, com decremento, é no POST /api/orders.
  const { accepted, dropped } = await resolveCartAvailability(adminDb, parsed.items);
  const acceptedWrites = accepted.map((entry) => entry.write);

  const repository = createCartsRepository(adminDb);
  try {
    const snapshot = await repository.mergeItems(authedUser.uid, acceptedWrites, parsed.mergeToken);
    return NextResponse.json({ ...snapshot, dropped }, { status: 200 });
  } catch (error) {
    if (error instanceof CartRepositoryError) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    throw error;
  }
}
