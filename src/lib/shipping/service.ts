import "server-only";

import { getSiteSettings } from "@/src/lib/repositories/siteSettingsRepository";
import {
  calculateFreeShippingThreshold,
  pickReferenceShippingCost,
} from "@/src/lib/shipping/freeShipping";
import {
  buildOneKgReferenceItem,
  normalizeShippingItems,
  type RawShippingItem,
} from "@/src/lib/shipping/itemNormalizer";
import { getFallbackProvider, getShippingProvider } from "@/src/lib/shipping/provider";
import {
  ShippingProviderError,
  type CalculateShippingInput,
  type ShippingQuote,
} from "@/src/lib/shipping/types";
import { buildCacheKey, getCachedQuotes, setCachedQuotes } from "@/src/lib/shipping/cache";
import { normalizePostalCode, type ShippingSettings } from "@/src/schemas/firestore";

export interface QuoteShippingInput {
  destinationPostalCode: string;
  items: RawShippingItem[];
}

export interface QuoteShippingResult {
  quotes: ShippingQuote[];
  freeShippingThreshold: number | null;
  /** Quote de referência usada para o cálculo de frete grátis (1kg). */
  referenceShippingCost: number | null;
  /** ID do provider que efetivamente respondeu (pode ser o fallback). */
  resolvedProviderId: ShippingQuote["providerId"] | null;
  /** true quando caímos no fallback porque o provider configurado falhou. */
  usedFallback: boolean;
}

async function callProvider(
  providerInput: CalculateShippingInput,
  settings: ShippingSettings,
): Promise<{ quotes: ShippingQuote[]; usedFallback: boolean }> {
  const primary = getShippingProvider(settings.providerId);
  try {
    const quotes = await primary.calculate(providerInput, settings);
    return { quotes, usedFallback: false };
  } catch (error) {
    if (
      error instanceof ShippingProviderError &&
      (error.code === "provider_unavailable" || error.code === "config_missing")
    ) {
      const fallback = getFallbackProvider();
      if (fallback.id !== primary.id) {
        const quotes = await fallback.calculate(providerInput, settings);
        return { quotes, usedFallback: true };
      }
    }
    throw error;
  }
}

/**
 * Calcula opções de frete reais (com pesos somados dos itens) + o threshold
 * de frete grátis para aquele CEP (sempre baseado em 1kg).
 *
 * Resultado é cacheado por (CEP + assinatura do carrinho) durante
 * `settings.cacheTtlSeconds` (default 1h).
 */
export async function quoteShipping(input: QuoteShippingInput): Promise<QuoteShippingResult> {
  const siteSettings = await getSiteSettings();
  const shippingSettings = siteSettings.shipping;
  const destinationPostalCode = normalizePostalCode(input.destinationPostalCode);
  const originPostalCode = normalizePostalCode(shippingSettings.originPostalCode);
  const normalizedItems = normalizeShippingItems(input.items, shippingSettings);

  const cacheKey = buildCacheKey({
    type: "quote",
    providerId: shippingSettings.providerId,
    destinationPostalCode,
    items: normalizedItems.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      weightKg: i.weightKg,
      unitPrice: i.unitPrice,
      lengthCm: i.lengthCm,
      widthCm: i.widthCm,
      heightCm: i.heightCm,
    })),
  });

  const cached = getCachedQuotes(cacheKey);
  if (cached) {
    const freeShippingResult = await computeFreeShippingThreshold({
      destinationPostalCode,
      settings: shippingSettings,
      originPostalCode,
    });
    return {
      quotes: cached,
      freeShippingThreshold: freeShippingResult.threshold,
      referenceShippingCost: freeShippingResult.referenceShippingCost,
      resolvedProviderId: cached[0]?.providerId ?? null,
      usedFallback: false,
    };
  }

  const { quotes, usedFallback } = await callProvider(
    {
      destinationPostalCode,
      originPostalCode,
      items: normalizedItems,
    },
    shippingSettings,
  );

  setCachedQuotes(cacheKey, quotes, shippingSettings.cacheTtlSeconds);

  const freeShippingResult = await computeFreeShippingThreshold({
    destinationPostalCode,
    settings: shippingSettings,
    originPostalCode,
  });

  return {
    quotes,
    freeShippingThreshold: freeShippingResult.threshold,
    referenceShippingCost: freeShippingResult.referenceShippingCost,
    resolvedProviderId: quotes[0]?.providerId ?? shippingSettings.providerId,
    usedFallback,
  };
}

/**
 * Calcula apenas o threshold de frete grátis (usado em PDP/cart sem precisar
 * do carrinho completo). Sempre simula 1kg, cacheia separadamente do carrinho.
 */
export async function quoteFreeShippingThreshold(input: {
  destinationPostalCode: string;
}): Promise<{
  destinationPostalCode: string;
  threshold: number | null;
  referenceShippingCost: number | null;
  divisor: number;
  enabled: boolean;
}> {
  const siteSettings = await getSiteSettings();
  const shippingSettings = siteSettings.shipping;
  const destinationPostalCode = normalizePostalCode(input.destinationPostalCode);
  const originPostalCode = normalizePostalCode(shippingSettings.originPostalCode);

  const result = await computeFreeShippingThreshold({
    destinationPostalCode,
    settings: shippingSettings,
    originPostalCode,
  });

  return {
    destinationPostalCode,
    threshold: result.threshold,
    referenceShippingCost: result.referenceShippingCost,
    divisor: shippingSettings.freeShipping.divisor,
    enabled: shippingSettings.freeShipping.enabled,
  };
}

async function computeFreeShippingThreshold(params: {
  destinationPostalCode: string;
  originPostalCode: string;
  settings: ShippingSettings;
}): Promise<{ threshold: number | null; referenceShippingCost: number | null }> {
  const { destinationPostalCode, originPostalCode, settings } = params;
  if (!settings.freeShipping.enabled) {
    return { threshold: null, referenceShippingCost: null };
  }

  const cacheKey = buildCacheKey({
    type: "freeShipping",
    providerId: settings.providerId,
    destinationPostalCode,
  });

  let referenceQuotes = getCachedQuotes(cacheKey);
  if (!referenceQuotes) {
    try {
      const result = await callProvider(
        {
          destinationPostalCode,
          originPostalCode,
          items: [buildOneKgReferenceItem(settings)],
        },
        settings,
      );
      referenceQuotes = result.quotes;
      setCachedQuotes(cacheKey, referenceQuotes, settings.cacheTtlSeconds);
    } catch (err) {
      if (err instanceof ShippingProviderError) {
        // Simulação de 1kg é best-effort — falha do provider faz o threshold
        // ficar null e o caller esconde a oferta de frete grátis para esse CEP.
        return { threshold: null, referenceShippingCost: null };
      }
      throw err;
    }
  }

  const referenceShippingCost = pickReferenceShippingCost(referenceQuotes);
  if (referenceShippingCost <= 0) {
    return { threshold: null, referenceShippingCost: null };
  }

  const threshold = calculateFreeShippingThreshold(referenceShippingCost, settings.freeShipping);
  return { threshold, referenceShippingCost };
}
