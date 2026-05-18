import { describe, expect, it, vi } from "vitest";
import {
  buildSearchEmbeddingText,
  buildVectorEmbeddingText,
  generateProductEmbeddings,
} from "@/src/lib/productEmbeddings";
import type { Product } from "@/src/schemas/firestore";

// ── Fixtures ─────────────────────────────────────────────────────────────────

type ProductEmbeddingInput = Pick<Product, "title" | "description" | "categoryId" | "variants">;

function makeProduct(overrides: Partial<ProductEmbeddingInput> = {}): ProductEmbeddingInput {
  return {
    title: "Vestido de Linho Artesanal",
    description: "Vestido leve feito com linho natural de alta qualidade, perfeito para o verão.",
    categoryId: "vestidos",
    variants: null,
    ...overrides,
  };
}

// ── buildVectorEmbeddingText ─────────────────────────────────────────────────

describe("buildVectorEmbeddingText", () => {
  it("returns the trimmed product title", () => {
    expect(buildVectorEmbeddingText(makeProduct())).toBe("Vestido de Linho Artesanal");
  });

  it("trims leading/trailing whitespace from the title", () => {
    expect(buildVectorEmbeddingText(makeProduct({ title: "  Blusa de Seda  " }))).toBe(
      "Blusa de Seda",
    );
  });
});

// ── buildSearchEmbeddingText ─────────────────────────────────────────────────

describe("buildSearchEmbeddingText", () => {
  it("includes title and description", () => {
    const text = buildSearchEmbeddingText(makeProduct());
    expect(text).toContain("Vestido de Linho Artesanal");
    expect(text).toContain("linho natural");
  });

  it("includes categoryId", () => {
    const text = buildSearchEmbeddingText(makeProduct({ categoryId: "vestidos" }));
    expect(text).toContain("vestidos");
  });

  it("includes variant sizes when present", () => {
    const text = buildSearchEmbeddingText(
      makeProduct({
        variants: [
          { id: "var-1", sku: "SKU-P", size: ["P", "M"], color: null, photoIds: ["a"], gtin: null, mpn: null, item_group_id: null, active: true },
          { id: "var-2", sku: "SKU-G", size: ["G", "GG"], color: null, photoIds: ["b"], gtin: null, mpn: null, item_group_id: null, active: true },
        ],
      }),
    );
    expect(text).toContain("P");
    expect(text).toContain("M");
    expect(text).toContain("G");
    expect(text).toContain("GG");
  });

  it("includes variant colors when present", () => {
    const text = buildSearchEmbeddingText(
      makeProduct({
        variants: [
          { id: "var-3", sku: "SKU-A", size: null, color: ["azul", "branco"], photoIds: ["c"], gtin: null, mpn: null, item_group_id: null, active: true },
        ],
      }),
    );
    expect(text).toContain("azul");
    expect(text).toContain("branco");
  });

  it("does not include variant section when variants is null", () => {
    const withVariants = buildSearchEmbeddingText(
      makeProduct({
        variants: [
          { id: "var-4", sku: "SKU-X", size: ["P"], color: null, photoIds: ["d"], gtin: null, mpn: null, item_group_id: null, active: true },
        ],
      }),
    );
    const withoutVariants = buildSearchEmbeddingText(makeProduct({ variants: null }));
    expect(withVariants.length).toBeGreaterThan(withoutVariants.length);
  });
});

// ── generateProductEmbeddings ────────────────────────────────────────────────

describe("generateProductEmbeddings", () => {
  it("returns both embeddings when both succeed", async () => {
    const vectorEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const searchEmbedding = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
    const mockEmbed = vi
      .fn()
      .mockResolvedValueOnce(vectorEmbedding)
      .mockResolvedValueOnce(searchEmbedding);

    const result = await generateProductEmbeddings(makeProduct(), { embed: mockEmbed });

    expect(result.vectorEmbedding).toEqual(vectorEmbedding);
    expect(result.searchEmbedding).toEqual(searchEmbedding);
    expect(mockEmbed).toHaveBeenCalledTimes(2);
  });

  it("calls embed with title-only text for vectorEmbedding", async () => {
    const mockEmbed = vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    const product = makeProduct();
    await generateProductEmbeddings(product, { embed: mockEmbed });
    expect(mockEmbed).toHaveBeenNthCalledWith(1, product.title.trim());
  });

  it("calls embed with rich text for searchEmbedding", async () => {
    const mockEmbed = vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    const product = makeProduct();
    await generateProductEmbeddings(product, { embed: mockEmbed });
    const secondCallArg = mockEmbed.mock.calls[1][0] as string;
    expect(secondCallArg).toContain(product.title.trim());
    expect(secondCallArg).toContain(product.description.trim());
    expect(secondCallArg).toContain(product.categoryId);
  });

  it("omits vectorEmbedding when first embed call fails", async () => {
    const searchEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const mockEmbed = vi
      .fn()
      .mockRejectedValueOnce(new Error("vector failed"))
      .mockResolvedValueOnce(searchEmbedding);

    const result = await generateProductEmbeddings(makeProduct(), { embed: mockEmbed });

    expect(result.vectorEmbedding).toBeUndefined();
    expect(result.searchEmbedding).toEqual(searchEmbedding);
  });

  it("omits searchEmbedding when second embed call fails", async () => {
    const vectorEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const mockEmbed = vi
      .fn()
      .mockResolvedValueOnce(vectorEmbedding)
      .mockRejectedValueOnce(new Error("search failed"));

    const result = await generateProductEmbeddings(makeProduct(), { embed: mockEmbed });

    expect(result.vectorEmbedding).toEqual(vectorEmbedding);
    expect(result.searchEmbedding).toBeUndefined();
  });

  it("returns empty object when both embed calls fail", async () => {
    const mockEmbed = vi.fn().mockRejectedValue(new Error("Vertex AI unavailable"));

    const result = await generateProductEmbeddings(makeProduct(), { embed: mockEmbed });

    expect(result.vectorEmbedding).toBeUndefined();
    expect(result.searchEmbedding).toBeUndefined();
    // Spreading an empty object on the product preserves existing values:
    expect(Object.keys(result)).toHaveLength(0);
  });
});
