import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { melhorEnvioProvider } from "@/src/lib/shipping/melhorEnvio";
import { ShippingProviderError } from "@/src/lib/shipping/types";
import { getDefaultSiteSettings } from "@luratha/schemas";

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ENV = { ...process.env };

function mockFetchOnce(body: unknown, init: { status?: number } = {}) {
  return vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  process.env.MELHOR_ENVIO_TOKEN = "test-token";
  process.env.MELHOR_ENVIO_ENV = "sandbox";
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("melhorEnvioProvider.calculate", () => {
  it("maps API response to ShippingQuote and filters by enabledServices", async () => {
    const settings = getDefaultSiteSettings().shipping;
    global.fetch = mockFetchOnce([
      {
        id: 1,
        name: "PAC",
        price: "25.00",
        delivery_time: 7,
        company: { id: 1, name: "Correios" },
      },
      {
        id: 2,
        name: "SEDEX",
        price: "45.00",
        delivery_time: 3,
        company: { id: 1, name: "Correios" },
      },
      {
        id: 99,
        name: "OutroServico",
        price: "10.00",
        delivery_time: 4,
        company: { id: 5, name: "Outra" },
      },
    ]);

    const quotes = await melhorEnvioProvider.calculate(
      {
        destinationPostalCode: "20040-001",
        originPostalCode: "01310-100",
        items: [
          {
            productId: "p1",
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

    // só ids 1 e 2 estão em enabledServices do default
    expect(quotes.map((q) => q.serviceCode).sort()).toEqual(["1", "2"]);
    expect(quotes[0].price).toBe(25); // mais barato primeiro
    expect(quotes[1].price).toBe(45);
  });

  it("descarta serviços com error", async () => {
    const settings = getDefaultSiteSettings().shipping;
    global.fetch = mockFetchOnce([
      { id: 1, name: "PAC", error: "CEP origem inválido" },
      { id: 2, name: "SEDEX", price: "45.00", delivery_time: 3, company: { name: "Correios" } },
    ]);

    const quotes = await melhorEnvioProvider.calculate(
      {
        destinationPostalCode: "20040-001",
        originPostalCode: "01310-100",
        items: [
          {
            productId: "p1",
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

    expect(quotes).toHaveLength(1);
    expect(quotes[0].serviceCode).toBe("2");
  });

  it("throws config_missing when token absent", async () => {
    delete process.env.MELHOR_ENVIO_TOKEN;
    const settings = getDefaultSiteSettings().shipping;
    await expect(
      melhorEnvioProvider.calculate(
        {
          destinationPostalCode: "20040-001",
          originPostalCode: "01310-100",
          items: [
            {
              productId: "p1",
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
      ),
    ).rejects.toMatchObject({ code: "config_missing" });
  });

  it("propaga provider_unavailable em HTTP 500", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response("Internal Error", { status: 500 }),
    );
    const settings = getDefaultSiteSettings().shipping;
    await expect(
      melhorEnvioProvider.calculate(
        {
          destinationPostalCode: "20040-001",
          originPostalCode: "01310-100",
          items: [
            {
              productId: "p1",
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
      ),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("track lança not_supported (stub para PR 2)", async () => {
    const settings = getDefaultSiteSettings().shipping;
    await expect(melhorEnvioProvider.track!("XX123BR", settings)).rejects.toBeInstanceOf(
      ShippingProviderError,
    );
  });
});
