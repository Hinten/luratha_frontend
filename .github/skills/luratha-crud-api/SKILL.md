---
name: luratha-crud-api
description: Activate this skill whenever implementing, reviewing, or debugging a CRUD API endpoint for the Luratha project. Covers route structure, Zod validation, Firestore DataConverters, embedding generation with Vertex AI, PATCH partial-update semantics, common pitfalls, and unit-test patterns. Applies to any Firestore-backed entity, not just products.
compatibility: Next.js 16 App Router, firebase-admin v13, firebase/firestore v11, Zod v4, Vitest 4, TypeScript strict
---

# CRUD API Guide — Luratha Frontend

## Overview

This guide covers the patterns for building any Firestore-backed CRUD API in this project. The examples below use **products** as the reference entity, but every pattern applies to any schema — replace `product`/`Product`/`products` with your entity name throughout.

Each HTTP method lives in its own file and is re-exported through a thin `route.ts`. The collection name, Zod schema, DataConverter, and (optionally) embedding helper are the only entity-specific pieces to supply.

**Pipeline search (`?q=`) is mandatory** for every entity that has user-facing text fields. The implementation varies by entity type:

- **Entity without vector fields** (e.g. categories): search by `name` and `slug`. Reference: `src/app/api/categories/list.ts`.
- **Entity with vector fields** (e.g. products): search by the same text fields used for embeddings (e.g. `title` + `sku`). Reference: `src/app/api/products/list.ts`.

**Naming conventions** (substitute your entity name):

| Placeholder                       | Example for products            |
| --------------------------------- | ------------------------------- |
| `{entity}`                        | `product`                       |
| `{Entity}`                        | `Product`                       |
| `{entities}`                      | `products`                      |
| `src/app/api/{entities}/`         | `src/app/api/products/`         |
| `admin{Entity}Converter`          | `adminProductConverter`         |
| `validate{Entity}`                | `validateProduct`               |
| `firestoreCollections.{entities}` | `firestoreCollections.products` |

---

## Directory Layout

```
src/app/api/{entities}/
├── __tests__/
│   ├── route.test.ts           # POST unit tests
│   └── list.test.ts            # GET (list) unit tests
├── list.ts                     # GET list handler
├── route.ts                    # exports GET (list) and POST

src/app/api/{entities}/[id]/
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
// src/app/api/{entities}/[id]/route.ts
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
- **`admin{Entity}Converter`** from `@/src/lib/firestore/admin{Entity}Converter` — handles special Firestore types (VectorValue, Timestamp) ↔ plain JS conversion
- **`validate{Entity}`** from `@/src/schemas/firestore` — Zod validation
- **`createEmbeddingService`** from `@/src/lib/embeddingService` — Vertex AI embedding _(only when the entity has vector fields)_

---

## The Firestore DataConverter Pattern

### Why a DataConverter is required

Firestore stores some types natively (e.g. `Timestamp`, `VectorValue`) that have no equivalent in plain JavaScript. A DataConverter converts between the Firestore representation and the plain JS/TypeScript type your Zod schema expects at the read/write boundary.

Two specific cases relevant to this codebase:

- **`Timestamp`** fields (e.g. `createdAt`, `updatedAt`) — stored as Firestore Timestamps, must be converted to ISO strings for Zod.
- **Vector fields** (e.g. `vectorEmbedding`, `searchEmbedding`) — stored as `VectorValue`; if stored as a plain `number[]`, `findNearest` will **silently return 0 results**.

Every entity with `Timestamp` or vector fields **must** use a DataConverter. Entities with neither can use a simpler converter that only calls `validate{Entity}`.

### Admin SDK DataConverter (`firebase-admin/firestore`)

```ts
// src/lib/firestore/admin{Entity}Converter.ts
import { type FirestoreDataConverter, FieldValue, Timestamp } from "firebase-admin/firestore";
import { type {Entity}, validate{Entity} } from "@/src/schemas/firestore";

// Converts Firestore Timestamp → ISO string; falls through for strings (tests)
function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === "object" && val !== null && "toDate" in val &&
      typeof (val as { toDate: unknown }).toDate === "function") {
    return (val as { toDate(): Date }).toDate().toISOString();
  }
  return val;
}

// Only needed for entities with vector fields:
// Admin SDK does NOT export VectorValue, so duck-type via .toArray()
function extractVector(val: unknown): number[] | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val as number[];
  if (typeof val === "object" && "toArray" in val && typeof (val as { toArray: unknown }).toArray === "function") {
    const result = (val as { toArray(): unknown }).toArray();
    return Array.isArray(result) ? (result as number[]) : null;
  }
  return null;
}

export const admin{Entity}Converter: FirestoreDataConverter<{Entity}> = {
  toFirestore(entity: {Entity}) {
    // Destructure every field that needs conversion; spread the rest unchanged
    const { createdAt, updatedAt, /* vectorField, */ ...rest } = entity;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
      // For vector fields:
      // vectorField: vectorField !== null ? FieldValue.vector(vectorField) : null,
    };
  },
  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validate{Entity}({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
      // For vector fields:
      // vectorField: extractVector(data.vectorField),
    });
  },
};
```

**Product example** (entity with both Timestamps and two vector fields):

```ts
// src/lib/firestore/adminProductConverter.ts
export const adminProductConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: Product) {
    const { vectorEmbedding, searchEmbedding, createdAt, updatedAt, ...rest } = product;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
      vectorEmbedding: vectorEmbedding !== null ? FieldValue.vector(vectorEmbedding) : null,
      searchEmbedding: searchEmbedding !== null ? FieldValue.vector(searchEmbedding) : null,
    };
  },
  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateProduct({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
      vectorEmbedding: extractVector(data.vectorEmbedding),
      searchEmbedding: extractVector(data.searchEmbedding),
    });
  },
};
```

### Client SDK DataConverter (`firebase/firestore`)

```ts
// src/lib/firestore/client{Entity}Converter.ts
import { type FirestoreDataConverter, VectorValue, vector, Timestamp } from "firebase/firestore";
import { type {Entity}, validate{Entity} } from "@/src/schemas/firestore";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

// Only needed for entities with vector fields:
function extractVector(val: unknown): number[] | null {
  if (val === null || val === undefined) return null;
  if (val instanceof VectorValue) return val.toArray(); // client SDK exports VectorValue
  if (Array.isArray(val)) return val as number[];
  return null;
}

export const client{Entity}Converter: FirestoreDataConverter<{Entity}> = {
  toFirestore(entity: {Entity}) {
    const { createdAt, updatedAt, /* vectorField, */ ...rest } = entity;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
      // vectorField: vectorField !== null ? vector(vectorField) : null,
    };
  },
  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validate{Entity}({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
      // vectorField: extractVector(data.vectorField),
    });
  },
};
```

### Usage with `.withConverter()`

```ts
// Admin paths (API routes, seed scripts)
const entityRef = adminDb
  .collection(firestoreCollections.{entities})
  .doc(id)
  .withConverter(admin{Entity}Converter);

await entityRef.set(validatedEntity);            // wraps Timestamps/VectorValues automatically
const entity = (await entityRef.get()).data();   // unwraps them automatically

// Client paths (repositories called from Server Components or Client Components)
const col = collection(db, firestoreCollections.{entities}).withConverter(client{Entity}Converter);
```

> **Note:** The Firestore Pipeline API does **not** support `.withConverter()`. When using pipelines for search, handle type conversions inline (e.g. `instanceof VectorValue` checks) as done in `productsSearchRepository.ts`.

---

## Embedding Generation

> **This section applies only to entities that require semantic/vector search.** If your entity has no `vectorEmbedding` or `searchEmbedding` fields, skip this section entirely.

### Why not `firebase/ai`?

The `firebase/ai` JS SDK does not expose an embedding API — its `GenerativeModel` supports only `generateContent`/`startChat`.

### Why not Genkit?

`@genkit-ai/vertexai` brings dozens of MB of transitive dependencies (`openai`, `@anthropic-ai/sdk`, `@google-cloud/aiplatform`, etc.) even when only embedding is needed.

### The Right Approach — `embeddingService.ts` + an entity-specific embeddings helper

Use `createEmbeddingService` with `adminApp.options.credential`. This fetches a fresh OAuth token on each call via `credential.getAccessToken()` — no static `VERTEX_AI_ACCESS_TOKEN` env var required.

**Determine the embedding fields your entity needs.** For products, two fields are used:

| Field             | Content                                                 | Purpose                            |
| ----------------- | ------------------------------------------------------- | ---------------------------------- |
| `vectorEmbedding` | Title only                                              | Fast name-based similarity lookups |
| `searchEmbedding` | Title + description + categoryId + variant sizes/colors | Full semantic search               |

If your entity only needs one embedding field, create a simpler helper that generates just that field. Use `src/lib/productEmbeddings.ts` as a reference implementation.

```ts
// Example: using the product embedding helper
import { createEmbeddingService } from "@/src/lib/embeddingService";
import { generateProductEmbeddings } from "@/src/lib/productEmbeddings";
import { adminApp } from "@/src/lib/firestore/firebaseAdmin";

const embeddingService = createEmbeddingService({
  credential: adminApp.options.credential, // auto-refreshes OAuth token
});

const embeddings = await generateProductEmbeddings(entity, embeddingService);
// Returns only keys that succeeded — spread onto entity:
entity = { ...entity, ...embeddings };
```

The helper must use `Promise.allSettled` so each field is independent — a failure on one field does not block the others. Only successfully generated embeddings are returned.

### Embedding is Non-Fatal

Embedding generation must **always** be wrapped in try/catch. If Vertex AI is unavailable, the entity should still be saved:

```ts
try {
  const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
  const embeddings = await generate{Entity}Embeddings(entity, embeddingService);
  entity = { ...entity, ...embeddings };
} catch (embeddingError) {
  console.warn("[POST /api/{entities}] Embedding generation skipped:", embeddingError);
}
```

### Environment Variables

| Variable                    | Purpose                                 | Default              |
| --------------------------- | --------------------------------------- | -------------------- |
| `VERTEX_AI_PROJECT_ID`      | GCP project ID                          | —                    |
| `VERTEX_AI_LOCATION`        | Region                                  | `us-central1`        |
| `VERTEX_AI_EMBEDDING_MODEL` | Model                                   | `text-embedding-005` |
| `VERTEX_AI_ACCESS_TOKEN`    | Static token (optional, expires in ~1h) | —                    |

When using `credential`, none of the above are required except `VERTEX_AI_PROJECT_ID`.

---

## CRUD Handler Patterns

### GET by ID — Fetch Single Document

```ts
// src/app/api/{entities}/[id]/get.ts
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const entityRef = adminDb
    .collection(firestoreCollections.{entities})
    .doc(id)
    .withConverter(admin{Entity}Converter);

  const snapshot = await entityRef.get();

  if (!snapshot.exists) {
    return NextResponse.json(
      { message: `{Entity} com id "${id}" não encontrado.` },
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
// src/app/api/{entities}/list.ts
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const q = url.searchParams.get("q")?.trim() || undefined;
  // Add entity-specific filter params here (e.g. status, categoryId)
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Math.max(1, Math.min(/* max */, parseInt(url.searchParams.get("limit") ?? "24", 10)));

  if (q) {
    // ↓ see Pipeline search section below (only if entity supports full-text search)
    const items = await searchByQuery(q, status, limit);
    return NextResponse.json(items, { status: 200 });
  }

  // Build query chain — each call returns a new Query, so chain conditionally:
  const base = adminDb
    .collection(firestoreCollections.{entities})
    .withConverter(admin{Entity}Converter)
    .orderBy("updatedAt", "desc");

  const withStatus = status ? base.where("status", "==", status) : base;
  const snapshot = await withStatus.limit(limit).get();

  return NextResponse.json(snapshot.docs.map((d) => d.data()), { status: 200 });
}
```

**Adapt the supported query params to the entity's filterable fields:**

| Param    | Type   | Description                                                 |
| -------- | ------ | ----------------------------------------------------------- |
| `q`      | string | Full-text search term — uses pipeline (regex on key fields) |
| `status` | string | Filter by a status field (if present in schema)             |
| `limit`  | number | Max results (default 24, max 100)                           |

> **Firestore index note:** Combining `where()` with `orderBy()` on a different field requires a composite index in production. Create the index via `firestore.indexes.json` or the Firebase Console.

#### Pipeline search (`?q=` param)

> **`?q=` pipeline search is mandatory for every entity that has searchable text fields** (e.g. `name`, `title`, `slug`, `code`, `sku`). This applies even when the entity has **no** vector embedding fields. Omit pipeline search only for purely system/reference collections that are never searched by human users (e.g. internal config documents).
>
> **For entities without vector fields**, search by `name` and `slug` (or whichever text fields are meaningful for users). See `src/app/api/categories/list.ts` as the canonical reference.
>
> **For entities with vector fields**, search by the rich text fields used for embeddings (e.g. `title` and `sku` for products). See `src/app/api/products/list.ts`.

`firebase-admin/firestore` does **not** expose the pipeline API. Use `searchDb` from `src/lib/firestore/firebaseSearchDb.ts` — a server-only anonymous client Firestore instance — and import from `firebase/firestore/pipelines`:

```ts
import { searchDb } from "@/src/lib/firestore/firebaseSearchDb";
import { and, execute, field, or, type BooleanExpression } from "firebase/firestore/pipelines";
import { VectorValue } from "firebase/firestore";

// Adjust the regex-matched fields to the entity's searchable text fields:
async function searchByQuery(q: string, status: string | undefined, limit: number) {
  const regex = q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const filters: BooleanExpression[] = [
    or(
      field("name").toLower().regexMatch(regex),   // ← entity-specific searchable fields
      field("slug").toLower().regexMatch(regex),
    ),
  ];
  if (status) filters.push(field("status").equal(status));

  let pipeline = searchDb.pipeline().collection(firestoreCollections.{entities});
  pipeline = pipeline.where(combineWithAnd(filters)).limit(limit);
  const snapshot = await execute(pipeline);

  return snapshot.results.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    return validate{Entity}({
      ...data,
      id: (data.id as string) ?? entry.id ?? "",
      // Unwrap VectorValue inline — pipeline does not use withConverter()
      // vectorField: data.vectorField instanceof VectorValue
      //   ? data.vectorField.toArray() : data.vectorField,
    });
  });
}
```

**`firebaseSearchDb.ts`** — server-only client Firestore for pipeline use (already exists, do not duplicate):

```ts
// src/lib/firestore/firebaseSearchDb.ts
import "server-only";
import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeServerFirestoreEmulator } from "./emulator";
import {
  applyEmulatorEnvironmentDefaults,
  DATABASE_NAME,
  getFirebaseWebConfig,
} from "./environment";

const SEARCH_APP_NAME = "luratha-search-server-app";
applyEmulatorEnvironmentDefaults();
const _app =
  getApps().find((a) => a.name === SEARCH_APP_NAME) ??
  initializeApp(getFirebaseWebConfig(), SEARCH_APP_NAME);
export const searchDb = getFirestore(_app, DATABASE_NAME);
initializeServerFirestoreEmulator(searchDb);
```

### POST — Create

```ts
export const runtime = "nodejs";

export async function POST(request: Request) {
  // 1. Parse JSON body (400 on parse error)
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Corpo inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Corpo deve ser um objeto JSON." }, { status: 400 });
  }

  // 2. Server-generated fields
  const now = new Date().toISOString();
  const id = randomUUID();
  const input = { ...(body as Record<string, unknown>), id, createdAt: now, updatedAt: now };

  // 3. Validate with Zod (400 on failure, use error.issues — Zod v4 removed .errors)
  let entity: {Entity};
  try { entity = validate{Entity}(input); }
  catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Dados inválidos.", errors: error.issues }, { status: 400 });
    return NextResponse.json({ message: "Erro de validação." }, { status: 400 });
  }

  // 4. Generate embeddings (non-fatal) — only for entities with vector fields
  // try {
  //   const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
  //   const embeddings = await generate{Entity}Embeddings(entity, embeddingService);
  //   entity = { ...entity, ...embeddings };
  // } catch { /* skip — entity is saved without embeddings */ }

  // 5. Check for ID conflict (409)
  const entityRef = adminDb.collection(firestoreCollections.{entities}).doc(entity.id).withConverter(admin{Entity}Converter);
  const existing = await entityRef.get();
  if (existing.exists) return NextResponse.json({ message: `{Entity} com id "${entity.id}" já existe.` }, { status: 409 });

  // 6. Write and respond
  await entityRef.set(entity);
  return NextResponse.json(entity, { status: 201 });
}
```

### PUT — Full Overwrite

Rules:

- `id` is always from the URL parameter (body value is discarded)
- `createdAt` is preserved from the existing document
- `updatedAt` is set to now
- Schema-computed fields (e.g. `slug`) must be stripped before re-validation so the schema can regenerate them
- Embeddings are always regenerated (if applicable)
- Returns 404 if the entity does not exist

```ts
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ... parse body (same pattern as POST step 1) ...

  const entityRef = adminDb.collection(firestoreCollections.{entities}).doc(id).withConverter(admin{Entity}Converter);
  const existing = await entityRef.get();
  if (!existing.exists) return NextResponse.json({ message: `{Entity} com id "${id}" não encontrado.` }, { status: 404 });

  const existingData = existing.data()!;
  const now = new Date().toISOString();

  const input: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
    id,
    createdAt: existingData.createdAt, // preserve original
    updatedAt: now,
  };

  // Strip schema-computed fields so the schema regenerates them (e.g. slug):
  // const { slug: _slug, ...inputWithoutComputed } = input;
  let entity = validate{Entity}(input /* or inputWithoutComputed */);

  // Regenerate embeddings unconditionally (only for entities with vector fields):
  // try {
  //   const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
  //   const embeddings = await generate{Entity}Embeddings(entity, embeddingService);
  //   entity = { ...entity, ...embeddings };
  // } catch { /* skip */ }

  await entityRef.set(entity);
  return NextResponse.json(entity, { status: 200 });
}
```

### PATCH — Partial Update

Rules (critical — must be exactly this semantics):

| Field in payload         | Action                              |
| ------------------------ | ----------------------------------- |
| **Absent**               | Kept unchanged from stored document |
| **Present with `null`**  | Set to `null`                       |
| **Present with a value** | Updated to that value               |

`id` and `createdAt` are always forced from the stored document. Embeddings are only regenerated when the text fields they depend on appear in the payload.

```ts
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ... parse body (same pattern as POST step 1) ...

  const entityRef = adminDb.collection(firestoreCollections.{entities}).doc(id).withConverter(admin{Entity}Converter);
  const existing = await entityRef.get();
  if (!existing.exists) return NextResponse.json({ message: `{Entity} com id "${id}" não encontrado.` }, { status: 404 });

  const existingData = existing.data()!;
  const payload = body as Record<string, unknown>;
  const now = new Date().toISOString();

  // Spread order is critical: existingData first, then payload, then server-controlled fields
  const merged: Record<string, unknown> = {
    ...existingData,
    ...payload,                        // only keys present in payload are overwritten
    id,                                // always from URL
    createdAt: existingData.createdAt, // always from stored doc
    updatedAt: now,
  };

  // Strip schema-computed fields so the schema regenerates them:
  // const { slug: _slug, ...mergedWithoutComputed } = merged;
  let entity = validate{Entity}(merged /* or mergedWithoutComputed */);

  // Only regenerate embeddings when the relevant text fields changed:
  // const embeddingFieldsChanged = "title" in payload || "description" in payload;
  // if (embeddingFieldsChanged) {
  //   try {
  //     const embeddingService = createEmbeddingService({ credential: adminApp.options.credential });
  //     const embeddings = await generate{Entity}Embeddings(entity, embeddingService);
  //     entity = { ...entity, ...embeddings };
  //   } catch { /* skip */ }
  // }

  await entityRef.set(entity);
  return NextResponse.json(entity, { status: 200 });
}
```

> **PATCH pitfall:** Using `Object.assign` or a deep merge library will lose the null/absent distinction. The spread pattern above is the correct approach.

### DELETE — Remove Document

```ts
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const entityRef = adminDb.collection(firestoreCollections.{entities}).doc(id);
  const existing = await entityRef.get();
  if (!existing.exists) return NextResponse.json({ message: `{Entity} com id "${id}" não encontrado.` }, { status: 404 });

  await entityRef.delete();
  return new NextResponse(null, { status: 204 }); // No Content — do NOT use NextResponse.json()
}
```

---

## Schema-computed Fields

Some Zod schemas auto-generate fields via a `transform` — for example, the product schema generates `slug` from `title` + `sku`. **Never pass an existing computed field when re-validating** after PUT or PATCH — the stored value may not match what the schema would generate from the current data, causing a validation error.

Always strip computed fields before calling `validate{Entity}`:

```ts
const { slug: _slug, ...inputWithoutComputed } = input;
const entity = validate{Entity}(inputWithoutComputed);
// entity.slug is now correctly regenerated
```

Check your entity's Zod schema in `src/schemas/firestore/` for any `.transform()` calls that produce derived fields.

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
const { mockQueryGet, mockQueryRef, mockCollection, mockExecute, mockPipelineRef } = vi.hoisted(
  () => {
    const mockQueryGet = vi.fn();
    const mockQueryRef = {
      withConverter: vi.fn(),
      orderBy: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
      get: mockQueryGet,
    };
    mockQueryRef.withConverter.mockReturnValue(mockQueryRef);
    mockQueryRef.orderBy.mockReturnValue(mockQueryRef);
    mockQueryRef.where.mockReturnValue(mockQueryRef);
    mockQueryRef.limit.mockReturnValue(mockQueryRef);
    const mockCollection = vi.fn().mockReturnValue(mockQueryRef);

    // Pipeline mocks (only needed when entity supports ?q= search)
    const mockExecute = vi.fn();
    const mockPipelineRef = { collection: vi.fn(), where: vi.fn(), limit: vi.fn() };
    mockPipelineRef.collection.mockReturnValue(mockPipelineRef);
    mockPipelineRef.where.mockReturnValue(mockPipelineRef);
    mockPipelineRef.limit.mockReturnValue(mockPipelineRef);

    return { mockQueryGet, mockQueryRef, mockCollection, mockExecute, mockPipelineRef };
  },
);

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

// Only needed when entity supports ?q= pipeline search:
vi.mock("@/src/lib/firestore/firebaseSearchDb", () => ({
  searchDb: { pipeline: vi.fn(() => mockPipelineRef) },
}));

vi.mock("firebase/firestore/pipelines", () => ({
  execute: mockExecute,
  field: vi.fn(() => ({
    toLower: vi.fn().mockReturnThis(),
    regexMatch: vi.fn().mockReturnThis(),
    equal: vi.fn().mockReturnThis(),
  })),
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
  results: [{ id: "entity-1", data: () => buildStoredEntity() }],
});

// Check pipeline was used for ?q= search:
expect(mockExecute).toHaveBeenCalledTimes(1);
expect(mockQueryGet).not.toHaveBeenCalled(); // admin SDK query should NOT run
```

> **Note:** Use `new URL(request.url)` for query params in the handler — `request.nextUrl` is undefined in Vitest's jsdom environment.

> **`server-only` in tests:** `firebaseSearchDb.ts` has `import "server-only"`. The Vitest config (`vitest.config.mts`) aliases `server-only` to `src/test/__mocks__/server-only.ts` (an empty file). This prevents the build-time guard from throwing in tests. Add the same alias if you introduce other `server-only` modules that are imported in testable paths.

### Key mock setup for [id] routes

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
  const mockEmbed = vi.fn(); // only needed for entities with embeddings
  return { mockSet, mockGet, mockDelete, mockDoc, mockCollection, mockEmbed };
});

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

// Only needed for entities with embeddings:
vi.mock("@/src/lib/embeddingService", () => ({
  createEmbeddingService: vi.fn(() => ({ embed: mockEmbed })),
}));
```

### Simulating a stored entity for PUT/PATCH/DELETE

```ts
// Replace with all required fields of your entity's Zod schema
function buildStoredEntity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ENTITY_ID,
    // ... all required fields from the entity schema ...
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// In test:
mockGet.mockResolvedValue({ exists: true, data: () => buildStoredEntity() });
```

**Product example** (for reference):

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
    price: {
      price: 250,
      currency: "BRL",
      salePrice: null,
      priceMin: null,
      priceMax: null,
      startDate: null,
      endDate: null,
    },
    // ... all required schema fields ...
    ...overrides,
  };
}
```

### Request factory for [id] routes

```ts
function makeRequest(method: string, body: unknown): Request {
  return new Request(`http://localhost/api/{entities}/${ENTITY_ID}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Params are async in Next.js 16:
const params = Promise.resolve({ id: ENTITY_ID });
const response = await PUT(makeRequest("PUT", body), { params });
```

### PATCH null/absent distinction test

```ts
it("sets field to null when payload contains null", async () => {
  mockGet.mockResolvedValue({
    exists: true,
    data: () => buildStoredEntity({ optionalField: "some value" }),
  });
  const response = await PATCH(makeRequest("PATCH", { optionalField: null }), { params });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.optionalField).toBeNull();
});

it("does not change field when it is absent from payload", async () => {
  mockGet.mockResolvedValue({
    exists: true,
    data: () => buildStoredEntity({ optionalField: "some value" }),
  });
  const response = await PATCH(makeRequest("PATCH", { status: "inactive" }), { params });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.optionalField).toBe("some value"); // unchanged
});
```

---

## Common Pitfalls

### 1. Missing `export const runtime = "nodejs"`

Without this, Next.js may attempt to run the route in the Edge runtime where `firebase-admin` is not available.

### 2. VectorValue stored as plain array

Calling `adminDb.collection(...).doc(id).set({ ...entity })` without `.withConverter(admin{Entity}Converter)` will store vector fields as plain JavaScript arrays. The `findNearest` pipeline operation will silently return 0 results. Always use `.withConverter(admin{Entity}Converter)`.

### 3. `VectorValue` not exportable from admin SDK

The `firebase-admin/firestore` package does **not** export `VectorValue` as a class, so `instanceof VectorValue` will throw at runtime in admin code. Use duck-typing via `.toArray()` instead (see `adminProductConverter.ts` as reference).

### 4. Schema-computed fields break re-validation

When updating an existing entity, any field auto-generated by a Zod `transform` (e.g. `slug` from `title` + `sku`) must be stripped before re-calling `validate{Entity}`. The stored value will differ from what the schema would regenerate from the updated data, causing a validation error.

### 5. Zod v4 `.errors` removed

Use `error.issues`, not `error.errors`. In Zod v4, the `.errors` alias was removed.

### 6. PATCH merge order matters

The correct merge order is `{ ...existingData, ...payload, ...serverFields }`. Reversing `existingData` and `payload` will make payload fields be silently overwritten by the stored values.

### 7. 204 No Content response

Use `new NextResponse(null, { status: 204 })`, **not** `NextResponse.json(null, { status: 204 })`. The `json()` helper adds a `Content-Type: application/json` header and may set a non-null body, which violates HTTP 204 semantics.

### 8. Do NOT reuse the same text for multiple embedding fields

Each embedding field must be generated from different text appropriate to its purpose (e.g. title-only for quick similarity vs. rich combined text for semantic search). Use the entity-specific embedding helper and check `src/lib/productEmbeddings.ts` for the pattern.

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

| Scenario                                  | Status                                     |
| ----------------------------------------- | ------------------------------------------ |
| Successful fetch (GET by ID)              | `200 OK`                                   |
| Successful list (GET collection)          | `200 OK`                                   |
| Successful creation                       | `201 Created`                              |
| Successful update (PUT/PATCH)             | `200 OK`                                   |
| Successful deletion                       | `204 No Content`                           |
| Invalid JSON body                         | `400 Bad Request`                          |
| Zod validation failure                    | `400 Bad Request` (with `errors: issue[]`) |
| Document not found (GET/PUT/PATCH/DELETE) | `404 Not Found`                            |
| ID conflict (POST)                        | `409 Conflict`                             |

---

## File References

These are the existing files for the **products** entity (with vector fields) and **categories** entity (without vector fields) — use them as templates when creating a new entity:

| File                                          | Purpose                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/app/api/products/route.ts`               | GET (list) and POST handlers                                                                                     |
| `src/app/api/products/list.ts`                | GET list handler — simple query + `?q=` pipeline search (entity **with** vector fields)                          |
| `src/app/api/categories/list.ts`              | GET list handler — simple query + `?q=` pipeline search (entity **without** vector fields)                       |
| `src/app/api/products/[id]/route.ts`          | Re-exports GET, PUT, PATCH, DELETE                                                                               |
| `src/app/api/products/[id]/get.ts`            | GET handler (fetch by ID)                                                                                        |
| `src/app/api/products/[id]/put.ts`            | PUT handler                                                                                                      |
| `src/app/api/products/[id]/patch.ts`          | PATCH handler                                                                                                    |
| `src/app/api/products/[id]/delete.ts`         | DELETE handler                                                                                                   |
| `src/lib/productEmbeddings.ts`                | Reference embedding helper — `generateProductEmbeddings`, `buildVectorEmbeddingText`, `buildSearchEmbeddingText` |
| `src/lib/firestore/adminProductConverter.ts`  | Reference Admin SDK DataConverter (entity with Timestamps and vector fields)                                     |
| `src/lib/firestore/adminCategoryConverter.ts` | Reference Admin SDK DataConverter (entity without Timestamps or vector fields)                                   |
| `src/lib/firestore/clientProductConverter.ts` | Reference Client SDK DataConverter                                                                               |
| `src/lib/firestore/firebaseSearchDb.ts`       | Server-only client Firestore for pipeline search (shared — do not duplicate)                                     |
| `src/lib/embeddingService.ts`                 | Vertex AI embedding service (shared)                                                                             |
| `src/lib/firestore/firebaseAdmin.ts`          | `adminDb`, `adminApp`, `adminStorage` (shared)                                                                   |
| `src/schemas/firestore/products.ts`           | Reference Zod product schema + `validateProduct`                                                                 |
| `src/schemas/firestore/category.ts`           | Reference Zod category schema + `validateCategory` (simple schema, no Timestamps)                                |
| `src/schemas/firestore/index.ts`              | `firestoreCollections` + all schema exports                                                                      |
| `src/test/__mocks__/server-only.ts`           | Empty no-op mock for `server-only` in Vitest                                                                     |
