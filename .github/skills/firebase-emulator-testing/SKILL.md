---
name: firebase-emulator-testing
description: Use this skill to implement and validate Firebase Emulator integration tests (Firestore/Auth/Storage), including running-emulator detection, auto-start with timeout, skip strategy, data cleanup, firebase emulators:exec scripts, and CI/CD best practices.
compatibility: Firebase CLI, Firebase JS SDK v12, Vitest, Node.js 22, Next.js 16
---

# Firebase Emulator Testing — Luratha

## Goal

Standardize how Firestore integration tests are built with reliability, predictable behavior, and strong performance.

## 1) Correct Firebase Emulator setup

Prerequisites:

```bash
npm ci
npm install -g firebase-tools@latest
firebase setup:emulators:firestore
```

Expected local emulator ports (`firebase.json`):

- Firestore: `8080`
- Auth: `9099`
- Storage: `9199`

## 2) How to check if the emulator is running (reusable code)

Use a Node utility that probes ports (`net.createConnection`) and exposes:

- `ensureFirestoreEmulator()`

Recommended flow:

1. Try to connect to `FIRESTORE_EMULATOR_HOST`.
2. If unavailable, start `firebase emulators:start --only firestore`.
3. Wait until timeout.
4. Return a status used by `describe` or `describe.skip`.

## 3) Recommended strategy: skip vs auto-start

- **Local dev:** auto-start to reduce friction.
- **CI:** prefer `firebase emulators:exec` (deterministic startup/shutdown).
- **Mandatory fallback:** if startup exceeds timeout, use `describe.skip` and log the reason.

## 4) Best practices for emulator tests

- Use `@vitest-environment node` for Firebase integration tests.
- Inject dependencies (for example `createProductsRepository(db)`).
- Validate payloads with schema validation (Zod) before persistence.
- Cover:
  - Create
  - Read
  - Update
  - Delete
  - Edge cases (`not_found`, conflicts, validation errors).

## 5) Dedicated Vitest config in package.json

Example:

```json
"test:firestore": "vitest run --config vitest.emulator.config.mts"
```

When this is mandatory:

- Any schema/domain contract change (for example files in `src/schemas/**`).
- Any Firebase request flow change (Firestore/Auth/Storage reads, writes, query filters, repository/service methods).

In these cases, always run `npm run test:firestore` and confirm all emulator-targeted suites are passing before finishing the task.

Benefits:

- automatically starts and stops emulator processes;
- reduces flaky tests;
- ideal for CI pipelines.
- does not require `firebase login` for local emulator execution.

## 6) SDK configuration for emulator targets

In frontend code (`src/lib/firebase.ts`):

- `NEXT_PUBLIC_USE_EMULATOR=true`
- `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
- `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
- `NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`

In Vitest config (`vitest.config.mts`):

- `FIREBASE_PROJECT_ID`
- `FIRESTORE_EMULATOR_HOST`
- `FIREBASE_AUTH_EMULATOR_HOST`
- `FIREBASE_STORAGE_EMULATOR_HOST`

## 7) Cleanup, performance, and CI/CD

- Clean collection data before each test (`clearFirestoreCollection`).
- Keep seed data focused and minimal.
- Pre-download emulator binaries in CI setup:

```yaml
- run: firebase setup:emulators:firestore
```

## 8) Advanced tips

- **Auth Emulator:** validate login and claims in real auth flows.
- **Storage Emulator:** validate upload behavior and object metadata.
- **Rules testing:** include allow/deny tests for security rules.
- **Isolated environments:** use dedicated test project IDs.

## 9) Practical example (based on this codebase)

- Repository: `src/lib/repositories/productsRepository.ts`
- Mock/seed: `src/lib/repositories/productsMockData.ts`
- Emulator utility: `src/test/firestoreEmulator.ts`
- Global setup/teardown: `src/test/firestoreEmulator.globalSetup.ts`
- Integration test: `src/test/emulator/productsRepository.emulator.test.ts`

## 10) Common issues and fixes

- **ECONNREFUSED**: emulator not running or host/port mismatch.
- **Startup timeout**: increase timeout and pre-download emulator binaries.
- **Zod validation failures on update**: ensure variant/stock/price consistency.
- **CI flakes**: keep emulator startup/shutdown in Vitest global setup and run only emulator-targeted suites.
