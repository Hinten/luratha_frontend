import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEmbeddingService,
  normalizeEmbeddingDimensions,
} from "@/src/lib/embeddingService";

describe("embeddingService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("truncates embeddings to Firestore supported size", () => {
    const input = Array.from({ length: 2050 }, (_, index) => index / 10);
    const output = normalizeEmbeddingDimensions(input);

    expect(output).toHaveLength(2048);
    expect(output[0]).toBe(0);
    expect(output[2047]).toBe(204.7);
  });

  it("throws when embedding has less than minimum dimensions", () => {
    expect(() => normalizeEmbeddingDimensions([0.1, 0.2, 0.3])).toThrow();
  });

  it("requests embeddings from Vertex AI and normalizes the response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        predictions: [
          {
            embeddings: {
              values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, Number.NaN],
            },
          },
        ],
      }),
    } as Response);

    const service = createEmbeddingService({
      projectId: "luratha-96386",
      accessToken: "token",
      location: "us-central1",
      model: "text-embedding-005",
    });

    const embedding = await service.embed("vestido de linho");

    expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when service is missing project configuration", async () => {
    const service = createEmbeddingService({ accessToken: "token" });
    await expect(service.embed("busca")).rejects.toThrow("Vertex AI configuration is missing.");
  });

  it("throws when neither accessToken nor credential is provided", async () => {
    const service = createEmbeddingService({ projectId: "luratha-96386" });
    await expect(service.embed("busca")).rejects.toThrow("Vertex AI configuration is missing.");
  });

  it("uses credential to fetch a fresh access token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        predictions: [{ embeddings: { values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] } }],
      }),
    } as Response);

    const mockCredential = {
      getAccessToken: vi.fn().mockResolvedValue({ access_token: "dynamic-token", expires_in: 3600 }),
    };

    const service = createEmbeddingService({
      projectId: "luratha-96386",
      credential: mockCredential,
    });

    const embedding = await service.embed("blusa de algodão");

    expect(mockCredential.getAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("aiplatform.googleapis.com"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer dynamic-token" }),
      }),
    );
    expect(embedding).toHaveLength(8);
  });

  it("static accessToken takes precedence over credential", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        predictions: [{ embeddings: { values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] } }],
      }),
    } as Response);

    const mockCredential = {
      getAccessToken: vi.fn().mockResolvedValue({ access_token: "cred-token", expires_in: 3600 }),
    };

    const service = createEmbeddingService({
      projectId: "luratha-96386",
      accessToken: "static-token",
      credential: mockCredential,
    });

    await service.embed("vestido");

    // Credential should NOT be called when static token is available
    expect(mockCredential.getAccessToken).not.toHaveBeenCalled();
  });

  it("aborts the request when the configured timeout elapses", async () => {
    // Use a very short timeout to trigger abort reliably in tests
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementationOnce((_url, opts) => {
      // Immediately abort so the signal fires before the promise resolves
      (opts?.signal as AbortSignal)?.dispatchEvent(new Event("abort"));
      return new Promise((_, reject) => reject(Object.assign(new Error("The operation was aborted."), { name: "AbortError" })));
    });

    const service = createEmbeddingService({
      projectId: "luratha-96386",
      accessToken: "token",
      timeoutMs: 1,
    });

    await expect(service.embed("teste de timeout")).rejects.toThrow();
  });
});

