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
});
