import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Order } from "@luratha/schemas";
import { buildGa4PurchasePayload, sendGa4Purchase } from "../ga4MeasurementProtocol";

// Controla o snapshot de settings devolvido pelo adminDb mockado.
const settingsMock = vi.hoisted(() => ({
  current: {
    exists: true,
    data: () => ({ marketing: { ga4Enabled: true, ga4MeasurementId: "G-TEST123" } }),
  } as { exists: boolean; data: () => unknown },
}));

vi.mock("@luratha/firestore/firebaseAdmin", () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        withConverter: () => ({
          get: async () => settingsMock.current,
        }),
      }),
    }),
  },
}));

function makeOrder(overrides: Partial<Order> = {}): Order {
  // Objeto mínimo com os campos que o builder lê — cast porque os testes de
  // unidade exercitam só a montagem do payload, não o schema completo.
  return {
    id: "order_123",
    ga4ClientId: "111222333.444555666",
    currency: "BRL",
    grandTotal: 289.9,
    shippingTotal: 19.9,
    couponCode: undefined,
    items: [{ itemSku: "LURATHA_9001_M", name: "Vestido Bordado", unitPrice: 270, quantity: 1 }],
    ...overrides,
  } as unknown as Order;
}

describe("buildGa4PurchasePayload", () => {
  it("maps the order into a purchase event using order.id as transaction_id", () => {
    const payload = buildGa4PurchasePayload(makeOrder({ couponCode: "BEMVINDA10" }));
    expect(payload).toEqual({
      client_id: "111222333.444555666",
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: "order_123",
            currency: "BRL",
            value: 289.9,
            shipping: 19.9,
            coupon: "BEMVINDA10",
            items: [
              {
                item_id: "LURATHA_9001_M",
                item_name: "Vestido Bordado",
                price: 270,
                quantity: 1,
              },
            ],
          },
        },
      ],
    });
  });

  it("omits coupon when the order has none", () => {
    const payload = buildGa4PurchasePayload(makeOrder());
    expect(payload?.events[0].params).not.toHaveProperty("coupon");
  });

  it("returns null when the order has no ga4ClientId", () => {
    expect(buildGa4PurchasePayload(makeOrder({ ga4ClientId: undefined }))).toBeNull();
  });
});

describe("sendGa4Purchase", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GA4_API_SECRET", "secret_abc");
    settingsMock.current = {
      exists: true,
      data: () => ({ marketing: { ga4Enabled: true, ga4MeasurementId: "G-TEST123" } }),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts the purchase to the Measurement Protocol and returns true", async () => {
    const ok = await sendGa4Purchase(makeOrder());
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("https://www.google-analytics.com/mp/collect");
    expect(url).toContain("measurement_id=G-TEST123");
    expect(url).toContain("api_secret=secret_abc");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.client_id).toBe("111222333.444555666");
    expect(body.events[0].name).toBe("purchase");
    expect(body.events[0].params.transaction_id).toBe("order_123");
  });

  it("is a no-op (false) when the order has no client_id", async () => {
    const ok = await sendGa4Purchase(makeOrder({ ga4ClientId: undefined }));
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is a no-op when GA4_API_SECRET is absent", async () => {
    vi.stubEnv("GA4_API_SECRET", "");
    const ok = await sendGa4Purchase(makeOrder());
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is a no-op when GA4 is disabled in settings", async () => {
    settingsMock.current = {
      exists: true,
      data: () => ({ marketing: { ga4Enabled: false, ga4MeasurementId: "G-TEST123" } }),
    };
    const ok = await sendGa4Purchase(makeOrder());
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false (does not throw) on a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    await expect(sendGa4Purchase(makeOrder())).resolves.toBe(false);
  });

  it("returns false on a non-OK response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    await expect(sendGa4Purchase(makeOrder())).resolves.toBe(false);
  });
});
