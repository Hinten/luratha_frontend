import { describe, expect, it } from "vitest";
import { normalizeEmbeddingDimensions } from "@/src/lib/embeddingService";

describe("embeddingService", () => {
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
});
