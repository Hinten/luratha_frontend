import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearShippingCache } from "@/src/lib/shipping/cache";
import { __setShippingProviderForTests } from "@/src/lib/shipping/provider";
import {
  ShippingProviderError,
  type ShippingProvider,
  type ShippingQuote,
} from "@/src/lib/shipping/types";
import { fixedRateProvider } from "@/src/lib/shipping/fallback/fixedRateProvider";
import { melhorEnvioProvider } from "@/src/lib/shipping/melhorEnvio";

vi.mock("@luratha/repositories/siteSettingsRepository", async () => {
  const { getDefaultSiteSettings } = await import("@luratha/schemas/siteSettings");
  return {
    getSiteSettings: vi.fn(async () => getDefaultSiteSettings()),
  };
});

import { quoteFreeShippingThreshold, quoteShipping } from "@/src/lib/shipping/service";

function makeQuote(price: number, code = "1"): ShippingQuote {
  return {
    providerId: "melhor-envio",
    serviceCode: code,
    carrier: "Correios",
    service: "PAC",
    price,
    estimatedDays: 5,
  };
}

beforeEach(() => {
  clearShippingCache();
});

afterEach(() => {
  __setShippingProviderForTests("melhor-envio", melhorEnvioProvider);
  __setShippingProviderForTests("fixed-rate", fixedRateProvider);
});

describe("quoteShipping", () => {
  it("returns quotes + freeShippingThreshold derived from 1kg simulation", async () => {
    const mockProvider: ShippingProvider = {
      id: "melhor-envio",
      async calculate(input) {
        // First call: cart simulation (multiple items). Second: 1kg reference.
        const total = input.items.reduce(
          (s: number, i: { weightKg: number; quantity: number }) => s + i.weightKg * i.quantity,
          0,
        );
        if (Math.abs(total - 1) < 0.001 && input.items[0].productId.startsWith("__free")) {
          return [makeQuote(14)];
        }
        return [makeQuote(20), makeQuote(35, "2")];
      },
    };
    __setShippingProviderForTests("melhor-envio", mockProvider);

    const result = await quoteShipping({
      destinationPostalCode: "20040-001",
      items: [{ productId: "p1", quantity: 2, unitPrice: 100, weightKg: 0.5 }],
    });

    expect(result.quotes).toHaveLength(2);
    // 14 / 0.14 = 100
    expect(result.freeShippingThreshold).toBe(100);
    expect(result.referenceShippingCost).toBe(14);
    expect(result.usedFallback).toBe(false);
  });

  it("caches quotes for the same input", async () => {
    const calculate = vi.fn(async () => [makeQuote(20)]);
    __setShippingProviderForTests("melhor-envio", { id: "melhor-envio", calculate });

    const input = {
      destinationPostalCode: "20040-001",
      items: [{ productId: "p1", quantity: 1, unitPrice: 50, weightKg: 0.4 }],
    };
    await quoteShipping(input);
    await quoteShipping(input);

    // 1 call for cart quote + 1 for 1kg reference; segunda chamada usa cache para ambos
    expect(calculate).toHaveBeenCalledTimes(2);
  });

  it("falls back to fixed-rate provider when primary fails and fallback is enabled", async () => {
    const mod = await import("@luratha/repositories/siteSettingsRepository");
    const { getDefaultSiteSettings } = await import("@luratha/schemas/siteSettings");
    const settings = getDefaultSiteSettings();
    settings.shipping.fixedRate.enabledAsFallback = true;
    (mod.getSiteSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(settings);

    __setShippingProviderForTests("melhor-envio", {
      id: "melhor-envio",
      calculate: vi.fn(async () => {
        throw new ShippingProviderError("down", "melhor-envio", "provider_unavailable");
      }),
    });

    const result = await quoteShipping({
      destinationPostalCode: "01310-100",
      items: [{ productId: "p1", quantity: 1, unitPrice: 100, weightKg: 0.5 }],
    });

    expect(result.usedFallback).toBe(true);
    expect(result.quotes.length).toBeGreaterThan(0);
    expect(result.quotes[0].providerId).toBe("fixed-rate");
  });

  it("does NOT fall back when fixedRate.enabledAsFallback is false (default) — propagates error", async () => {
    // getDefaultSiteSettings() já tem enabledAsFallback: false por padrão.
    __setShippingProviderForTests("melhor-envio", {
      id: "melhor-envio",
      calculate: vi.fn(async () => {
        throw new ShippingProviderError("down", "melhor-envio", "provider_unavailable");
      }),
    });

    await expect(
      quoteShipping({
        destinationPostalCode: "01310-100",
        items: [{ productId: "p1", quantity: 1, unitPrice: 100, weightKg: 0.5 }],
      }),
    ).rejects.toBeInstanceOf(ShippingProviderError);
  });

  it("throws a combined error when primary fails AND the fallback is also unavailable", async () => {
    const mod = await import("@luratha/repositories/siteSettingsRepository");
    const { getDefaultSiteSettings } = await import("@luratha/schemas/siteSettings");
    const settings = getDefaultSiteSettings();
    settings.shipping.fixedRate.enabledAsFallback = true;
    // Sem entries e sem defaultEntry → fixed-rate lança config_missing.
    settings.shipping.fixedRate.entries = [];
    settings.shipping.fixedRate.defaultEntry = null;
    (mod.getSiteSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(settings);

    __setShippingProviderForTests("melhor-envio", {
      id: "melhor-envio",
      calculate: vi.fn(async () => {
        throw new ShippingProviderError("primário caiu", "melhor-envio", "provider_unavailable");
      }),
    });

    await expect(
      quoteShipping({
        destinationPostalCode: "01310-100",
        items: [{ productId: "p1", quantity: 1, unitPrice: 100, weightKg: 0.5 }],
      }),
    ).rejects.toMatchObject({
      name: "ShippingProviderError",
      code: "provider_unavailable",
    });
  });
});

describe("quoteFreeShippingThreshold", () => {
  it("returns null when free shipping is disabled", async () => {
    const mod = await import("@luratha/repositories/siteSettingsRepository");
    const { getDefaultSiteSettings } = await import("@luratha/schemas/siteSettings");
    const settings = getDefaultSiteSettings();
    settings.shipping.freeShipping.enabled = false;
    (mod.getSiteSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(settings);

    const result = await quoteFreeShippingThreshold({ destinationPostalCode: "20040-001" });

    expect(result.threshold).toBeNull();
    expect(result.enabled).toBe(false);
  });

  it("uses 1kg simulation to derive the threshold and returns the quotes", async () => {
    __setShippingProviderForTests("melhor-envio", {
      id: "melhor-envio",
      calculate: vi.fn(async () => [makeQuote(10), makeQuote(18, "2")]),
    });

    const result = await quoteFreeShippingThreshold({ destinationPostalCode: "20040-001" });

    expect(result.referenceShippingCost).toBe(10);
    expect(result.threshold).toBeCloseTo(71.43, 2);
    expect(result.divisor).toBe(0.14);
    // As cotações de 1kg agora são expostas para a PDP exibir.
    expect(result.quotes).toHaveLength(2);
    expect(result.quotes.map((q) => q.price)).toEqual([10, 18]);
  });

  it("returns quotes even when free shipping is disabled", async () => {
    const mod = await import("@luratha/repositories/siteSettingsRepository");
    const { getDefaultSiteSettings } = await import("@luratha/schemas/siteSettings");
    const settings = getDefaultSiteSettings();
    settings.shipping.freeShipping.enabled = false;
    (mod.getSiteSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(settings);

    __setShippingProviderForTests("melhor-envio", {
      id: "melhor-envio",
      calculate: vi.fn(async () => [makeQuote(12)]),
    });

    const result = await quoteFreeShippingThreshold({ destinationPostalCode: "20040-001" });

    expect(result.threshold).toBeNull();
    expect(result.enabled).toBe(false);
    expect(result.quotes).toHaveLength(1);
  });
});
