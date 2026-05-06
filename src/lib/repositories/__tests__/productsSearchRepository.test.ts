import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirebaseError } from "firebase/app";
import type { Firestore } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted mock state shared by both test groups:
//   1. executeCore fallback tests (this branch + master) — track Firestore SDK
//      calls (collection/query/where/orderBy/limit/getDocs).
//   2. exact-match / pipeline tests (this branch) — track pipeline construction
//      via dbInstance.pipeline() and chainable expression builders.
// ─────────────────────────────────────────────────────────────────────────────

const {
  // Firebase Firestore SDK tracking (executeCore path)
  getDocsMock,
  queryMock,
  orderByCalls,
  whereCalls,
  // Pipeline tracking (executePipelineSearch / findByIdOrSku paths)
  pipelineSpy,
  executeMock,
  collectionMock,
  pipelineWhereMock,
  sortMock,
  offsetMock,
  limitMock,
  findNearestMock,
} = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  queryMock: vi.fn((..._args: unknown[]) => ({ kind: "query" })),
  orderByCalls: [] as Array<{ field: string; direction: string }>,
  whereCalls: [] as Array<{ field: string; op: string; value: unknown }>,
  pipelineSpy: vi.fn(),
  executeMock: vi.fn(),
  collectionMock: vi.fn(),
  pipelineWhereMock: vi.fn(),
  sortMock: vi.fn(),
  offsetMock: vi.fn(),
  limitMock: vi.fn(),
  findNearestMock: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ kind: "collection" })),
  query: queryMock,
  where: vi.fn((field: string, op: string, value: unknown) => {
    whereCalls.push({ field, op, value });
    return { kind: "where", field, op, value };
  }),
  orderBy: vi.fn((field: string, direction: string) => {
    orderByCalls.push({ field, direction });
    return { kind: "orderBy", field, direction };
  }),
  limit: vi.fn(() => ({ kind: "limit" })),
  getDocs: getDocsMock,
  Timestamp: class { toDate() { return new Date(); } },
  VectorValue: class {},
}));

vi.mock("firebase/firestore/pipelines", () => {
  // Chainable pipeline stub. Each method records the call and returns the
  // same pipe so `pipeline().collection(...).where(...).limit(1)` works.
  function buildPipeline() {
    const pipe: Record<string, unknown> = {};
    pipe.collection = (...args: unknown[]) => {
      collectionMock(...args);
      return pipe;
    };
    pipe.where = (...args: unknown[]) => {
      pipelineWhereMock(...args);
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

vi.mock("@/src/lib/repositories/categoriesRepository", () => ({
  createCategoriesRepository: () => ({
    getBySlug: vi.fn(async (slug: string) =>
      slug === "vestidos" ? { id: "cat_vestidos", name: "Vestidos", slug: "vestidos" } : null,
    ),
  }),
}));

vi.mock("@/src/lib/embeddingService", () => ({
  createEmbeddingService: () => ({
    embed: vi.fn(async () => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
  }),
}));

import {
  createProductsSearchRepository,
  isExactMatchCandidate,
} from "@/src/lib/repositories/productsSearchRepository";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function buildExecuteCoreSnapshotDoc(id: string, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id,
    data: () => ({
      id,
      slug: null,
      title: `Produto ${id}`,
      description: `Descrição ${id}`,
      sku: `LURATHA_${id.toUpperCase()}`,
      status: "active",
      isPurchasable: true,
      brandName: "Luratha",
      categoryId: "cat_vestidos",
      tags: [],
      materialTags: [],
      seasonalTags: [],
      price: { price: 100, salePrice: null, priceMin: 100, priceMax: 100, currency: "BRL" },
      totalStock: 5,
      ratingAverage: 4.5,
      reviewCount: 3,
      vectorEmbedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      searchEmbedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      variants: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }),
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
    expect(pipelineWhereMock).toHaveBeenCalledTimes(1);
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

// ─────────────────────────────────────────────────────────────────────────────
// executeCore: missing-index fallback (from master)
// ─────────────────────────────────────────────────────────────────────────────

describe("productsSearchRepository.executeCore", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    queryMock.mockClear();
    orderByCalls.length = 0;
    whereCalls.length = 0;
  });

  it("falls back to in-memory sort when Firestore reports a missing composite index", async () => {
    // First call (ordered query) → fails with FAILED_PRECONDITION.
    // Second call (unordered query) → succeeds with two products in arbitrary order.
    const olderUpdatedAt = "2026-01-01T00:00:00.000Z";
    const newerUpdatedAt = "2026-04-29T00:00:00.000Z";
    getDocsMock
      .mockRejectedValueOnce(
        new FirebaseError("failed-precondition", "The query requires an index. ..."),
      )
      .mockResolvedValueOnce({
        docs: [
          buildExecuteCoreSnapshotDoc("prod_old", { updatedAt: olderUpdatedAt }),
          buildExecuteCoreSnapshotDoc("prod_new", { updatedAt: newerUpdatedAt }),
        ],
      });

    const repo = createProductsSearchRepository({} as never);
    const products = await repo.search({ categorySlug: "vestidos", sort: "newest", limit: 24 });

    // The retry must happen with the same WHERE clauses but no orderBy.
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(orderByCalls).toEqual([{ field: "updatedAt", direction: "desc" }]);

    // Products must come back sorted newest-first regardless of Firestore order.
    expect(products.map((entry) => entry.id)).toEqual(["prod_new", "prod_old"]);
  });

  it("does not fall back when the failure is not a missing-index error", async () => {
    getDocsMock.mockRejectedValueOnce(new Error("network unreachable"));

    const repo = createProductsSearchRepository({} as never);
    await expect(
      repo.search({ categorySlug: "vestidos", sort: "newest", limit: 24 }),
    ).rejects.toThrow();

    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });
});
