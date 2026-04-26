import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "@/src/app/api/categories/list";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockQueryGet, mockQueryRef, mockCollection } = vi.hoisted(() => {
  const mockQueryGet = vi.fn();
  const mockQueryRef = {
    withConverter: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    get: mockQueryGet,
  };
  // All chain methods return the same ref so `.orderBy(...).where(...).limit(...)` works
  mockQueryRef.withConverter.mockReturnValue(mockQueryRef);
  mockQueryRef.orderBy.mockReturnValue(mockQueryRef);
  mockQueryRef.where.mockReturnValue(mockQueryRef);
  mockQueryRef.limit.mockReturnValue(mockQueryRef);

  const mockCollection = vi.fn().mockReturnValue(mockQueryRef);

  return { mockQueryGet, mockQueryRef, mockCollection };
});

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_ID = "test-category-id";

function buildStoredCategory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CATEGORY_ID,
    name: "Vestidos",
    slug: "vestidos",
    ...overrides,
  };
}

function makeListRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/categories");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: "GET" });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRef.withConverter.mockReturnValue(mockQueryRef);
    mockQueryRef.orderBy.mockReturnValue(mockQueryRef);
    mockQueryRef.where.mockReturnValue(mockQueryRef);
    mockQueryRef.limit.mockReturnValue(mockQueryRef);
    mockQueryGet.mockResolvedValue({ docs: [] });
  });

  it("returns 200 with an empty array when no categories exist", async () => {
    const res = await GET(makeListRequest());
    expect(res.status).toBe(200);
    const categories = await res.json();
    expect(categories).toEqual([]);
  });

  it("returns 200 with an array of categories", async () => {
    const stored = buildStoredCategory();
    mockQueryGet.mockResolvedValue({ docs: [{ data: () => stored }] });
    const res = await GET(makeListRequest());
    expect(res.status).toBe(200);
    const categories = await res.json();
    expect(categories).toHaveLength(1);
    expect(categories[0].id).toBe(CATEGORY_ID);
    expect(categories[0].name).toBe("Vestidos");
  });

  it("applies parentId filter when parentId query param is provided", async () => {
    mockQueryGet.mockResolvedValue({ docs: [] });
    await GET(makeListRequest({ parentId: "roupas" }));
    expect(mockQueryRef.where).toHaveBeenCalledWith("parentId", "==", "roupas");
  });

  it("does not call where when no parentId param is provided", async () => {
    await GET(makeListRequest());
    expect(mockQueryRef.where).not.toHaveBeenCalled();
  });

  it("applies default limit of 100 when no limit is specified", async () => {
    await GET(makeListRequest());
    expect(mockQueryRef.limit).toHaveBeenCalledWith(100);
  });

  it("applies custom limit from query param", async () => {
    await GET(makeListRequest({ limit: "10" }));
    expect(mockQueryRef.limit).toHaveBeenCalledWith(10);
  });

  it("caps limit at 500", async () => {
    await GET(makeListRequest({ limit: "9999" }));
    expect(mockQueryRef.limit).toHaveBeenCalledWith(500);
  });

  it("orders results by name ascending", async () => {
    await GET(makeListRequest());
    expect(mockQueryRef.orderBy).toHaveBeenCalledWith("name", "asc");
  });
});
