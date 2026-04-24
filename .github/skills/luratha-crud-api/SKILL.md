---
name: luratha-crud-api
description: Activate this skill whenever implementing, reviewing, or debugging a CRUD API endpoint for the Luratha project. Covers route structure, Zod validation, Firestore DataConverters, embedding generation with Vertex AI, PATCH partial-update semantics, common pitfalls, and unit-test patterns.
compatibility: Next.js 16 App Router, firebase-admin v13, firebase/firestore v11, Zod v4, Vitest 4, TypeScript strict
---

# CRUD API Guide — Luratha Frontend

## Overview

All product management APIs live under `src/app/api/products/`. Each HTTP method is implemented in its own file and re-exported through a thin `route.ts`. This guide documents the patterns, pitfalls, and examples that apply to building any Firestore-backed CRUD endpoint in this project.

---

## Directory Layout

```
src/app/api/products/
├── __tests__/
│   ├── route.test.ts           # POST unit tests
│   └── list.test.ts            # GET (list) unit tests
├── list.ts                     # GET list handler
├── route.ts                    # exports GET (list) and POST

src/app/api/products/[id]/
├── __tests__/
│   └── route.test.ts           # GET / PUT / PATCH / DELETE unit tests
├── get.ts                      # GET handler (by ID)
├── put.ts                      # PUT handler
├── patch.ts                    # PATCH handler
├── delete.ts                   # DELETE handler
└── route.ts                    # re-exports GET, PUT, PATCH, DELETE
```

The thin `route.ts` in `[id]/` simply re-exports:

```ts
// src/app/api/products/[id]/route.ts
export { runtime, GET } from "./get";
export { PUT } from "./put";
export { PATCH } from "./patch";
export { DELETE } from "./delete";
```

---

## Required Boilerplate for Every Handler

```ts
export const runtime = "nodejs"; // REQUIRED — firebase-admin won't work in Edge runtime
```

All handlers use:

- **`adminDb`** from `@/src/lib/firestore/firebaseAdmin` — bypasses Firestore security rules
- **`adminProductConverter`** from `@/src/lib/firestore/adminProductConverter` — handles VectorValue ↔ `number[]` conversion
- **`validateProduct`** from `@/src/schemas/firestore` — Zod validation
- **`createEmbeddingService`** from `@/src/lib/embeddingService` — Vertex AI embedding

---

## The Firestore DataConverter Pattern

### Why a DataConverter is required

Firestore vector fields must be stored as `VectorValue` (native Firestore type). If you store a plain JavaScript `number[]`, the `findNearest` pipeline operation will **silently return 0 results** — it simply ignores plain arrays.

The DataConverter handles this transparently at the read/write boundary so the rest of the code always deals with plain `number[]`.

### Admin SDK DataConverter (`firebase-admin/firestore`)

```ts
// src/lib/firestore/adminProductConverter.ts
import { type FirestoreDataConverter, FieldValue } from "firebase-admin/firestore";
import { type Product, validateProduct } from "@/src/schemas/firestore";

function extractVector(val: unknown): number[] | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val as number[];
  // Admin SDK does NOT export VectorValue, so duck-type via .toArray()
  if (typeof val === "object" && "toArray" in val && typeof (val as { toArray: unknown }).toArray === "function") {
    const result = (val as { toArray(): unknown }).toArray();
    return Array.isArray(result) ? (result as number[]) : null;
  }
  return null;
}

export const adminProductConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: Product) {
    const { vectorEmbedding, searchEmbedding, ...rest } = product;
    return {
      ...rest,
      vectorEmbedding: vectorEmbedding !== null ? FieldValue.vector(vectorEmbedding) : null,
      searchEmbedding: searchEmbedding !== null ? FieldValue.vector(searchEmbedding) : null,
    };
  },
  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateProduct({
      ...data,
      vectorEmbedding: extractVector(data.vectorEmbedding),
      searchEmbedding: extractVector(data.searchEmbedding),
    });
  },
};
```

### Client SDK DataConverter (`firebase/firestore`)

```ts
// src/lib/firestore/clientProductConverter.ts
import { type FirestoreDataConverter, VectorValue, vector } from "firebase/firestore";
import { type Product, validateProduct } from "@/src/schemas/firestore";

function extractVector(val: unknown): number[] | null {
  if (val === null || val === undefined) return null;
  if (val instanceof VectorValue) return val.toArray(); // client SDK exports VectorValue
  if (Array.isArray(val)) return val as number[];
  return null;
}

export const clientProductConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: Product) {
    const { vectorEmbedding, searchEmbedding, ...rest } = product;
    return {
      ...rest,
      vectorEmbedding: vectorEmbedding !== null ? vector(vectorEmbedding) : null,
      searchEmbedding: searchEmbedding !== null ? vector(searchEmbedding) : null,
    };
  },
  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateProduct({
      ...data,
      vectorEmbedding: extractVector(data.vectorEmbedding),
      searchEmbedding: extractVector(data.searchEmbedding),
    });
  },
};
```

### Usage with `.withConverter()`

```ts
// Admin paths (API routes, seed scripts)
const productRef = adminDb
  .collection(firestoreCollections.products)
  .doc(id)
  .withConverter(adminProductConverter);

await productRef.set(validatedProduct);            // wraps VectorValue automatically
const product = (await productRef.get()).data();   // unwraps VectorValue automatically

// Client paths (repositories called from Server Components or Client Components)
const col = collection(db, firestoreCollections.products).withConverter(clientProductConverter);
```

> **Note:** `productsSearchRepository.ts` uses the Firestore Pipeline API which **does not support** `.withConverter()`. It handles `VectorValue` inline via `instanceof VectorValue` in `normalizeSearchProduct`.

---

## Embedding Generation

### Why not `firebase/ai`?

The `firebase/ai` JS SDK does not expose an embedding API — its `GenerativeModel` supports only `generateContent`/`startChat`.

### Why not Genkit?

`@genkit-ai/vertexai` brings dozens of MB of transitive dependencies (`openai`, `@anthropic-ai/sdk`, `@google-cloud/aiplatform`, etc.) even when only embedding is needed.

### The Right Approach — `embeddingService.ts` + `productEmbeddings.ts`

Use `createEmbeddingService` with `adminApp.options.credential`. This fetches a fresh OAuth token on each call via `credential.getAccessToken()` — no static `VERTEX_AI_ACCESS_TOKEN` env var required.

Products have **two distinct embedding fields** with different purposes:

| Field | Content | Purpose |
|---|---|---|
| `vectorEmbedding` | Title only | Fast name-based similarity lookups |
| `searchEmbedding` | Title + description + categoryId + variant sizes/colors | Full semantic search |

Use `generateProductEmbeddings` from `src/lib/productEmbeddings.ts` to generate both in one call:

```ts
import { createEmbeddingService } from "@/src/lib/embeddingService";
import { generateProductEmbeddings } from "@/src/lib/productEmbeddings";
import { adminApp } from "@/src/lib/firestore/firebaseAdmin";

const embeddingService = createEmbeddingService({
  credential: adminApp.options.credential, // auto-refreshes OAuth token
});

const embeddings = await generateProductEmbeddings(product, embeddingService);
// embeddings = { vectorEmbedding?: number[], searchEmbedding?: number[] }
// Only keys that succeeded are present — spread onto product:
product = { ...product, ...embeddings };
```

`generateProductEmbeddings` uses `Promise.allSettled` internally, so partial failures are handled gracefully — each embedding is independent. Only successfully generated embeddings are returned (as present keys); failed ones are omitted from the result so spreading won't overwrite existing values.

### Embedding is Non-Fatal

Embedding generation must **always** be wrapped in try/catch (in case `createEmbeddingService` itself throws). If Vertex AI is unavailable the product should still be saved:

```ts
try {
  const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
  const embeddings = await generateProductEmbeddings(product, embeddingService);
  product = { ...product, ...embeddings };
} catch (embeddingError) {
  console.warn("[POST /api/products] Embedding generation skipped:", embeddingError);
}
```

### `buildVectorEmbeddingText` and `buildSearchEmbeddingText`

If you need to generate embeddings yourself (e.g., in cloud tests or seed scripts):

```ts
import {
  buildVectorEmbeddingText,
  buildSearchEmbeddingText,
} from "@/src/lib/productEmbeddings";

const vectorText  = buildVectorEmbeddingText(product);  // product.title
const searchText  = buildSearchEmbeddingText(product);  // title + description + category + variants
```

### Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `VERTEX_AI_PROJECT_ID` | GCP project ID | — |
| `VERTEX_AI_LOCATION` | Region | `us-central1` |
| `VERTEX_AI_EMBEDDING_MODEL` | Model | `text-embedding-005` |
| `VERTEX_AI_ACCESS_TOKEN` | Static token (optional, expires in ~1h) | — |

When using `credential`, none of the above are required except `VERTEX_AI_PROJECT_ID`.

---

## CRUD Handler Patterns

### GET by ID — Fetch Single Document

```ts
// src/app/api/products/[id]/get.ts
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const productRef = adminDb
    .collection(firestoreCollections.products)
    .doc(id)
    .withConverter(adminProductConverter);

  const snapshot = await productRef.get();

  if (!snapshot.exists) {
    return NextResponse.json(
      { message: `Produto com id "${id}" não encontrado.` },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot.data(), { status: 200 });
}
```

### GET List — Filter, Paginate, and Search Documents

Reads use `new URL(request.url)` for query-param parsing (works in both production and Vitest — avoid `request.nextUrl` because it is undefined in Vitest's jsdom environment).

#### Simple list (admin SDK query — no `?q=`)

```ts
// src/app/api/products/list.ts
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const q = url.searchParams.get("q")?.trim() || undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const limit = Math.max(1, Math.min(...));

  if (q) {
    // ↓ see Pipeline search section below
    const products = await searchByQuery(q, status, categoryId, limit);
    return NextResponse.json(products, { status: 200 });
  }

  // Build query chain — each call returns a new Query, so chain conditionally:
  const base = adminDb
    .collection(firestoreCollections.products)
    .withConverter(adminProductConverter)
    .orderBy("updatedAt", "desc");

  const withStatus = status ? base.where("status", "==", status) : base;
  const withCategory = categoryId ? withStatus.where("categoryId", "==", categoryId) : withStatus;
  const snapshot = await withCategory.limit(limit).get();

  return NextResponse.json(snapshot.docs.map((d) => d.data()), { status: 200 });
}
```

**Supported query params:**

| Param | Type | Description |
|---|---|---|
| `q` | string | Full-text search term — uses pipeline (title OR sku regex) |
| `status` | string | Filter by product status (`active`, `archived`, …) |
| `categoryId` | string | Filter by category ID |
| `limit` | number | Max results (default 24, max 100) |

> **Firestore index note:** Combining `where()` with `orderBy()` on a different field requires a composite index in production. If deploying to Cloud Firestore (not Emulator), create the index via `firebase.indexes.json` or the Firebase Console.

#### Pipeline search (`?q=` param) — title OR sku

`firebase-admin/firestore` does **not** expose the pipeline API. Use `searchDb` from `src/lib/firestore/firebaseSearchDb.ts` — a server-only anonymous client Firestore instance — and import from `firebase/firestore/pipelines`:

```ts
import { searchDb } from "@/src/lib/firestore/firebaseSearchDb";
import { and, execute, field, or, type BooleanExpression } from "firebase/firestore/pipelines";
import { VectorValue } from "firebase/firestore";

async function searchByQuery(q, status, categoryId, limit) {
  const regex = q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const filters: BooleanExpression[] = [
    or(
      field("title").toLower().regexMatch(regex),
      field("sku").toLower().regexMatch(regex),
    ),
  ];
  if (status)     filters.push(field("status").equal(status));
  if (categoryId) filters.push(field("categoryId").equal(categoryId));

  let pipeline = searchDb.pipeline().collection(firestoreCollections.products);
  pipeline = pipeline.where(combineWithAnd(filters)).limit(limit);
  const snapshot = await execute(pipeline);

  return snapshot.results.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    return validateProduct({
      ...data,
      id: (data.id as string) ?? entry.id ?? "",
      // Unwrap VectorValue — pipeline API does not use withConverter()
      vectorEmbedding: data.vectorEmbedding instanceof VectorValue
        ? data.vectorEmbedding.toArray() : data.vectorEmbedding,
      searchEmbedding: data.searchEmbedding instanceof VectorValue
        ? data.searchEmbedding.toArray() : data.searchEmbedding,
    });
  });
}
```

**`firebaseSearchDb.ts`** — server-only client Firestore for pipeline use:

```ts
// src/lib/firestore/firebaseSearchDb.ts
import "server-only";
import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeServerFirestoreEmulator } from "./emulator";
import { applyEmulatorEnvironmentDefaults, DATABASE_NAME, getFirebaseWebConfig } from "./environment";

const SEARCH_APP_NAME = "luratha-search-server-app";
applyEmulatorEnvironmentDefaults();
const _app = getApps().find((a) => a.name === SEARCH_APP_NAME) ?? initializeApp(getFirebaseWebConfig(), SEARCH_APP_NAME);
export const searchDb = getFirestore(_app, DATABASE_NAME);
initializeServerFirestoreEmulator(searchDb);
```

### POST — Create

```ts
export const runtime = "nodejs";

export async function POST(request: Request) {
  // 1. Parse JSON body (400 on parse error)
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "..." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "..." }, { status: 400 });
  }

  // 2. Server-generated fields
  const now = new Date().toISOString();
  const id = randomUUID();
  const input = { ...(body as Record<string, unknown>), id, createdAt: now, updatedAt: now };

  // 3. Validate with Zod (400 on failure, use error.issues — Zod v4 removed .errors)
  let product;
  try { product = validateProduct(input); }
  catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "...", errors: error.issues }, { status: 400 });
    return NextResponse.json({ message: "..." }, { status: 400 });
  }

  // 4. Generate embeddings (non-fatal) — vectorEmbedding from title, searchEmbedding from rich text
  try {
    const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
    const embeddings = await generateProductEmbeddings(product, embeddingService);
    product = { ...product, ...embeddings };
  } catch { /* skip */ }

  // 5. Check for ID conflict (409)
  const productRef = adminDb.collection(firestoreCollections.products).doc(product.id).withConverter(adminProductConverter);
  const existing = await productRef.get();
  if (existing.exists) return NextResponse.json({ message: "..." }, { status: 409 });

  // 6. Write and respond
  await productRef.set(product);
  return NextResponse.json(product, { status: 201 });
}
```

### PUT — Full Overwrite

Rules:
- `id` is always from the URL parameter (body value is discarded)
- `createdAt` is preserved from the existing document
- `updatedAt` is set to now
- `slug` is stripped before validation so the schema regenerates it from title + SKU
- Embeddings are always regenerated
- Returns 404 if the product does not exist

```ts
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ... parse body ...

  const productRef = adminDb.collection(firestoreCollections.products).doc(id).withConverter(adminProductConverter);
  const existing = await productRef.get();
  if (!existing.exists) return NextResponse.json({ message: "..." }, { status: 404 });

  const existingData = existing.data()!;
  const now = new Date().toISOString();

  const input: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
    id,
    createdAt: existingData.createdAt, // preserve original
    updatedAt: now,
  };

  // Strip slug so schema regenerates it
  const { slug: _slug, ...inputWithoutSlug } = input;
  let product = validateProduct(inputWithoutSlug);

  // Regenerate embeddings unconditionally — vectorEmbedding (title) + searchEmbedding (rich text)
  try {
    const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
    const embeddings = await generateProductEmbeddings(product, embeddingService);
    product = { ...product, ...embeddings };
  } catch { /* skip */ }

  await productRef.set(product);
  return NextResponse.json(product, { status: 200 });
}
```

### PATCH — Partial Update

Rules (critical — must be exactly this semantics):

| Field in payload | Action |
|---|---|
| **Absent** | Kept unchanged from stored document |
| **Present with `null`** | Set to `null` |
| **Present with a value** | Updated to that value |

`id` and `createdAt` are always forced from the stored document. Embeddings are only regenerated when `title` or `description` appear in the payload.

```ts
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ... parse body ...

  const productRef = adminDb.collection(firestoreCollections.products).doc(id).withConverter(adminProductConverter);
  const existing = await productRef.get();
  if (!existing.exists) return NextResponse.json({ message: "..." }, { status: 404 });

  const existingData = existing.data()!;
  const payload = body as Record<string, unknown>;
  const now = new Date().toISOString();

  // Spread order is critical: existingData first, then payload, then server-controlled fields
  const merged: Record<string, unknown> = {
    ...existingData,
    ...payload,          // only keys present in payload are overwritten
    id,                  // always from URL
    createdAt: existingData.createdAt, // always from stored doc
    updatedAt: now,
  };

  // Strip slug so schema always regenerates it
  const { slug: _slug, ...mergedWithoutSlug } = merged;
  let product = validateProduct(mergedWithoutSlug);

  // Only regenerate embeddings when text content may have changed
  const embeddingFieldsChanged = "title" in payload || "description" in payload;
  if (embeddingFieldsChanged) {
    try {
      const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
      const embeddings = await generateProductEmbeddings(product, embeddingService);
      // Spread only succeeded embeddings — existing embeddings are preserved if generation fails
      product = { ...product, ...embeddings };
    } catch { /* skip */ }
  }

  await productRef.set(product);
  return NextResponse.json(product, { status: 200 });
}
```

> **PATCH pitfall:** Using `Object.assign` or a deep merge library will lose the null/absent distinction. The spread pattern above is the correct approach.

### DELETE — Remove Document

```ts
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const productRef = adminDb.collection(firestoreCollections.products).doc(id);
  const existing = await productRef.get();
  if (!existing.exists) return NextResponse.json({ message: "..." }, { status: 404 });

  await productRef.delete();
  return new NextResponse(null, { status: 204 }); // No Content — do NOT use NextResponse.json()
}
```

---

## Slug Handling

The product schema auto-generates `slug` from `title` + `sku` via a Zod `transform`. **Never pass an existing slug when re-validating** after a PUT or PATCH — it will cause a validation error because the slug in the payload may not match the newly computed one.

Always strip it before calling `validateProduct`:

```ts
const { slug: _slug, ...inputWithoutSlug } = input;
const product = validateProduct(inputWithoutSlug);
// product.slug is now correctly regenerated
```

---

## Zod v4 — Use `error.issues`, not `error.errors`

Zod v4 removed the `.errors` alias. Always use `.issues`:

```ts
if (error instanceof z.ZodError) {
  return NextResponse.json({ message: "...", errors: error.issues }, { status: 400 });
}
```

---

## Unit Test Patterns

All API route unit tests live in `src/app/api/**/__tests__/route.test.ts` and use Vitest.

### GET list (collection) mock setup

The query chain (`.withConverter().orderBy().where().limit()`) must be mocked to return the same `mockQueryRef` object. When using `?q=` (pipeline search), also mock `firebase/firestore/pipelines` and `@/src/lib/firestore/firebaseSearchDb`:

```ts
const { mockQueryGet, mockQueryRef, mockCollection, mockExecute, mockPipelineRef } = vi.hoisted(() => {
  const mockQueryGet = vi.fn();
  const mockQueryRef = { withConverter: vi.fn(), orderBy: vi.fn(), where: vi.fn(), limit: vi.fn(), get: mockQueryGet };
  mockQueryRef.withConverter.mockReturnValue(mockQueryRef);
  mockQueryRef.orderBy.mockReturnValue(mockQueryRef);
  mockQueryRef.where.mockReturnValue(mockQueryRef);
  mockQueryRef.limit.mockReturnValue(mockQueryRef);
  const mockCollection = vi.fn().mockReturnValue(mockQueryRef);

  // Pipeline mocks
  const mockExecute = vi.fn();
  const mockPipelineRef = { collection: vi.fn(), where: vi.fn(), limit: vi.fn() };
  mockPipelineRef.collection.mockReturnValue(mockPipelineRef);
  mockPipelineRef.where.mockReturnValue(mockPipelineRef);
  mockPipelineRef.limit.mockReturnValue(mockPipelineRef);

  return { mockQueryGet, mockQueryRef, mockCollection, mockExecute, mockPipelineRef };
});

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

vi.mock("@/src/lib/firestore/firebaseSearchDb", () => ({
  searchDb: { pipeline: vi.fn(() => mockPipelineRef) },
}));

vi.mock("firebase/firestore/pipelines", () => ({
  execute: mockExecute,
  field: vi.fn(() => ({ toLower: vi.fn().mockReturnThis(), regexMatch: vi.fn().mockReturnThis(), equal: vi.fn().mockReturnThis() })),
  or: vi.fn((...args) => ({ type: "or", args })),
  and: vi.fn((...args) => ({ type: "and", args })),
}));

// In beforeEach, reset pipeline chain:
mockPipelineRef.collection.mockReturnValue(mockPipelineRef);
mockPipelineRef.where.mockReturnValue(mockPipelineRef);
mockPipelineRef.limit.mockReturnValue(mockPipelineRef);
mockExecute.mockResolvedValue({ results: [] });

// Simulate pipeline results:
mockExecute.mockResolvedValue({
  results: [{ id: "prod-1", data: () => buildStoredProduct() }],
});

// Check pipeline was used for ?q= search:
expect(mockExecute).toHaveBeenCalledTimes(1);
expect(mockQueryGet).not.toHaveBeenCalled(); // admin SDK query should NOT run
```

> **Note:** Use `new URL(request.url)` for query params in the handler — `request.nextUrl` is undefined in Vitest's jsdom environment.

> **`server-only` in tests:** `firebaseSearchDb.ts` has `import "server-only"`. The Vitest config (`vitest.config.mts`) aliases `server-only` to `src/test/__mocks__/server-only.ts` (an empty file). This prevents the build-time guard from throwing in tests. Add the same alias if you introduce other `server-only` modules that are imported in testable paths.

### Key mock setup

The Firestore `withConverter` chain must be mocked to return the same `mockDocRef` object:

```ts
const { mockSet, mockGet, mockDelete, mockDoc, mockCollection, mockEmbed } = vi.hoisted(() => {
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
  const mockEmbed = vi.fn();
  return { mockSet, mockGet, mockDelete, mockDoc, mockCollection, mockEmbed };
});

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

vi.mock("@/src/lib/embeddingService", () => ({
  createEmbeddingService: vi.fn(() => ({ embed: mockEmbed })),
}));
```

### Simulating stored product for PUT/PATCH/DELETE

```ts
function buildStoredProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PRODUCT_ID,
    title: "Vestido de Linho Artesanal",
    description: "Vestido leve feito com linho natural de alta qualidade, perfeito para o verão.",
    slug: "vestido-de-linho-artesanal-vla-001-br",
    sku: "VLA-001-BR",
    status: "active",
    categoryId: "vestidos",
    price: { price: 250, currency: "BRL", salePrice: null, priceMin: null, priceMax: null, startDate: null, endDate: null },
    // ... all required schema fields ...
    ...overrides,
  };
}

// In test:
mockGet.mockResolvedValue({ exists: true, data: () => buildStoredProduct() });
```

### Request factory for [id] routes

```ts
function makeRequest(method: string, body: unknown): Request {
  return new Request(`http://localhost/api/products/${PRODUCT_ID}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Params are async in Next.js 16:
const params = Promise.resolve({ id: PRODUCT_ID });
const response = await PUT(makeRequest("PUT", body), { params });
```

### PATCH null/absent distinction test

```ts
it("sets field to null when payload contains null", async () => {
  mockGet.mockResolvedValue({ exists: true, data: () => buildStoredProduct({ shortTitle: "Vestido Bonito" }) });
  const response = await PATCH(makeRequest("PATCH", { shortTitle: null }), { params });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.shortTitle).toBeNull();
});

it("does not change field when it is absent from payload", async () => {
  mockGet.mockResolvedValue({ exists: true, data: () => buildStoredProduct({ shortTitle: "Vestido Bonito" }) });
  const response = await PATCH(makeRequest("PATCH", { status: "inactive" }), { params });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.shortTitle).toBe("Vestido Bonito"); // unchanged
});
```

---

## Common Pitfalls

### 1. Missing `export const runtime = "nodejs"`

Without this, Next.js may attempt to run the route in the Edge runtime where `firebase-admin` is not available.

### 2. VectorValue stored as plain array

Calling `adminDb.collection(...).doc(id).set({ ...product })` without `.withConverter(adminProductConverter)` will store `vectorEmbedding` as a plain JavaScript array. The `findNearest` pipeline operation will silently return 0 results. Always use `.withConverter(adminProductConverter)`.

### 3. `VectorValue` not exportable from admin SDK

The `firebase-admin/firestore` package does **not** export `VectorValue` as a class, so `instanceof VectorValue` will throw at runtime in admin code. Use duck-typing via `.toArray()` instead (see `adminProductConverter.ts`).

### 4. Slug validation mismatch on re-validate

When updating an existing product, the stored `slug` may not match what the schema would generate from the current title + sku. Always strip `slug` before passing to `validateProduct`. The schema will regenerate it.

### 5. Zod v4 `.errors` removed

Use `error.issues`, not `error.errors`. In Zod v4, the `.errors` alias was removed.

### 6. PATCH merge order matters

The correct merge order is `{ ...existingData, ...payload, ...serverFields }`. Reversing `existingData` and `payload` will make payload fields be silently overwritten.

### 7. 204 No Content response

Use `new NextResponse(null, { status: 204 })`, **not** `NextResponse.json(null, { status: 204 })`. The `json()` helper adds a `Content-Type: application/json` header and may set a non-null body, which violates HTTP 204 semantics.

### 8. Do NOT set `vectorEmbedding` and `searchEmbedding` to the same value

Both embedding fields serve different purposes and must be generated from different text:
- `vectorEmbedding` = title only (simple, for name-based similarity)
- `searchEmbedding` = title + description + categoryId + variant sizes/colors (rich, for semantic search)

Use `generateProductEmbeddings` from `src/lib/productEmbeddings.ts` — it generates both correctly in one call.

### 9. `server-only` modules in tests

Files with `import "server-only"` (like `firebaseSearchDb.ts`) will break Vitest unless the alias is configured in `vitest.config.mts`. The alias is already set:

```ts
// vitest.config.mts
resolve: {
  alias: {
    "server-only": path.resolve(__dirname, "src/test/__mocks__/server-only.ts"),
  },
},
```

If you add a new `server-only` module that gets imported (directly or transitively) in any test file, make sure the alias handles it.

---

## Response Status Codes Summary

| Scenario | Status |
|---|---|
| Successful fetch (GET by ID) | `200 OK` |
| Successful list (GET collection) | `200 OK` |
| Successful creation | `201 Created` |
| Successful update (PUT/PATCH) | `200 OK` |
| Successful deletion | `204 No Content` |
| Invalid JSON body | `400 Bad Request` |
| Zod validation failure | `400 Bad Request` (with `errors: issue[]`) |
| Document not found (GET/PUT/PATCH/DELETE) | `404 Not Found` |
| ID conflict (POST) | `409 Conflict` |

---

## File References

| File | Purpose |
|---|---|
| `src/app/api/products/route.ts` | GET (list) and POST handlers |
| `src/app/api/products/list.ts` | GET list handler (simple query + `?q=` pipeline search) |
| `src/app/api/products/[id]/route.ts` | Re-exports GET, PUT, PATCH, DELETE |
| `src/app/api/products/[id]/get.ts` | GET handler (fetch by ID) |
| `src/app/api/products/[id]/put.ts` | PUT handler |
| `src/app/api/products/[id]/patch.ts` | PATCH handler |
| `src/app/api/products/[id]/delete.ts` | DELETE handler |
| `src/lib/productEmbeddings.ts` | `generateProductEmbeddings`, `buildVectorEmbeddingText`, `buildSearchEmbeddingText` |
| `src/lib/firestore/adminProductConverter.ts` | Admin SDK DataConverter |
| `src/lib/firestore/clientProductConverter.ts` | Client SDK DataConverter |
| `src/lib/firestore/firebaseSearchDb.ts` | Server-only client Firestore for pipeline search |
| `src/lib/embeddingService.ts` | Vertex AI embedding service |
| `src/lib/firestore/firebaseAdmin.ts` | `adminDb`, `adminApp`, `adminStorage` |
| `src/schemas/firestore/products.ts` | Zod product schema + `validateProduct` |
| `src/schemas/firestore/index.ts` | `firestoreCollections` + all schema exports |
| `src/test/__mocks__/server-only.ts` | Empty no-op mock for `server-only` in Vitest |
