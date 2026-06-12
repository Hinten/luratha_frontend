import type { Coupon } from "@luratha/schemas";

/**
 * Avaliação pura de cupom contra um total de carrinho. Compartilhada por:
 *  - `POST /api/coupons/validate` — pré-validação no step de revisão;
 *  - `POST /api/orders` — re-validação autoritativa na criação do pedido
 *    (o desconto enviado pelo cliente deve bater com o recomputado aqui).
 *
 * `cartTotal` é `subtotal + shippingTotal` — a mesma base que o `CouponField`
 * usa no checkout (`CheckoutFlow.tsx`). Mudar a base num consumidor sem o
 * outro quebra o `discount_mismatch` do pedido.
 */

export type CouponValidationResult =
  | { valid: true; code: string; type: Coupon["type"]; discount: number }
  | { valid: false; reason: string };

export function computeDiscount(coupon: Coupon, cartTotal: number): number {
  const raw = coupon.type === "percentage" ? (cartTotal * coupon.amount) / 100 : coupon.amount;
  const capped =
    typeof coupon.maxDiscountAmount === "number" ? Math.min(raw, coupon.maxDiscountAmount) : raw;
  // Nunca descontar mais do que o próprio carrinho.
  return Math.min(capped, cartTotal);
}

export function evaluateCoupon(coupon: Coupon, cartTotal: number): CouponValidationResult {
  if (!coupon.active) {
    return { valid: false, reason: "Cupom inativo." };
  }

  const now = Date.now();
  const startsAt = new Date(coupon.startsAt).getTime();
  const expiresAt = new Date(coupon.expiresAt).getTime();

  if (Number.isFinite(startsAt) && now < startsAt) {
    return { valid: false, reason: "Cupom ainda não disponível." };
  }
  if (Number.isFinite(expiresAt) && now > expiresAt) {
    return { valid: false, reason: "Cupom expirado." };
  }

  if (typeof coupon.usageLimit === "number" && coupon.usageCount >= coupon.usageLimit) {
    return { valid: false, reason: "Cupom esgotado." };
  }

  if (cartTotal < coupon.minimumOrderAmount) {
    return {
      valid: false,
      reason: `Pedido abaixo do mínimo de R$ ${coupon.minimumOrderAmount.toFixed(2)}.`,
    };
  }

  const discount = computeDiscount(coupon, cartTotal);
  if (discount <= 0) {
    return { valid: false, reason: "Cupom não aplicável a este pedido." };
  }

  return {
    valid: true,
    code: coupon.code,
    type: coupon.type,
    discount: Number(discount.toFixed(2)),
  };
}
