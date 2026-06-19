import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEventsUrl,
  capiFetch,
  MetaCapiError,
  resolveMetaCapiConfig,
  type MetaCapiConfig,
} from "../client";

const ORIGINAL_ENV = { ...process.env };

function makeConfig(overrides: Partial<MetaCapiConfig> = {}): MetaCapiConfig {
  return { accessToken: "TKN", apiVersion: "v21.0", timeoutMs: 8000, ...overrides };
}

describe("resolveMetaCapiConfig", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns null when META_CAPI_ACCESS_TOKEN is absent (CAPI opcional)", () => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    expect(resolveMetaCapiConfig()).toBeNull();
  });

  it("resolves a trimmed token, the default api version and no test code", () => {
    process.env.META_CAPI_ACCESS_TOKEN = "  TKN  ";
    delete process.env.META_GRAPH_API_VERSION;
    delete process.env.META_CAPI_TEST_EVENT_CODE;
    expect(resolveMetaCapiConfig()).toMatchObject({
      accessToken: "TKN",
      apiVersion: "v21.0",
      testEventCode: undefined,
    });
  });

  it("honors META_GRAPH_API_VERSION and META_CAPI_TEST_EVENT_CODE overrides", () => {
    process.env.META_CAPI_ACCESS_TOKEN = "TKN";
    process.env.META_GRAPH_API_VERSION = "v22.0";
    process.env.META_CAPI_TEST_EVENT_CODE = "TEST123";
    expect(resolveMetaCapiConfig()).toMatchObject({
      apiVersion: "v22.0",
      testEventCode: "TEST123",
    });
  });
});

describe("buildEventsUrl", () => {
  it("builds the /{version}/{pixelId}/events endpoint", () => {
    expect(buildEventsUrl("v21.0", "123456789012345")).toBe(
      "https://graph.facebook.com/v21.0/123456789012345/events",
    );
  });
});

describe("capiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs JSON and returns the parsed body on 200", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ events_received: 1 }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await capiFetch(
      "https://graph.facebook.com/v21.0/1/events",
      { data: [] },
      makeConfig(),
    );

    expect(result).toEqual({ events_received: 1 });
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ data: [] });
  });

  it("throws MetaCapiError on a non-2xx response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: { message: "bad" } }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(capiFetch("u", {}, makeConfig())).rejects.toBeInstanceOf(MetaCapiError);
  });

  it("wraps a network failure (TypeError) into MetaCapiError", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(capiFetch("u", {}, makeConfig())).rejects.toMatchObject({
      name: "MetaCapiError",
      code: "provider_unavailable",
    });
  });
});
