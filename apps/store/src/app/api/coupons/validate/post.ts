import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCouponConverter } from "@luratha/firestore/adminCouponConverter";
import { firestoreCollections } from "@luratha/schemas";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import { type CouponValidationResult, evaluateCoupon } from "@/src/lib/coupons/couponEvaluation";

export const runtime = "nodejs";

/**
 * POST /api/coupons/validate
 *
 * Valida um cupom contra o total do carrinho. Não persiste nada — o
 * `usageCount` é incrementado quando o `Order` é criado de fato em
 * `POST /api/orders` com o `couponCode` no corpo (que re-valida o cupom com
 * a mesma `evaluateCoupon` compartilhada em `src/lib/coupons/couponEvaluation.ts`).
 *
 * Body: { code: string, cartTotal: number }
 *
 * Sucesso (200): { valid: true, code, type, discount }
 *   `discount` já é o desconto efetivo em BRL (cap em cartTotal e em
 *   maxDiscountAmount se configurado).
 *
 * Falha de validação de regra de negócio (200): { valid: false, reason }
 *   200 e não 422 porque o cliente queria saber e a resposta é determinística;
 *   não há erro de servidor a tratar.
 *
 * Endpoint autenticado — usuários precisam estar logados para chegar ao
 * checkout. Reduz a superfície de enumeração de cupons.
 */

const bodySchema = z.object({
  code: z.string().trim().min(3).max(32),
  cartTotal: z.number().nonnegative().max(1_000_000),
});

export async function POST(request: Request) {
  try {
    await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Corpo da requisição inválido. Esperado JSON." },
        { status: 400 },
      );
    }
    throw err;
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos.", errors: parsed.error.issues },
      { status: 400 },
    );
  }

  const normalizedCode = parsed.data.code.toUpperCase();
  const snapshot = await adminDb
    .collection(firestoreCollections.coupons)
    .where("code", "==", normalizedCode)
    .limit(1)
    .withConverter(adminCouponConverter)
    .get();

  if (snapshot.empty) {
    return NextResponse.json(
      { valid: false, reason: "Cupom não encontrado." } satisfies CouponValidationResult,
      { status: 200 },
    );
  }

  const coupon = snapshot.docs[0].data();
  const result = evaluateCoupon(coupon, parsed.data.cartTotal);
  return NextResponse.json(result, { status: 200 });
}
