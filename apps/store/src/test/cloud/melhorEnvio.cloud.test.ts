/**
 * Teste de integração real contra o sandbox do Melhor Envio.
 *
 * Diferente de `melhorEnvio.test.ts` (unit, com `fetch` mockado), aqui o
 * provider chama de fato `sandbox.melhorenvio.com.br`. Gateado por
 * `describeMelhorEnvio` — pula quando `MELHOR_ENVIO_TOKEN` está ausente, então
 * não quebra dev local nem PRs sem o secret configurado.
 *
 * O sandbox é instável (rate-limit, indisponibilidade, bloqueio de borda). Para
 * não falhar por ruído transitório, a chamada faz retry com backoff exponencial
 * em erros de ambiente (rede/timeout/5xx e HTTP 401/403/407/408/429). Se ainda
 * assim não responder, a suíte FALHA — um token expirado/inválido deve ser
 * visível e corrigido, não mascarado. Já um 4xx de request malformado (ex.: 422)
 * falha de imediato, sem retry, pois indica regressão no adapter.
 *
 * Requer no ambiente: `MELHOR_ENVIO_TOKEN` e (opcionais) `MELHOR_ENVIO_ENV`,
 * `MELHOR_ENVIO_USER_AGENT`.
 */

import { expect, it } from "vitest";
import { melhorEnvioProvider } from "@/src/lib/shipping/melhorEnvio";
import { ShippingProviderError } from "@/src/lib/shipping/types";
import type { CalculateShippingInput, ShippingQuote } from "@/src/lib/shipping/types";
import { getDefaultSiteSettings, type ShippingSettings } from "@luratha/schemas";
import { describeMelhorEnvio } from "@/src/test/cloud/sharedSetup";

/** Delays (ms) antes de cada nova tentativa. O comprimento define o nº de retries. */
const BACKOFF_MS = [2_000, 4_000, 8_000] as const;

/**
 * Distingue uma falha de ambiente (sandbox fora do ar, token expirado/rejeitado,
 * rate-limit) — que merece retry — de um bug nosso (request malformado), que deve
 * falhar de imediato sem retry.
 */
function isEnvironmentalProviderError(error: unknown): boolean {
  if (!(error instanceof ShippingProviderError)) return false;
  if (error.code === "provider_unavailable") return true; // rede/timeout/5xx
  const status = error.httpStatus;
  return (
    status === 401 || // não autenticado
    status === 403 || // token rejeitado / bloqueio WAF/IP
    status === 407 ||
    status === 408 ||
    status === 429 // rate limit
  );
}

/**
 * Chama `calculate` com retry + backoff exponencial em erros de ambiente.
 * Re-lança imediatamente erros não-transitórios (bug nosso) e propaga o último
 * erro quando os retries se esgotam (a suíte fica vermelha).
 */
async function calculateWithBackoff(
  input: CalculateShippingInput,
  settings: ShippingSettings,
): Promise<ShippingQuote[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      return await melhorEnvioProvider.calculate(input, settings);
    } catch (error) {
      if (!isEnvironmentalProviderError(error)) {
        throw error; // request malformado / bug do adapter → falha rápido
      }
      lastError = error;
      const backoff = BACKOFF_MS[attempt];
      if (backoff === undefined) break; // esgotou as tentativas
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}

describeMelhorEnvio("melhorEnvioProvider — sandbox real", () => {
  it("calcula cotações para um par de CEPs válido", async () => {
    // `enabledServices: []` desliga o filtro pós-resposta: qualquer serviço que
    // o sandbox devolver é aceito, mantendo o teste estável caso os ids mudem.
    const settings = {
      ...getDefaultSiteSettings().shipping,
      enabledServices: [],
    };

    const quotes = await calculateWithBackoff(
      {
        originPostalCode: "01310-100",
        destinationPostalCode: "20040-002",
        items: [
          {
            productId: "cloud-test-item",
            quantity: 1,
            weightKg: 0.5,
            lengthCm: 20,
            widthCm: 15,
            heightCm: 5,
            unitPrice: 100,
          },
        ],
      },
      settings,
    );

    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBeGreaterThan(0);

    for (const quote of quotes) {
      expect(quote.providerId).toBe("melhor-envio");
      expect(typeof quote.serviceCode).toBe("string");
      expect(quote.serviceCode.length).toBeGreaterThan(0);
      expect(typeof quote.carrier).toBe("string");
      expect(typeof quote.service).toBe("string");
      expect(quote.price).toBeGreaterThan(0);
      expect(Number.isFinite(quote.estimatedDays)).toBe(true);
    }

    // `calculate` ordena por preço crescente — a primeira é a mais barata.
    const prices = quotes.map((q) => q.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
});
