/**
 * Cloud integration test for POST /api/checkout/shipping.
 *
 * O provider Melhor Envio é mockado por substituição no registry (não bate em
 * sandbox externo). O foco é validar (a) o handler, (b) leitura de siteSettings
 * do Firestore real e (c) que mudar o documento `settings/global` no Firestore
 * reflete imediatamente após `forceFresh`.
 */

import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminSiteSettingsConverter } from "@luratha/firestore/adminSiteSettingsConverter";
import {
  firestoreCollections,
  getDefaultSiteSettings,
  SITE_SETTINGS_DOC_ID,
  type SiteSettings,
} from "@luratha/schemas";
import { clearSiteSettingsCache } from "@luratha/repositories/siteSettingsRepository";
import { clearShippingCache } from "@/src/lib/shipping/cache";
import {
  __setShippingProviderForTests,
  getShippingProvider,
} from "@/src/lib/shipping/provider";
import { melhorEnvioProvider } from "@/src/lib/shipping/melhorEnvio";
import { fixedRateProvider } from "@/src/lib/shipping/fallback/fixedRateProvider";
import type { ShippingProvider } from "@/src/lib/shipping/types";
import { describeCloud } from "@/src/test/cloud/sharedSetup";

import { POST } from "@/src/app/api/checkout/shipping/route";

const REFERENCE_PRICE = 14;

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
          price: REFERENCE_PRICE,
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
    ];
  },
};

function settingsDoc() {
  return adminDb
    .collection(firestoreCollections.settings)
    .doc(SITE_SETTINGS_DOC_ID)
    .withConverter(adminSiteSettingsConverter);
}

async function backupCurrent(): Promise<SiteSettings | null> {
  const snap = await settingsDoc().get();
  return snap.exists ? snap.data()! : null;
}

describeCloud("/api/checkout/shipping (Cloud Firebase)", () => {
  let original: SiteSettings | null = null;
  const originalProvider = getShippingProvider("melhor-envio");

  beforeAll(async () => {
    original = await backupCurrent();
    const baseline: SiteSettings = {
      ...getDefaultSiteSettings(),
      updatedAt: new Date().toISOString(),
    };
    await settingsDoc().set(baseline);
    clearSiteSettingsCache();
  });

  beforeEach(() => {
    clearShippingCache();
    clearSiteSettingsCache();
    __setShippingProviderForTests("melhor-envio", mockProvider);
  });

  afterAll(async () => {
    __setShippingProviderForTests("melhor-envio", originalProvider ?? melhorEnvioProvider);
    __setShippingProviderForTests("fixed-rate", fixedRateProvider);
    if (original) {
      await settingsDoc().set(original);
    } else {
      await settingsDoc().delete();
    }
    clearSiteSettingsCache();
  });

  it("retorna quotes + freeShippingThreshold usando settings do Firestore", async () => {
    const res = await POST(
      new Request("http://localhost/api/checkout/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postalCode: "20040-001",
          items: [{ productId: "p-cloud", quantity: 1, unitPrice: 100, weightKg: 0.5 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      quotes: unknown[];
      freeShippingThreshold: number;
      referenceShippingCost: number;
    };
    expect(data.quotes.length).toBeGreaterThan(0);
    expect(data.referenceShippingCost).toBe(REFERENCE_PRICE);
    // 14 / 0.14 = 100
    expect(data.freeShippingThreshold).toBe(100);
  });

  it("reflete mudança do divisor no Firestore (forceFresh)", async () => {
    const tweaked: SiteSettings = {
      ...getDefaultSiteSettings(),
      updatedAt: new Date().toISOString(),
    };
    tweaked.shipping.freeShipping.divisor = 0.1;
    await settingsDoc().set(tweaked);
    clearSiteSettingsCache();
    clearShippingCache();

    const res = await POST(
      new Request("http://localhost/api/checkout/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "free-shipping-only", postalCode: "20040-001" }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { threshold: number; divisor: number };
    expect(data.divisor).toBe(0.1);
    expect(data.threshold).toBe(140); // 14 / 0.1
  });

  it("retorna 400 quando payload inválido", async () => {
    const res = await POST(
      new Request("http://localhost/api/checkout/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: "abc" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
