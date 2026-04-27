import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/src/app/api/categories/route";

// ── Hoisted mocks (vi.mock is hoisted; variables must be declared via vi.hoisted) ─
const { mockSet, mockGet, mockCollection } = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue({ exists: false });
  const mockDocRef = {
    get: mockGet,
    set: mockSet,
    withConverter: vi.fn(),
  };
  mockDocRef.withConverter.mockReturnValue(mockDocRef);
  const mockDoc = vi.fn().mockReturnValue(mockDocRef);
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
  return { mockSet, mockGet, mockCollection };
});

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimum valid category body (server adds id) */
function buildMinimalCategoryBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Vestidos",
    slug: "vestidos",
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: false });
  });

  it("returns 400 when body is not valid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{",
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.message).toContain("inválido");
  });

  it("returns 400 when body is not an object", async () => {
    const response = await POST(makeRequest([{ name: "Vestidos" }]));
    expect(response.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(makeRequest({ name: "Vestidos" }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.message).toContain("inválidos");
    expect(payload.errors).toBeDefined();
  });

  it("returns 201 and creates category with required fields", async () => {
    const body = buildMinimalCategoryBody();
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const category = await response.json();
    expect(category.id).toBeDefined();
    expect(category.name).toBe("Vestidos");
    expect(category.slug).toBe("vestidos");
    expect(category.parentId).toBeUndefined();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("returns 201 and creates category with optional parentId", async () => {
    const body = buildMinimalCategoryBody({ parentId: "roupas" });
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const category = await response.json();
    expect(category.parentId).toBe("roupas");
  });

  it("returns 409 when category with same id already exists", async () => {
    mockGet.mockResolvedValue({ exists: true });

    const body = buildMinimalCategoryBody();
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.message).toContain("já existe");
  });

  it("auto-generates id regardless of client input", async () => {
    const body = buildMinimalCategoryBody({ id: "client-provided-id" });
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const category = await response.json();
    expect(category.id).toBeTruthy();
    expect(category.id).not.toBe("client-provided-id");
  });
});
