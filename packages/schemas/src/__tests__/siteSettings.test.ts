import { describe, expect, it } from "vitest";
import {
  getDefaultSiteSettings,
  normalizePostalCode,
  validateSiteSettings,
} from "@luratha/schemas";

describe("siteSettings schema", () => {
  it("getDefaultSiteSettings returns a parseable document", () => {
    const settings = getDefaultSiteSettings();
    expect(settings.id).toBe("global");
    expect(settings.shipping.providerId).toBe("melhor-envio");
    expect(settings.shipping.freeShipping.divisor).toBe(0.14);
    expect(settings.shipping.fallbackProductWeightKg).toBeGreaterThan(0);
    expect(settings.shipping.fixedRate.enabledAsFallback).toBe(false);
  });

  it("fixedRate.enabledAsFallback defaults to false when omitted (safe by default)", () => {
    const parsed = validateSiteSettings({
      id: "global",
      shipping: {
        ...getDefaultSiteSettings().shipping,
        fixedRate: { carrier: "Loja", service: "Padrão", entries: [], defaultEntry: null },
      },
      updatedAt: new Date().toISOString(),
    });
    expect(parsed.shipping.fixedRate.enabledAsFallback).toBe(false);
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

describe("marketing settings", () => {
  it("materializes an empty marketing block for documents created before it (retro-compat)", () => {
    // Documento legado: só `shipping`, sem `marketing`. A leitura deve continuar
    // válida e o `.default()` materializa todos os campos vazios.
    const parsed = validateSiteSettings({
      id: "global",
      shipping: getDefaultSiteSettings().shipping,
      updatedAt: new Date().toISOString(),
    });
    expect(parsed.marketing).toEqual({
      metaPixelId: "",
      facebookCatalogId: "",
      googleMerchantCenterId: "",
      ga4MeasurementId: "",
    });
  });

  it("preserves provided marketing identifiers and trims them", () => {
    const parsed = validateSiteSettings({
      id: "global",
      shipping: getDefaultSiteSettings().shipping,
      marketing: {
        metaPixelId: "  123456789012345  ",
        facebookCatalogId: "987654321",
        googleMerchantCenterId: "555000111",
        ga4MeasurementId: "G-ABC123XYZ",
      },
      updatedAt: new Date().toISOString(),
    });
    expect(parsed.marketing.metaPixelId).toBe("123456789012345");
    expect(parsed.marketing.facebookCatalogId).toBe("987654321");
    expect(parsed.marketing.googleMerchantCenterId).toBe("555000111");
    expect(parsed.marketing.ga4MeasurementId).toBe("G-ABC123XYZ");
  });

  it("rejects identifiers longer than the allowed maximum", () => {
    expect(() =>
      validateSiteSettings({
        id: "global",
        shipping: getDefaultSiteSettings().shipping,
        marketing: { metaPixelId: "1".repeat(64) },
        updatedAt: new Date().toISOString(),
      }),
    ).toThrow();
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
