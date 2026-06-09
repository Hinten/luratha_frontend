import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearShippingCache } from "@/src/lib/shipping/cache";
import { __setShippingProviderForTests } from "@/src/lib/shipping/provider";
import { melhorEnvioProvider } from "@/src/lib/shipping/melhorEnvio";
import { fixedRateProvider } from "@/src/lib/shipping/fallback/fixedRateProvider";
import { ShippingProviderError, type ShippingProvider } from "@/src/lib/shipping/types";

vi.mock("@luratha/repositories/siteSettingsRepository", async () => {
  const { getDefaultSiteSettings } = await import("@luratha/schemas/siteSettings");
  return {
    getSiteSettings: vi.fn(async () => getDefaultSiteSettings()),
  };
});

import { POST } from "@/src/app/api/checkout/shipping/route";

const mockProvider: ShippingProvider = {
  id: "melhor-envio",
  async calculate(input) {
    const isReference = input.items[0]?.productId.startsWith("__free");
    if (isReference) {
      return [
        {
          providerId: "melhor-envio",
          serviceCode: "1",
          carrier: "Correios",
          service: "PAC",
          price: 14,
          estimatedDays: 7,
        },
      ];
    }
    return [
      {
        providerId: "melhor-envio",
        serviceCode: "1",
        carrier: "Correios",
        service: "PAC",
        price: 22,
        estimatedDays: 7,
      },
      {
        providerId: "melhor-envio",
        serviceCode: "2",
        carrier: "Correios",
        service: "SEDEX",
        price: 38,
        estimatedDays: 3,
      },
    ];
  },
};

beforeEach(() => {
  clearShippingCache();
  __setShippingProviderForTests("melhor-envio", mockProvider);
});

afterEach(() => {
  __setShippingProviderForTests("melhor-envio", melhorEnvioProvider);
  __setShippingProviderForTests("fixed-rate", fixedRateProvider);
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkout/shipping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout/shipping", () => {
  it("returns quotes and freeShippingThreshold for full cart", async () => {
    const res = await POST(
      jsonRequest({
        postalCode: "20040-001",
        items: [{ productId: "p1", quantity: 1, unitPrice: 100, weightKg: 0.5 }],
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      quotes: Array<{ price: number; serviceCode: string }>;
      freeShippingThreshold: number;
      referenceShippingCost: number;
    };
    expect(data.quotes).toHaveLength(2);
    expect(data.freeShippingThreshold).toBe(100); // 14 / 0.14
    expect(data.referenceShippingCost).toBe(14);
  });

  it("free-shipping-only mode returns threshold and the 1kg quotes", async () => {
    const res = await POST(jsonRequest({ mode: "free-shipping-only", postalCode: "20040-001" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      threshold: number;
      referenceShippingCost: number;
      divisor: number;
      quotes: Array<{ price: number; serviceCode: string }>;
    };
    expect(data.threshold).toBe(100);
    expect(data.divisor).toBe(0.14);
    expect(Array.isArray(data.quotes)).toBe(true);
    expect(data.quotes.length).toBeGreaterThan(0);
    expect(data.quotes[0].price).toBe(14);
  });

  it("returns 400 on invalid CEP", async () => {
    const res = await POST(
      jsonRequest({
        postalCode: "abc",
        items: [{ productId: "p1", quantity: 1, unitPrice: 10 }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when items array is empty", async () => {
    const res = await POST(jsonRequest({ postalCode: "20040-001", items: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/checkout/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 502 when primary fails and fixedRate fallback is disabled", async () => {
    const mod = await import("@luratha/repositories/siteSettingsRepository");
    const { getDefaultSiteSettings } = await import("@luratha/schemas/siteSettings");
    const settings = getDefaultSiteSettings();
    settings.shipping.fixedRate.enabledAsFallback = false;
    (mod.getSiteSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(settings);

    __setShippingProviderForTests("melhor-envio", {
      id: "melhor-envio",
      async calculate() {
        throw new ShippingProviderError("down", "melhor-envio", "provider_unavailable");
      },
    });

    const res = await POST(
      jsonRequest({
        postalCode: "20040-001",
        items: [{ productId: "p1", quantity: 1, unitPrice: 100, weightKg: 0.5 }],
      }),
    );
    expect(res.status).toBe(502);
  });
});
