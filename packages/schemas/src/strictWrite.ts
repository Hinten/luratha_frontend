import { z } from "zod";

/**
 * Strict-write enforcement helpers shared by every Firestore DataConverter
 * (both the admin and client variants), so the parse/guard logic lives in one
 * place instead of being duplicated per SDK surface.
 *
 * Background: every schema in `@luratha/schemas` is a default `z.object`, which
 * SILENTLY strips unknown top-level keys. For READS that lenience is desirable
 * (stored documents may carry legacy keys mid-migration). For WRITES we want a
 * hard failure so a typo'd or stale field never lands in Firestore.
 */

/**
 * Throws a `ZodError` (`code: "unrecognized_keys"`) when the caller supplied a
 * top-level key that the strip-policy parse DROPPED.
 *
 * Direction matters: we only flag keys that are `Object.hasOwn(input)` but NOT
 * `Object.hasOwn(parsed)`. Transform-ADDED keys (e.g. the product `slug`,
 * `variantIds`, `variantSkus`, `vectorEmbedding`) and `.default()`-filled keys
 * are present in `parsed` yet absent from `input`, so they are never flagged.
 *
 * We use `Object.hasOwn`, NOT the `in` operator: `in` walks the prototype chain
 * (`toString`/`constructor`/`__proto__`), which would both miss real own-key
 * drops and risk treating inherited keys as supplied. `hasOwn` also still counts
 * a key explicitly set to `undefined` as "supplied" by the caller.
 *
 * Strictness is TOP-LEVEL only — nested objects keep Zod's default behaviour.
 *
 * Passthrough/loose schemas (none exist today) never drop a key, so this guard
 * is automatically a no-op for them — the mechanism stays generic.
 *
 * Caveat: a schema whose transform RENAMES or DELETES a legitimate input key
 * would trip this. No current schema does; add an explicit exemption if one is.
 */
export function assertNoDroppedKeys(input: unknown, parsed: unknown): void {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return;
  if (parsed === null || typeof parsed !== "object") return;

  const dropped: string[] = [];
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (Object.hasOwn(input as object, key) && !Object.hasOwn(parsed as object, key)) {
      dropped.push(key);
    }
  }

  if (dropped.length > 0) {
    throw new z.ZodError([
      {
        code: "unrecognized_keys",
        keys: dropped,
        path: [],
        message: `Unrecognized key(s) in write payload: ${dropped.join(", ")}`,
      },
    ]);
  }
}

/**
 * Runs an entity's normal validator (a pure transform on the same bytes) and
 * then the dropped-key guard. This is the single choke point a DataConverter's
 * `toFirestore` calls before serializing, so every schema-bound write rejects
 * unknown top-level fields instead of silently stripping them.
 */
export function parseStrictWrite<T>(validate: (input: unknown) => T, input: unknown): T {
  const parsed = validate(input);
  assertNoDroppedKeys(input, parsed);
  return parsed;
}

/**
 * Repository-side merge for PATCH semantics, following the mandated merge order
 * `{ ...existing, ...patch, ...serverFields }`.
 *
 * Key semantics:
 *  - **absent** key in `patch` → existing value is left unchanged;
 *  - **`null`** → stored as null (clears the field to null);
 *  - **`undefined`** → treated as ABSENT (existing value left unchanged). An
 *    `undefined` value never overrides or deletes an existing field. This both
 *    keeps the result free of `undefined` (the Admin SDK rejects it) AND avoids
 *    the footgun where a `Partial<T>` patch carrying `{ field: undefined }`
 *    would silently delete `field` on an overwrite (`set`) write. To remove a
 *    field, delete it explicitly on the validated object before writing.
 *
 * Schema defaults are NOT injected here — they already exist on `existing`; the
 * caller re-validates the merged object afterwards. `existing` is expected to be
 * a validated entity (the project's schemas use `.nullable().default(null)`, not
 * `.optional()`, so a valid entity carries no `undefined` values).
 */
export function mergeForWrite<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown>,
  serverFields: Record<string, unknown> = {},
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };
  for (const source of [patch, serverFields]) {
    for (const key of Object.keys(source)) {
      if (Object.hasOwn(source, key) && source[key] !== undefined) {
        merged[key] = source[key];
      }
    }
  }
  return merged;
}
