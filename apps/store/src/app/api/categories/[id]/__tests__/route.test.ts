import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "@/src/app/api/categories/[id]/get";
import { PUT } from "@/src/app/api/categories/[id]/put";
import { PATCH } from "@/src/app/api/categories/[id]/patch";
import { DELETE } from "@/src/app/api/categories/[id]/delete";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockSet, mockGet, mockDelete, mockDoc, mockCollection } = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();
  const mockDocRef = {
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
    withConverter: vi.fn(),
  };
  mockDocRef.withConverter.mockReturnValue(mockDocRef); // ← critical: chain returns same ref
  const mockDoc = vi.fn().mockReturnValue(mockDocRef);
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
  return { mockSet, mockGet, mockDelete, mockDoc, mockCollection };
});

vi.mock("@luratha/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_ID = "test-category-id";

/** A minimal valid stored category (as returned by .data() after converter). */
function buildStoredCategory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CATEGORY_ID,
    name: "Vestidos",
    slug: "vestidos",
    ...overrides,
  };
}

/** Minimum valid category body for a full PUT */
function buildPutBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Vestidos",
    slug: "vestidos",
    ...overrides,
  };
}

function makeRequest(method: "PUT" | "PATCH" | "DELETE", body?: unknown): Request {
  return new Request(`http://localhost/api/categories/${CATEGORY_ID}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id = CATEGORY_ID) {
  return { params: Promise.resolve({ id }) };
}

// ── GET tests ─────────────────────────────────────────────────────────────────

describe("GET /api/categories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when category does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await GET(
      new Request(`http://localhost/api/categories/${CATEGORY_ID}`),
      makeParams(),
    );
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toContain("não encontrada");
  });

  it("returns 200 with the category when it exists", async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => buildStoredCategory() });
    const res = await GET(
      new Request(`http://localhost/api/categories/${CATEGORY_ID}`),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const category = await res.json();
    expect(category.id).toBe(CATEGORY_ID);
    expect(category.name).toBe("Vestidos");
  });

  it("passes the correct id to the Firestore doc reference", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredCategory({ id: "custom-id" }),
    });
    await GET(new Request("http://localhost/api/categories/custom-id"), makeParams("custom-id"));
    expect(mockDoc).toHaveBeenCalledWith("custom-id");
  });
});

// ── PUT tests ─────────────────────────────────────────────────────────────────

describe("PUT /api/categories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true, data: () => buildStoredCategory() });
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request(`http://localhost/api/categories/${CATEGORY_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });
    const res = await PUT(req, makeParams());
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.message).toContain("inválido");
  });

  it("returns 404 when category does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await PUT(makeRequest("PUT", buildPutBody()), makeParams());
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toContain("não encontrada");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await PUT(makeRequest("PUT", { name: "Only name" }), makeParams());
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.errors).toBeDefined();
  });

  it("returns 200 and fully replaces the category", async () => {
    const res = await PUT(
      makeRequest("PUT", buildPutBody({ name: "Blusas", slug: "blusas" })),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const category = await res.json();
    expect(category.id).toBe(CATEGORY_ID);
    expect(category.name).toBe("Blusas");
    expect(category.slug).toBe("blusas");
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("ignores id in the body and uses the URL param", async () => {
    const res = await PUT(makeRequest("PUT", buildPutBody({ id: "some-other-id" })), makeParams());
    expect(res.status).toBe(200);
    const category = await res.json();
    expect(category.id).toBe(CATEGORY_ID);
  });

  it("stores category with optional parentId when provided", async () => {
    const res = await PUT(makeRequest("PUT", buildPutBody({ parentId: "roupas" })), makeParams());
    expect(res.status).toBe(200);
    const category = await res.json();
    expect(category.parentId).toBe("roupas");
  });
});

// ── PATCH tests ───────────────────────────────────────────────────────────────

describe("PATCH /api/categories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true, data: () => buildStoredCategory() });
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request(`http://localhost/api/categories/${CATEGORY_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 404 when category does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await PATCH(makeRequest("PATCH", { name: "Blusas" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 and updates only the provided field", async () => {
    const res = await PATCH(makeRequest("PATCH", { name: "Blusas" }), makeParams());
    expect(res.status).toBe(200);
    const category = await res.json();
    expect(category.name).toBe("Blusas");
    expect(category.slug).toBe("vestidos"); // unchanged
  });

  it("does not update a field that is absent from the payload", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredCategory({ parentId: "roupas" }),
    });
    const res = await PATCH(makeRequest("PATCH", { name: "Blusas" }), makeParams());
    expect(res.status).toBe(200);
    const category = await res.json();
    expect(category.parentId).toBe("roupas"); // unchanged
  });

  it("preserves id from the URL parameter", async () => {
    const res = await PATCH(
      makeRequest("PATCH", { id: "attacker-id", name: "Blusas" }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const category = await res.json();
    expect(category.id).toBe(CATEGORY_ID);
  });
});

// ── DELETE tests ──────────────────────────────────────────────────────────────

describe("DELETE /api/categories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true });
  });

  it("returns 404 when category does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toContain("não encontrada");
  });

  it("returns 204 and deletes the category", async () => {
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("passes the correct category id to the Firestore doc reference", async () => {
    await DELETE(makeRequest("DELETE"), makeParams("custom-id-123"));
    expect(mockDoc).toHaveBeenCalledWith("custom-id-123");
  });
});
