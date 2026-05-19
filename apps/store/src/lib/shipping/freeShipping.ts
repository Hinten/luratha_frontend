import type { FreeShippingConfig } from "@luratha/schemas";
import type { ShippingQuote } from "@/src/lib/shipping/types";

/**
 * Calcula o threshold (valor mínimo de subtotal) para liberar frete grátis
 * naquele CEP, baseado no custo de frete simulado para 1kg.
 *
 * Fórmula: `threshold = shippingCost1kg / config.divisor`
 * (clamp por `minThreshold` e `maxThreshold`).
 *
 * Retorna `null` quando:
 *  - `config.enabled === false`
 *  - `shippingCost1kg <= 0` (provider devolveu valor inválido)
 *  - threshold calculado excede o teto `maxThreshold` (frete tão caro que a
 *    loja não consegue absorver)
 */
export function calculateFreeShippingThreshold(
  shippingCost1kg: number,
  config: FreeShippingConfig,
): number | null {
  if (!config.enabled) return null;
  if (!Number.isFinite(shippingCost1kg) || shippingCost1kg <= 0) return null;
  if (config.divisor <= 0) return null;

  const raw = shippingCost1kg / config.divisor;
  const clamped = Math.max(raw, config.minThreshold);

  if (config.maxThreshold !== null && clamped > config.maxThreshold) {
    return null;
  }

  return roundToCents(clamped);
}

/**
 * Escolhe a quote mais barata de 1kg dentre as opções disponíveis.
 * Retorna 0 quando não houver nenhuma quote (caller deve tratar como
 * "não foi possível calcular frete grátis").
 */
export function pickReferenceShippingCost(quotes: ShippingQuote[]): number {
  if (quotes.length === 0) return 0;
  return quotes.reduce((min, q) => (q.price < min ? q.price : min), quotes[0].price);
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
