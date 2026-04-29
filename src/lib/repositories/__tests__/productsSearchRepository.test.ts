import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Firestore } from "firebase/firestore";
import {
  createProductsSearchRepository,
  isExactMatchCandidate,
} from "@/src/lib/repositories/productsSearchRepository";

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted mocks for the firebase/firestore/pipelines module so we can drive
// the repository entirely without Firestore. Each test inspects what the
// repository asked the pipeline to do (or returns canned results).
// ─────────────────────────────────────────────────────────────────────────────

const { pipelineSpy, executeMock, collectionMock, whereMock, sortMock, offsetMock, limitMock, findNearestMock } =
  vi.hoisted(() => {
    const collectionMock = vi.fn();
    const whereMock = vi.fn();
    const sortMock = vi.fn();
    const offsetMock = vi.fn();
    const limitMock = vi.fn();
    const findNearestMock = vi.fn();
    const pipelineSpy = vi.fn();
    const executeMock = vi.fn();
    return {
      pipelineSpy,
      executeMock,
      collectionMock,
      whereMock,
      sortMock,
      offsetMock,
      limitMock,
      findNearestMock,
    };
  });

vi.mock("firebase/firestore/pipelines", () => {
  // Build a chainable pipeline stub that records every call.
  function buildPipeline() {
    const pipe: Record<string, unknown> = {};
    pipe.collection = (...args: unknown[]) => {
      collectionMock(...args);
      return pipe;
    };
    pipe.where = (...args: unknown[]) => {
      whereMock(...args);
      return pipe;
    };
    pipe.sort = (...args: unknown[]) => {
      sortMock(...args);
      return pipe;
    };
    pipe.offset = (...args: unknown[]) => {
      offsetMock(...args);
      return pipe;
    };
    pipe.limit = (...args: unknown[]) => {
      limitMock(...args);
      return pipe;
    };
    pipe.findNearest = (...args: unknown[]) => {
      findNearestMock(...args);
      return pipe;
    };
    return pipe;
  }

  pipelineSpy.mockImplementation(() => buildPipeline());

  // Stand-ins for the boolean expression builders. We don't inspect the
  // structure of these expressions — they just need to be chainable so
  // `field("x").equal(...)`, `field("price").greaterThanOrEqual(...)`,
  // `.toLower().regexMatch(...)`, `.descending()` and friends work.
  function makeExpression(kind: string, args: unknown[] = []): Record<string, unknown> {
    const expr: Record<string, unknown> = { kind, args };
    const chained = (subKind: string) =>
      (...subArgs: unknown[]) => makeExpression(`${kind}.${subKind}`, subArgs);
    for (const method of [
      "equal",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "greaterThan",
      "lessThan",
      "arrayContains",
      "arrayContainsAny",
      "toLower",
      "regexMatch",
      "descending",
      "ascending",
    ]) {
      expr[method] = chained(method);
    }
    return expr;
  }

  const expressionFactory = (kind: string) =>
    (...args: unknown[]) => makeExpression(kind, args);

  return {
    and: expressionFactory("and"),
    or: expressionFactory("or"),
    arrayContains: expressionFactory("arrayContains"),
    equal: expressionFactory("equal"),
    field: expressionFactory("field"),
    execute: executeMock,
  };
});

// Minimal Firestore stub – the repository only calls `.pipeline()` and
// `collection(...)`/`getDocs(...)` (the latter routed via firebase/firestore).
vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  };
});

vi.mock("@/src/lib/repositories/categoriesRepository", () => ({
  createCategoriesRepository: () => ({
    getBySlug: vi.fn().mockResolvedValue(null),
  }),
}));

function buildFirestoreStub(): Firestore {
  // The repository calls dbInstance.pipeline() to build pipelines. Wire it to
  // our spy so we can drive the chain without running real Firestore.
  return { pipeline: pipelineSpy } as unknown as Firestore;
}

function buildProductDocResult(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: "prod_test_001",
    slug: null,
    title: "Vestido Linho",
    shortTitle: null,
    description: "Vestido em linho.",
    sku: "LURATHA_TEST_001",
    status: "active",
    isPurchasable: true,
    brandName: "Luratha",
    categoryId: "cat_test",
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: {
      price: 200,
      salePrice: null,
      priceMin: 200,
      priceMax: 200,
      currency: "BRL",
      startDate: null,
      endDate: null,
    },
    salePrice: null,
    photoAssets: [],
    lifeStylePhotos: [],
    videoUrls: [],
    variants: null,
    totalStock: 5,
    ratingAverage: 4.5,
    reviewCount: 5,
    vectorEmbedding: null,
    searchEmbedding: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// isExactMatchCandidate
// ─────────────────────────────────────────────────────────────────────────────

describe("isExactMatchCandidate", () => {
  it("returns true for a single token", () => {
    expect(isExactMatchCandidate("LURATHA_1001")).toBe(true);
    expect(isExactMatchCandidate("prod_home_01")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isExactMatchCandidate("   LURATHA_1001   ")).toBe(true);
  });

  it("returns false when the trimmed input contains internal whitespace", () => {
    expect(isExactMatchCandidate("vestido linho")).toBe(false);
    expect(isExactMatchCandidate("  vestido  linho  ")).toBe(false);
    expect(isExactMatchCandidate("vestido\tlinho")).toBe(false);
  });

  it("returns false for empty / whitespace-only input", () => {
    expect(isExactMatchCandidate("")).toBe(false);
    expect(isExactMatchCandidate("   ")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findByIdOrSku
// ─────────────────────────────────────────────────────────────────────────────

describe("productsSearchRepository.findByIdOrSku", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null without querying Firestore for multi-token input", async () => {
    const repo = createProductsSearchRepository(buildFirestoreStub());

    const result = await repo.findByIdOrSku("vestido linho");

    expect(result).toBeNull();
    expect(executeMock).not.toHaveBeenCalled();
    expect(pipelineSpy).not.toHaveBeenCalled();
  });

  it("returns null without querying Firestore for empty input", async () => {
    const repo = createProductsSearchRepository(buildFirestoreStub());

    const result = await repo.findByIdOrSku("   ");

    expect(result).toBeNull();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("issues a single-document pipeline limited to 1 for single-token input", async () => {
    executeMock.mockResolvedValueOnce({ results: [] });
    const repo = createProductsSearchRepository(buildFirestoreStub());

    await repo.findByIdOrSku("LURATHA_1001");

    expect(pipelineSpy).toHaveBeenCalledTimes(1);
    expect(collectionMock).toHaveBeenCalledWith("products");
    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(limitMock).toHaveBeenCalledWith(1);
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("returns the matched product when the pipeline yields one document", async () => {
    const docData = buildProductDocResult({ id: "prod_home_01", sku: "LURATHA_1001" });
    executeMock.mockResolvedValueOnce({
      results: [{ id: "prod_home_01", data: () => docData }],
    });
    const repo = createProductsSearchRepository(buildFirestoreStub());

    const result = await repo.findByIdOrSku("LURATHA_1001");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("prod_home_01");
    expect(result?.sku).toBe("LURATHA_1001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// search() short-circuits on exact match
// ─────────────────────────────────────────────────────────────────────────────

describe("productsSearchRepository.search exact-match short-circuit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the exact match without running the regular pipeline search", async () => {
    const docData = buildProductDocResult({ id: "prod_home_11", sku: "LURATHA_1011" });
    // First pipeline.execute() is the exact-match query → return one doc.
    executeMock.mockResolvedValueOnce({
      results: [{ id: "prod_home_11", data: () => docData }],
    });

    const repo = createProductsSearchRepository(buildFirestoreStub());
    const results = await repo.search({ term: "LURATHA_1011", limit: 24 });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("prod_home_11");
    // Only the exact-match pipeline ran (no second `execute` for the regular search path).
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("falls through to the regular pipeline search when exact match yields nothing", async () => {
    const fallbackDoc = buildProductDocResult({ id: "prod_home_03", title: "Blusa Cropped Algodão" });
    // First execute() = exact-match returns []; second execute() = pipeline search returns one product.
    executeMock
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({
        results: [{ id: "prod_home_03", data: () => fallbackDoc }],
      });

    const repo = createProductsSearchRepository(buildFirestoreStub());
    const results = await repo.search({ term: "blusa", limit: 24 });

    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("prod_home_03");
  });

  it("skips the exact-match short-circuit for multi-token queries", async () => {
    const fallbackDoc = buildProductDocResult({ id: "prod_home_01" });
    // Only the regular pipeline executes for multi-token input.
    executeMock.mockResolvedValueOnce({
      results: [{ id: "prod_home_01", data: () => fallbackDoc }],
    });

    const repo = createProductsSearchRepository(buildFirestoreStub());
    await repo.search({ term: "vestido linho", limit: 24 });

    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("falls through gracefully when the exact-match lookup throws", async () => {
    const fallbackDoc = buildProductDocResult({ id: "prod_home_03" });
    executeMock
      .mockRejectedValueOnce(new Error("transient pipeline error"))
      .mockResolvedValueOnce({
        results: [{ id: "prod_home_03", data: () => fallbackDoc }],
      });

    const repo = createProductsSearchRepository(buildFirestoreStub());
    const results = await repo.search({ term: "blusa", limit: 24 });

    expect(results).toHaveLength(1);
    expect(executeMock).toHaveBeenCalledTimes(2);
  });
});
