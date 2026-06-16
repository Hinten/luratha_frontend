import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateUserProfile, type UserProfile } from "@luratha/schemas";
import { buildPendingOrderFixture } from "@luratha/schemas/__fixtures__/orders";
import { buildPurchaseEventData, sendPurchaseEvent } from "../purchaseEvent";
import { hashEmail, hashExternalId, hashName, hashPhone } from "../hash";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return validateUserProfile({
    id: "user-fixture-0001",
    email: "foo@bar.com",
    firstName: "Maria",
    lastName: "Silva",
    phone: "+5511999999999",
    role: "customer",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("buildPurchaseEventData", () => {
  it("builds a Purchase with event_id = order.id, action_source website and hashed user_data", () => {
    const order = buildPendingOrderFixture({
      paymentStatus: "paid",
      status: "paid",
      paidAt: "2026-01-02T00:00:00.000Z",
    });
    const data = buildPurchaseEventData(order, makeProfile());

    expect(data.event_name).toBe("Purchase");
    expect(data.event_id).toBe(order.id);
    expect(data.action_source).toBe("website");
    expect(data.event_time).toBe(Math.floor(new Date("2026-01-02T00:00:00.000Z").getTime() / 1000));

    expect(data.user_data.em).toEqual([hashEmail("foo@bar.com")]);
    expect(data.user_data.ph).toEqual([hashPhone("+5511999999999")]);
    expect(data.user_data.fn).toEqual([hashName("Maria")]);
    expect(data.user_data.ln).toEqual([hashName("Silva")]);
    expect(data.user_data.external_id).toEqual([hashExternalId(order.userId)]);
  });

  it("maps custom_data from the order (SKUs, value, currency, num_items, order_id)", () => {
    const order = buildPendingOrderFixture({ paymentStatus: "paid", status: "paid" });
    const data = buildPurchaseEventData(order, null);

    expect(data.custom_data).toMatchObject({
      currency: "BRL",
      value: order.grandTotal,
      content_type: "product",
      num_items: order.itemCount,
      order_id: order.id,
    });
    expect(data.custom_data.content_ids).toEqual(order.items.map((i) => i.itemSku));
    expect(data.custom_data.contents).toEqual(
      order.items.map((i) => ({ id: i.itemSku, quantity: i.quantity, item_price: i.unitPrice })),
    );
  });

  it("omits absent profile fields but still sets external_id from the order userId", () => {
    const order = buildPendingOrderFixture();
    const data = buildPurchaseEventData(order, null);
    expect(data.user_data.em).toBeUndefined();
    expect(data.user_data.ph).toBeUndefined();
    expect(data.user_data.fn).toBeUndefined();
    expect(data.user_data.external_id).toEqual([hashExternalId(order.userId)]);
  });

  it("falls back to opts.now for event_time when the order has no paidAt", () => {
    const order = buildPendingOrderFixture();
    const data = buildPurchaseEventData(order, null, { now: 1_700_000_000_000 });
    expect(data.event_time).toBe(1_700_000_000);
  });
});

describe("sendPurchaseEvent", () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  beforeEach(() => {
    capturedUrl = undefined;
    capturedInit = undefined;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ events_received: 1 }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to the events endpoint with the access token and test code", async () => {
    const order = buildPendingOrderFixture({ paymentStatus: "paid", status: "paid" });
    const data = buildPurchaseEventData(order, makeProfile());
    await sendPurchaseEvent(
      { accessToken: "TKN", apiVersion: "v21.0", testEventCode: "TEST9", timeoutMs: 8000 },
      "9988",
      data,
    );

    expect(capturedUrl).toBe("https://graph.facebook.com/v21.0/9988/events");
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.access_token).toBe("TKN");
    expect(body.test_event_code).toBe("TEST9");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].event_name).toBe("Purchase");
    expect(body.data[0].event_id).toBe(order.id);
  });

  it("omits test_event_code when not configured", async () => {
    const order = buildPendingOrderFixture({ paymentStatus: "paid", status: "paid" });
    const data = buildPurchaseEventData(order, null);
    await sendPurchaseEvent(
      { accessToken: "TKN", apiVersion: "v21.0", timeoutMs: 8000 },
      "9988",
      data,
    );

    const body = JSON.parse(capturedInit?.body as string);
    expect(body.test_event_code).toBeUndefined();
  });
});
