import { describe, expect, it } from "vitest";
import {
  calculateFreeShippingThreshold,
  pickReferenceShippingCost,
} from "@/src/lib/shipping/freeShipping";
import type { FreeShippingConfig } from "@/src/schemas/firestore";
import type { ShippingQuote } from "@/src/lib/shipping/types";

function makeConfig(overrides: Partial<FreeShippingConfig> = {}): FreeShippingConfig {
  return {
    divisor: 0.14,
    minThreshold: 0,
    maxThreshold: null,
    enabled: true,
    ...overrides,
  };
}

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

describe("calculateFreeShippingThreshold", () => {
  it("applies formula shippingCost / divisor", () => {
    expect(calculateFreeShippingThreshold(10, makeConfig())).toBeCloseTo(71.43, 2);
    expect(calculateFreeShippingThreshold(30, makeConfig())).toBeCloseTo(214.29, 2);
  });

  it("respects custom divisor", () => {
    expect(calculateFreeShippingThreshold(10, makeConfig({ divisor: 0.2 }))).toBe(50);
  });

  it("returns null when disabled", () => {
    expect(calculateFreeShippingThreshold(10, makeConfig({ enabled: false }))).toBeNull();
  });

  it("returns null when shipping cost is zero or negative", () => {
    expect(calculateFreeShippingThreshold(0, makeConfig())).toBeNull();
    expect(calculateFreeShippingThreshold(-5, makeConfig())).toBeNull();
  });

  it("clamps to minThreshold", () => {
    const result = calculateFreeShippingThreshold(1, makeConfig({ minThreshold: 50 }));
    expect(result).toBe(50);
  });

  it("returns null when threshold exceeds maxThreshold (frete caro demais)", () => {
    expect(
      calculateFreeShippingThreshold(50, makeConfig({ maxThreshold: 200 })),
    ).toBeNull();
  });

  it("keeps threshold when within maxThreshold", () => {
    const result = calculateFreeShippingThreshold(10, makeConfig({ maxThreshold: 200 }));
    expect(result).toBeCloseTo(71.43, 2);
  });
});

describe("pickReferenceShippingCost", () => {
  it("picks the cheapest quote", () => {
    expect(pickReferenceShippingCost([makeQuote(20), makeQuote(15), makeQuote(30)])).toBe(15);
  });

  it("returns 0 when no quotes", () => {
    expect(pickReferenceShippingCost([])).toBe(0);
  });
});
