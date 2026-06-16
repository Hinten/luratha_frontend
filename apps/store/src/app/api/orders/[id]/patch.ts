import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import {
  PAYMENT_FAILURE_STATUSES,
  firestoreCollections,
  type Order,
  validateOrder,
} from "@luratha/schemas";
import { authErrorResponse, requireOwnerOrAdmin } from "@luratha/auth/requireUser";
import { releaseOrderStockInTx } from "@luratha/payments";

export const runtime = "nodejs";

/**
 * PATCH /api/orders/:id
 *
 * Partially updates an existing order. The PATCH semantics match the project
 * convention (see CLAUDE.md):
 *   - Field absent from the payload   → kept unchanged
 *   - Field present in payload as null → set to null
 *   - Field present with a value      → updated
 *
 * Authorization model:
 *   - **Admin**: full PATCH semantics (any field, merge as above).
 *   - **Owner (non-admin)**: the payload must be EXACTLY `{ status: "cancelled" }`
 *     — any other key is rejected with 403. The cancel is only allowed while
 *     the order is still `pending_payment` AND the payment hasn't progressed
 *     (paymentStatus `pending` or a failure status). Orders with a live
 *     PIX QR/boleto (`awaiting_*`) or an authorized/paid card are NOT
 *     user-cancellable — the money side must resolve first (expire/refund),
 *     otherwise a payment landing after the local cancel would desync.
 *
 * Cancelling an order whose stock was reserved (`stockMovement: "decremented"`)
 * releases the stock in the same transaction (`releaseOrderStockInTx`),
 * exactly once.
 *
 * Server-controlled (always preserved/overwritten):
 *   - `id`, `userId`, `createdAt` are taken from the stored document
 *   - `updatedAt` is set to the current timestamp
 *   - `stockMovement` is bookkeeping owned by the stock paths — stripped from
 *     non-admin payloads by the whitelist and from admin payloads explicitly
 *
 * Returns 404 if the order does not exist, 400 on validation failure, 403 on
 * authorization failure, 409 (`not_cancellable`) when the order state forbids
 * the user cancel, and 200 with the updated order on success.
 */

/** Estados de pagamento em que o dono ainda pode cancelar o pedido. */
const USER_CANCELLABLE_PAYMENT_STATUSES: readonly string[] = [
  "pending",
  ...PAYMENT_FAILURE_STATUSES,
];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { message: "Corpo da requisição deve ser um objeto JSON." },
      { status: 400 },
    );
  }

  const orderRef = adminDb
    .collection(firestoreCollections.orders)
    .doc(id)
    .withConverter(adminOrderConverter);

  const existing = await orderRef.get();
  if (!existing.exists) {
    return NextResponse.json({ message: `Pedido com id "${id}" não encontrado.` }, { status: 404 });
  }

  const existingData = existing.data()!;

  let authedUser;
  try {
    authedUser = await requireOwnerOrAdmin(existingData.userId);
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const payload = body as Record<string, unknown>;

  if (!authedUser.isAdmin) {
    // Whitelist estrita: o dono só pode cancelar. Qualquer outra chave
    // (items, totais, trackingCode, …) reescreveria o snapshot do pedido.
    const keys = Object.keys(payload);
    if (keys.length !== 1 || payload.status !== "cancelled") {
      return NextResponse.json(
        { message: "Usuário só pode alterar status para 'cancelled'." },
        { status: 403 },
      );
    }
    if (
      existingData.status !== "pending_payment" ||
      !USER_CANCELLABLE_PAYMENT_STATUSES.includes(existingData.paymentStatus)
    ) {
      return NextResponse.json(
        {
          message: "Este pedido não pode mais ser cancelado pelo cliente.",
          code: "not_cancellable",
        },
        { status: 409 },
      );
    }
  } else {
    // Bookkeeping de estoque pertence aos fluxos de criação/release — nem
    // admin escreve direto (um flip manual dessincronizaria o estoque).
    delete payload.stockMovement;
  }

  const now = new Date().toISOString();

  try {
    const order = await adminDb.runTransaction(async (tx) => {
      // Releitura autoritativa dentro da transação — o estado pode ter mudado
      // entre o GET de autorização e o commit (ex.: webhook concorrente).
      const snapshot = await tx.get(orderRef);
      if (!snapshot.exists) {
        throw new OrderPatchError(`Pedido com id "${id}" não encontrado.`, 404);
      }
      const current = snapshot.data() as Order;

      if (
        !authedUser.isAdmin &&
        (current.status !== "pending_payment" ||
          !USER_CANCELLABLE_PAYMENT_STATUSES.includes(current.paymentStatus))
      ) {
        throw new OrderPatchError(
          "Este pedido não pode mais ser cancelado pelo cliente.",
          409,
          "not_cancellable",
        );
      }

      const merged: Record<string, unknown> = {
        ...current,
        ...payload,
        id,
        userId: current.userId,
        createdAt: current.createdAt,
        updatedAt: now,
      };

      let next: Order;
      try {
        next = validateOrder(merged);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new OrderPatchError("Dados do pedido inválidos.", 400, undefined, error.issues);
        }
        throw error;
      }

      const becomingCancelled = next.status === "cancelled" && current.status !== "cancelled";
      if (becomingCancelled && current.stockMovement === "decremented") {
        // Lê stocks/produtos e escreve a devolução dentro DESTA transação;
        // retorna o pedido já com `stockMovement: "released"`.
        next = await releaseOrderStockInTx(tx, next);
      }

      tx.set(orderRef, next);
      return next;
    });

    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    if (error instanceof OrderPatchError) {
      return NextResponse.json(
        {
          message: error.message,
          ...(error.code ? { code: error.code } : {}),
          ...(error.issues ? { errors: error.issues } : {}),
        },
        { status: error.status },
      );
    }
    throw error;
  }
}

/** Erro de fluxo lançado de dentro da transação → resposta HTTP mapeada. */
class OrderPatchError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly issues?: unknown;

  constructor(message: string, status: number, code?: string, issues?: unknown) {
    super(message);
    this.name = "OrderPatchError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}
