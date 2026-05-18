import { describe, expect, it } from "vitest";
import {
  getDefaultSiteSettings,
  normalizePostalCode,
  validateSiteSettings,
} from "@/src/schemas/firestore";

describe("siteSettings schema", () => {
  it("getDefaultSiteSettings returns a parseable document", () => {
    const settings = getDefaultSiteSettings();
    expect(settings.id).toBe("global");
    expect(settings.shipping.providerId).toBe("melhor-envio");
    expect(settings.shipping.freeShipping.divisor).toBe(0.14);
    expect(settings.shipping.fallbackProductWeightKg).toBeGreaterThan(0);
    expect(settings.shipping.fixedRate.enabledAsFallback).toBe(true);
  });

  it("fixedRate.enabledAsFallback defaults to true when omitted", () => {
    const parsed = validateSiteSettings({
      id: "global",
      shipping: {
        ...getDefaultSiteSettings().shipping,
        fixedRate: { carrier: "Loja", service: "Padrão", entries: [], defaultEntry: null },
      },
      updatedAt: new Date().toISOString(),
    });
    expect(parsed.shipping.fixedRate.enabledAsFallback).toBe(true);
  });

  it("rejects divisor greater than 1", () => {
    const broken = {
      id: "global",
      shipping: {
        ...getDefaultSiteSettings().shipping,
        freeShipping: { divisor: 1.5, minThreshold: 0, maxThreshold: null, enabled: true },
      },
      updatedAt: new Date().toISOString(),
    };
    expect(() => validateSiteSettings(broken)).toThrow();
  });

  it("rejects originPostalCode malformed", () => {
    const broken = {
      id: "global",
      shipping: {
        ...getDefaultSiteSettings().shipping,
        originPostalCode: "abc",
      },
      updatedAt: new Date().toISOString(),
    };
    expect(() => validateSiteSettings(broken)).toThrow();
  });
});

describe("normalizePostalCode", () => {
  it("inserts hyphen when missing", () => {
    expect(normalizePostalCode("01310100")).toBe("01310-100");
  });

  it("keeps already formatted CEP", () => {
    expect(normalizePostalCode("01310-100")).toBe("01310-100");
  });

  it("throws on invalid length", () => {
    expect(() => normalizePostalCode("123")).toThrow();
  });
});
