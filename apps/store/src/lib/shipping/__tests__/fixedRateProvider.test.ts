import { describe, expect, it } from "vitest";
import { fixedRateProvider } from "@/src/lib/shipping/fallback/fixedRateProvider";
import { ShippingProviderError } from "@/src/lib/shipping/types";
import type { ShippingSettings } from "@/src/schemas/firestore";
import { getDefaultSiteSettings } from "@/src/schemas/firestore";

function makeSettings(overrides: Partial<ShippingSettings["fixedRate"]> = {}): ShippingSettings {
  const defaults = getDefaultSiteSettings().shipping;
  return {
    ...defaults,
    providerId: "fixed-rate",
    fixedRate: {
      ...defaults.fixedRate,
      ...overrides,
    },
  };
}

describe("fixedRateProvider.calculate", () => {
  it("resolves UF from CEP and picks matching entry", async () => {
    const settings = makeSettings({
      entries: [
        {
          state: "SP",
          price: 20,
          estimatedDays: 3,
          weightLimitKg: 1,
          additionalKgPrice: 5,
        },
        {
          state: "RJ",
          price: 30,
          estimatedDays: 5,
          weightLimitKg: 1,
          additionalKgPrice: 7,
        },
      ],
      defaultEntry: null,
    });

    const quotesSP = await fixedRateProvider.calculate(
      {
        destinationPostalCode: "01310-100",
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

    expect(quotesSP).toHaveLength(1);
    expect(quotesSP[0].price).toBe(20);
    expect(quotesSP[0].estimatedDays).toBe(3);
  });

  it("adds additionalKgPrice for overweight items", async () => {
    const settings = makeSettings({
      entries: [
        { state: "SP", price: 20, estimatedDays: 3, weightLimitKg: 1, additionalKgPrice: 5 },
      ],
      defaultEntry: null,
    });

    const quotes = await fixedRateProvider.calculate(
      {
        destinationPostalCode: "01310-100",
        originPostalCode: "01310-100",
        items: [
          {
            productId: "p1",
            quantity: 3,
            weightKg: 1,
            lengthCm: 20,
            widthCm: 15,
            heightCm: 5,
            unitPrice: 100,
          },
        ],
      },
      settings,
    );

    // total weight = 3kg, limit 1kg → 2kg extra × 5 = 10 + base 20 = 30
    expect(quotes[0].price).toBe(30);
  });

  it("falls back to defaultEntry when state is missing", async () => {
    const settings = makeSettings({
      entries: [],
      defaultEntry: {
        state: "SP",
        price: 50,
        estimatedDays: 10,
        weightLimitKg: 1,
        additionalKgPrice: 0,
      },
    });

    const quotes = await fixedRateProvider.calculate(
      {
        destinationPostalCode: "20040-001",
        originPostalCode: "01310-100",
        items: [
          {
            productId: "p1",
            quantity: 1,
            weightKg: 0.3,
            lengthCm: 20,
            widthCm: 15,
            heightCm: 5,
            unitPrice: 100,
          },
        ],
      },
      settings,
    );

    expect(quotes[0].price).toBe(50);
  });

  it("throws config_missing when state not found and no defaultEntry", async () => {
    const settings = makeSettings({ entries: [], defaultEntry: null });

    await expect(
      fixedRateProvider.calculate(
        {
          destinationPostalCode: "20040-001",
          originPostalCode: "01310-100",
          items: [
            {
              productId: "p1",
              quantity: 1,
              weightKg: 0.3,
              lengthCm: 20,
              widthCm: 15,
              heightCm: 5,
              unitPrice: 100,
            },
          ],
        },
        settings,
      ),
    ).rejects.toBeInstanceOf(ShippingProviderError);
  });
});
