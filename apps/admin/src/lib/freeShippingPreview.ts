import type { FreeShippingConfig } from "@luratha/schemas";

export type FreeShippingPreview =
  | { kind: "disabled" }
  | { kind: "invalid" }
  | { kind: "over-cap" }
  | { kind: "threshold"; value: number; flooredByMin: boolean };

/**
 * Reimplementação display-only de `calculateFreeShippingThreshold`
 * (`apps/store/src/lib/shipping/freeShipping.ts`) — usada para a prévia ao vivo
 * no editor de configurações do admin.
 *
 * O cálculo autoritativo continua no store; esta cópia precisa ser mantida em
 * sincronia. Um futuro pacote `@luratha/shipping` unificaria as duas.
 *
 * Fórmula: `raw = custo1kg / divisor`; `clamped = max(raw, minThreshold)`;
 * se `maxThreshold` não for nulo e `clamped` ultrapassá-lo, o frete grátis não
 * é oferecido na região.
 */
export function previewFreeShippingThreshold(
  shippingCost1kg: number,
  config: Pick<FreeShippingConfig, "divisor" | "minThreshold" | "maxThreshold" | "enabled">,
): FreeShippingPreview {
  if (!config.enabled) return { kind: "disabled" };
  if (!Number.isFinite(shippingCost1kg) || shippingCost1kg <= 0) {
    return { kind: "invalid" };
  }
  if (config.divisor <= 0) return { kind: "invalid" };

  const raw = shippingCost1kg / config.divisor;
  const clamped = Math.max(raw, config.minThreshold);

  if (config.maxThreshold !== null && clamped > config.maxThreshold) {
    return { kind: "over-cap" };
  }

  return {
    kind: "threshold",
    value: Math.round(clamped * 100) / 100,
    flooredByMin: clamped > raw,
  };
}
