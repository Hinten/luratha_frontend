import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Module mocks (Firestore Admin + orderService) -------------------------
// `notify.ts` importa o Admin SDK (que inicializa o app no load) e o
// orderService; mockamos ambos para testar a orquestração sem rede/credenciais.
const { getMock, loadOrderMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  loadOrderMock: vi.fn(),
}));

vi.mock("@luratha/firestore/firebaseAdmin", () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: () => ({
        withConverter: () => ({ get: () => getMock(name) }),
      }),
    }),
  },
}));
vi.mock("@luratha/firestore/adminSiteSettingsConverter", () => ({
  adminSiteSettingsConverter: {},
}));
vi.mock("@luratha/firestore/adminUserProfileConverter", () => ({ adminUserProfileConverter: {} }));
vi.mock("../../orderService", () => ({
  loadOrder: (...args: unknown[]) => loadOrderMock(...args),
}));

import { logger } from "@luratha/core/logging/logger";
import { firestoreCollections, validateUserProfile } from "@luratha/schemas";
import { buildPendingOrderFixture } from "@luratha/schemas/__fixtures__/orders";
import { notifyPurchaseConversion } from "../notify";

const ORDER = buildPendingOrderFixture({
  id: "order-paid-1",
  userId: "user-1",
  paymentStatus: "paid",
  status: "paid",
});

const PROFILE = validateUserProfile({
  id: "user-1",
  email: "foo@bar.com",
  firstName: "Maria",
  lastName: "Silva",
  phone: "+5511999999999",
  role: "customer",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

function settingsSnap(marketing: Record<string, unknown>) {
  return { exists: true, data: () => ({ marketing }) };
}
function profileSnap() {
  return { exists: true, data: () => PROFILE };
}
function snapFor(name: string, marketing: Record<string, unknown>) {
  return name === firestoreCollections.userProfiles ? profileSnap() : settingsSnap(marketing);
}

const ENABLED = { metaPixelEnabled: true, metaPixelId: "123456789012345" };
const ORIGINAL_ENV = { ...process.env };

let capturedBody: { access_token?: string; data?: Array<Record<string, unknown>> } | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  capturedBody = undefined;
  fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    capturedBody = JSON.parse(init.body as string);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ events_received: 1 }),
    };
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  loadOrderMock.mockResolvedValue(ORDER);
  getMock.mockImplementation((name: string) => snapFor(name, ENABLED));
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("notifyPurchaseConversion", () => {
  it("is a no-op (no fetch) when META_CAPI_ACCESS_TOKEN is absent", async () => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    await notifyPurchaseConversion("order-paid-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when the Pixel is disabled in settings (metaPixelEnabled false)", async () => {
    process.env.META_CAPI_ACCESS_TOKEN = "TKN";
    getMock.mockImplementation((name: string) =>
      snapFor(name, { metaPixelEnabled: false, metaPixelId: "123456789012345" }),
    );
    await notifyPurchaseConversion("order-paid-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when metaPixelId is empty", async () => {
    process.env.META_CAPI_ACCESS_TOKEN = "TKN";
    getMock.mockImplementation((name: string) =>
      snapFor(name, { metaPixelEnabled: true, metaPixelId: "" }),
    );
    await notifyPurchaseConversion("order-paid-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the Purchase to the configured pixel with event_id = order.id and hashed email", async () => {
    process.env.META_CAPI_ACCESS_TOKEN = "TKN";
    await notifyPurchaseConversion("order-paid-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/123456789012345/events");
    expect(capturedBody?.access_token).toBe("TKN");
    expect(capturedBody?.data?.[0]?.event_name).toBe("Purchase");
    expect(capturedBody?.data?.[0]?.event_id).toBe("order-paid-1");
    expect((capturedBody?.data?.[0]?.user_data as { em?: string[] })?.em).toBeDefined();
  });

  it("swallows a non-2xx response without throwing and logs a warning", async () => {
    process.env.META_CAPI_ACCESS_TOKEN = "TKN";
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => JSON.stringify({ error: "bad" }),
      })) as unknown as typeof fetch,
    );

    await expect(notifyPurchaseConversion("order-paid-1")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "[metaCapi] falha ao enviar o Purchase server-side",
      expect.objectContaining({ orderId: "order-paid-1" }),
    );
  });

  it("skips (no fetch) when the order is not found", async () => {
    process.env.META_CAPI_ACCESS_TOKEN = "TKN";
    loadOrderMock.mockResolvedValue(null);
    await notifyPurchaseConversion("order-missing");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
