import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { buildCartItemId } from "@luratha/schemas";
import { cartItemInputSchema } from "@luratha/repositories/cartsRepository";
import { resolveCartAvailability, type CartItemDropReason } from "@/src/services/cartAvailability";

export const runtime = "nodejs";

/**
 * POST /api/cart/validate
 *
 * Revalida em **bulk** a disponibilidade dos itens do carrinho contra o
 * catálogo + estoque atuais, numa única leva de leitura. Read-only: NÃO
 * escreve no carrinho nem reserva estoque — devolve os `adjustments` que o
 * cliente aplica (cap de quantidade / remoção de esgotado) e exibe num banner.
 *
 * Não exige autenticação: serve tanto o carrinho de guest (localStorage)
 * quanto o logado, recebendo a lista de itens no body. A barreira autoritativa
 * (com decremento transacional) continua no `POST /api/orders`.
 */

const payloadSchema = z.object({
  items: z.array(cartItemInputSchema).max(50),
});

/** `cap`: quantidade reduzida ao disponível. `drop`: item saiu (sem estoque/inválido). */
export interface CartAdjustment {
  /** ID do item no carrinho (`buildCartItemId`) — o cliente usa pra aplicar. */
  itemId: string;
  productId: string;
  variantId?: string;
  name: string;
  action: "cap" | "drop";
  reason: CartItemDropReason | "stock_capped";
  /** Disponível atual (qty alvo no cap; 0 no drop por esgotamento). */
  availableQty: number;
}

export async function POST(request: Request) {
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
    parsed = payloadSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload de validação inválido.", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Falha ao validar carrinho." }, { status: 400 });
  }

  if (parsed.items.length === 0) {
    return NextResponse.json({ adjustments: [] }, { status: 200 });
  }

  // Nome do item vem do snapshot enviado pelo cliente (já presente no carrinho);
  // chaveado por itemId pra reanexar aos ajustes resolvidos pelo servidor.
  const nameByItemId = new Map<string, string>();
  for (const item of parsed.items) {
    nameByItemId.set(buildCartItemId(item.productId, item.variantId), item.name);
  }

  const { accepted, dropped } = await resolveCartAvailability(adminDb, parsed.items);

  const adjustments: CartAdjustment[] = [];
  for (const drop of dropped) {
    const itemId = buildCartItemId(drop.productId, drop.variantId);
    adjustments.push({
      itemId,
      productId: drop.productId,
      variantId: drop.variantId,
      name: nameByItemId.get(itemId) ?? drop.productId,
      action: "drop",
      reason: drop.reason,
      availableQty: 0,
    });
  }
  for (const entry of accepted) {
    if (!entry.capped) continue;
    const { productId, variantId } = entry.write;
    const itemId = buildCartItemId(productId, variantId);
    adjustments.push({
      itemId,
      productId,
      variantId,
      name: nameByItemId.get(itemId) ?? productId,
      action: "cap",
      reason: "stock_capped",
      availableQty: entry.availableQty,
    });
  }

  return NextResponse.json({ adjustments }, { status: 200 });
}
