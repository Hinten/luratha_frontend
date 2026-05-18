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
    // Só falhas recuperáveis do primário acionam o fallback; o resto propaga.
    if (
      !(error instanceof ShippingProviderError) ||
      (error.code !== "provider_unavailable" && error.code !== "config_missing")
    ) {
      throw error;
    }

    const fallback = getFallbackProvider();
    if (!settings.fixedRate.enabledAsFallback || fallback.id === primary.id) {
      throw error;
    }

    // O fallback também pode estar indisponível — checar e surfacer um erro
    // coerente citando as duas falhas, em vez de deixar vazar o erro cru.
    let fallbackQuotes: ShippingQuote[];
    try {
      fallbackQuotes = await fallback.calculate(providerInput, settings);
    } catch (fallbackError) {
      if (fallbackError instanceof ShippingProviderError) {
        throw new ShippingProviderError(
          `Provider primário (${primary.id}) e fallback (${fallback.id}) indisponíveis. ` +
            `Primário: ${error.message} | Fallback: ${fallbackError.message}`,
          fallback.id,
          "provider_unavailable",
          error,
        );
      }
      throw fallbackError;
    }

    if (fallbackQuotes.length === 0) {
      throw new ShippingProviderError(
        `Provider primário (${primary.id}) falhou e o fallback (${fallback.id}) não ` +
          `retornou nenhuma opção de frete. Primário: ${error.message}`,
        fallback.id,
        "provider_unavailable",
        error,
      );
    }

    return { quotes: fallbackQuotes, usedFallback: true };
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
 * Calcula o threshold de frete grátis + as opções de frete de 1kg (usado em
 * PDP/cart sem o carrinho completo). Sempre simula 1kg; as `quotes` servem como
 * estimativa "frete a partir de" para exibir ao cliente.
 */
export async function quoteFreeShippingThreshold(input: {
  destinationPostalCode: string;
}): Promise<{
  destinationPostalCode: string;
  quotes: ShippingQuote[];
  threshold: number | null;
  referenceShippingCost: number | null;
  divisor: number;
  enabled: boolean;
}> {
  
  const siteSettings = await getSiteSettings();
  const shippingSettings = siteSettings.shipping;
  const destinationPostalCode = normalizePostalCode(input.destinationPostalCode);
  const originPostalCode = normalizePostalCode(shippingSettings.originPostalCode);

  const quotes = await getReferenceQuotes(
    destinationPostalCode,
    originPostalCode,
    shippingSettings,
  );
  const cheapest = pickReferenceShippingCost(quotes);
  const referenceShippingCost = cheapest > 0 ? cheapest : null;
  const threshold =
    shippingSettings.freeShipping.enabled && referenceShippingCost !== null
      ? calculateFreeShippingThreshold(referenceShippingCost, shippingSettings.freeShipping)
      : null;

  return {
    destinationPostalCode,
    quotes,
    threshold,
    referenceShippingCost,
    divisor: shippingSettings.freeShipping.divisor,
    enabled: shippingSettings.freeShipping.enabled,
  };
}

/**
 * Simula o frete de 1kg para um CEP (com cache próprio). Best-effort: em falha
 * do provider devolve `[]` — quem chama trata frete grátis/opções como
 * indisponíveis para aquele CEP em vez de propagar erro.
 */
async function getReferenceQuotes(
  destinationPostalCode: string,
  originPostalCode: string,
  settings: ShippingSettings,
): Promise<ShippingQuote[]> {
  const cacheKey = buildCacheKey({
    type: "freeShipping",
    providerId: settings.providerId,
    destinationPostalCode,
  });

  const cached = getCachedQuotes(cacheKey);
  if (cached) return cached;

  try {
    const { quotes } = await callProvider(
      {
        destinationPostalCode,
        originPostalCode,
        items: [buildOneKgReferenceItem(settings)],
      },
      settings,
    );
    setCachedQuotes(cacheKey, quotes, settings.cacheTtlSeconds);
    return quotes;
  } catch (err) {
    if (err instanceof ShippingProviderError) {
      return [];
    }
    throw err;
  }
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

  const referenceQuotes = await getReferenceQuotes(
    destinationPostalCode,
    originPostalCode,
    settings,
  );
  const referenceShippingCost = pickReferenceShippingCost(referenceQuotes);
  if (referenceShippingCost <= 0) {
    return { threshold: null, referenceShippingCost: null };
  }

  const threshold = calculateFreeShippingThreshold(referenceShippingCost, settings.freeShipping);
  return { threshold, referenceShippingCost };
}
