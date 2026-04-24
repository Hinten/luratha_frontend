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
│   └── route.test.ts           # POST unit tests
├── route.ts                    # exports POST

src/app/api/products/[id]/
├── __tests__/
│   └── route.test.ts           # PUT / PATCH / DELETE unit tests
├── put.ts                      # PUT handler
├── patch.ts                    # PATCH handler
├── delete.ts                   # DELETE handler
└── route.ts                    # re-exports PUT, PATCH, DELETE
```

The thin `route.ts` in `[id]/` simply re-exports:

```ts
// src/app/api/products/[id]/route.ts
export { runtime, PUT } from "./put";
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

### The Right Approach — `embeddingService.ts`

Use `createEmbeddingService` with `adminApp.options.credential`. This fetches a fresh OAuth token on each call via `credential.getAccessToken()` — no static `VERTEX_AI_ACCESS_TOKEN` env var required.

```ts
import { createEmbeddingService } from "@/src/lib/embeddingService";
import { adminApp } from "@/src/lib/firestore/firebaseAdmin";

const embeddingService = createEmbeddingService({
  credential: adminApp.options.credential, // auto-refreshes OAuth token
});

const embedding = await embeddingService.embed(`${product.title} ${product.description}`);
// → number[] (up to 2048 dimensions, text-embedding-005)
```

### Embedding is Non-Fatal

Embedding generation must **always** be wrapped in try/catch. If Vertex AI is unavailable (e.g., development without service account), the product should still be saved without embeddings:

```ts
try {
  const embedding = await embeddingService.embed(embeddingText);
  product = { ...product, vectorEmbedding: embedding, searchEmbedding: embedding };
} catch (embeddingError) {
  console.warn("[POST /api/products] Embedding generation skipped:", embeddingError);
}
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

  // 4. Generate embeddings (non-fatal)
  try {
    const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
    const embedding = await embeddingService.embed(`${product.title} ${product.description}`);
    product = { ...product, vectorEmbedding: embedding, searchEmbedding: embedding };
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

  // Regenerate embeddings unconditionally
  try {
    const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
    const embedding = await embeddingService.embed(`${product.title} ${product.description}`);
    product = { ...product, vectorEmbedding: embedding, searchEmbedding: embedding };
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
      const embedding = await embeddingService.embed(`${product.title} ${product.description}`);
      product = { ...product, vectorEmbedding: embedding, searchEmbedding: embedding };
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

---

## Response Status Codes Summary

| Scenario | Status |
|---|---|
| Successful creation | `201 Created` |
| Successful update (PUT/PATCH) | `200 OK` |
| Successful deletion | `204 No Content` |
| Invalid JSON body | `400 Bad Request` |
| Zod validation failure | `400 Bad Request` (with `errors: issue[]`) |
| Document not found (PUT/PATCH/DELETE) | `404 Not Found` |
| ID conflict (POST) | `409 Conflict` |

---

## File References

| File | Purpose |
|---|---|
| `src/app/api/products/route.ts` | POST handler |
| `src/app/api/products/[id]/put.ts` | PUT handler |
| `src/app/api/products/[id]/patch.ts` | PATCH handler |
| `src/app/api/products/[id]/delete.ts` | DELETE handler |
| `src/app/api/products/[id]/route.ts` | Re-exports PUT, PATCH, DELETE |
| `src/lib/firestore/adminProductConverter.ts` | Admin SDK DataConverter |
| `src/lib/firestore/clientProductConverter.ts` | Client SDK DataConverter |
| `src/lib/embeddingService.ts` | Vertex AI embedding service |
| `src/lib/firestore/firebaseAdmin.ts` | `adminDb`, `adminApp`, `adminStorage` |
| `src/schemas/firestore/products.ts` | Zod product schema + `validateProduct` |
| `src/schemas/firestore/index.ts` | `firestoreCollections` + all schema exports |
