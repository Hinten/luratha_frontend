/**
 * Teste de integração real contra o sandbox do Melhor Envio.
 *
 * Diferente de `melhorEnvio.test.ts` (unit, com `fetch` mockado), aqui o
 * provider chama de fato `sandbox.melhorenvio.com.br`. Gateado por
 * `describeMelhorEnvio` — pula quando `MELHOR_ENVIO_TOKEN` está ausente, então
 * não quebra dev local nem PRs sem o secret configurado.
 *
 * Requer no ambiente: `MELHOR_ENVIO_TOKEN` e (opcionais) `MELHOR_ENVIO_ENV`,
 * `MELHOR_ENVIO_USER_AGENT`.
 */

import { expect, it } from "vitest";
import { melhorEnvioProvider } from "@/src/lib/shipping/melhorEnvio";
import { getDefaultSiteSettings } from "@luratha/schemas";
import { describeMelhorEnvio } from "@/src/test/cloud/sharedSetup";

describeMelhorEnvio("melhorEnvioProvider — sandbox real", () => {
  it("calcula cotações para um par de CEPs válido", async () => {
    // `enabledServices: []` desliga o filtro pós-resposta: qualquer serviço que
    // o sandbox devolver é aceito, mantendo o teste estável caso os ids mudem.
    const settings = {
      ...getDefaultSiteSettings().shipping,
      enabledServices: [],
    };

    const quotes = await melhorEnvioProvider.calculate(
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
